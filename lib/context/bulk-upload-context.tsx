"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { movieService } from "@/services/api/movieService";
import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import {
  extractTitleFromFolderName,
  mapLocalPathToRelativePath,
  type DroppedFolder,
} from "@/lib/upload/read-dropped-folders";

const FILE_UPLOAD_CONCURRENCY = 4;
const CHUNK_UPLOAD_CONCURRENCY = 6;
const DEFAULT_QUEUE_KEY = "myanflix-bulk-upload-queue-v1";
const CHUNK_RETRY_ATTEMPTS = 5;
const CHUNK_RETRY_BASE_MS = 500;
const CHUNK_RETRY_MAX_MS = 8000;

export const MAX_BULK_MOVIES = 10;

export type MovieUploadStatus =
  | "waiting"
  | "uploading"
  | "paused"
  | "offline"
  | "failed"
  | "completed"
  | "ready_to_publish";
export type AssetStatus = "pending" | "uploading" | "done" | "error";

export interface BulkAsset {
  relativePath: string;
  /** Null after a page refresh — browsers never let a File handle survive a reload, so it must be re-attached before this asset can (re)send. */
  file: File | null;
  size: number;
  status: AssetStatus;
  uploadedBytes: number;
}

export interface MovieUploadJob {
  key: string; // === movieId — assigned immediately, so the whole queue is identifiable even before any bytes move
  /** Which queue this job belongs to (e.g. the movie bulk-upload queue, or one series' episode queue) — jobs from every queue live in one flat array at the provider level. */
  queueKey: string;
  movieId: string;
  folderName: string;
  title: string;
  /** Extra context line under the title — "Season 2 · Episode 3" for episode uploads, null for movies. */
  subtitle: string | null;
  assets: BulkAsset[];
  status: MovieUploadStatus;
  queueOrder: number;
  addedAt: number;
  error?: string;
  needsReattach: boolean;
  speedBps: number;
  etaSeconds: number | null;
}

interface PersistedAsset {
  relativePath: string;
  size: number;
  status: AssetStatus;
  uploadedBytes: number;
}
interface PersistedJob {
  movieId: string;
  folderName: string;
  title: string;
  assets: PersistedAsset[];
  queueOrder: number;
  addedAt: number;
}

function loadPersisted(queueKey: string): PersistedJob[] {
  try {
    const raw = localStorage.getItem(queueKey);
    return raw ? (JSON.parse(raw) as PersistedJob[]) : [];
  } catch {
    return [];
  }
}

function persist(queueKey: string, jobs: MovieUploadJob[]) {
  const data: PersistedJob[] = jobs.map((j) => ({
    movieId: j.movieId,
    folderName: j.folderName,
    title: j.title,
    queueOrder: j.queueOrder,
    addedAt: j.addedAt,
    assets: j.assets.map((a) => ({
      relativePath: a.relativePath,
      size: a.size,
      status: a.status,
      uploadedBytes: a.uploadedBytes,
    })),
  }));
  try {
    localStorage.setItem(queueKey, JSON.stringify(data));
  } catch {
    // storage full/unavailable — the queue still works for this session, it just won't survive a refresh
  }
}

export function totalBytes(job: MovieUploadJob): number {
  return job.assets.reduce((sum, a) => sum + a.size, 0);
}
export function uploadedBytes(job: MovieUploadJob): number {
  return job.assets.reduce((sum, a) => sum + a.uploadedBytes, 0);
}

/**
 * Classifies an upload error as worth silently retrying vs. a genuine
 * failure. AbortError is a user's own Pause/Cancel (or the offline-abort
 * effect below) — never retried, always handled by the caller. A bare
 * TypeError is what `fetch` throws for a network-level failure (DNS, CORS,
 * connection reset). A 5xx/408/429 ApiError means the backend itself
 * hiccuped (e.g. mid-restart) — also worth retrying. Any other ApiError
 * (4xx) is a real rejection that retrying won't fix.
 */
function isTransient(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return false;
  if (err instanceof ApiError) return err.status >= 500 || err.status === 408 || err.status === 429;
  if (err instanceof TypeError) return true;
  return false;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

/**
 * Runs `fn`, silently retrying with exponential backoff on a transient
 * error (see `isTransient`) up to `CHUNK_RETRY_ATTEMPTS` times. Shared by
 * every network call in the upload pipeline — `init()` included, since a
 * blip on that very first call used to skip retry entirely and tip a job
 * straight into "offline" before a single byte of the file was even sent.
 */
async function withTransientRetry<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (signal.aborted || !isTransient(err) || attempt >= CHUNK_RETRY_ATTEMPTS) throw err;
      const backoff = Math.min(CHUNK_RETRY_BASE_MS * 2 ** (attempt - 1), CHUNK_RETRY_MAX_MS);
      await sleep(backoff, signal);
    }
  }
}

interface AddFoldersSeries {
  seriesId: string;
  seasonNumber: number;
  episodeNumbers: number[];
}

interface BulkUploadContextValue {
  jobs: MovieUploadJob[];
  /** Queue keys that have finished their initial restore-from-localStorage pass (or had nothing to restore). Anything not in here is still "restoring". */
  readyQueues: Set<string>;
  isOnline: boolean;
  ensureQueue: (queueKey: string) => void;
  addFolders: (queueKey: string, folders: DroppedFolder[], series?: AddFoldersSeries) => Promise<number>;
  pause: (key: string) => void;
  resume: (key: string) => void;
  retry: (key: string) => void;
  cancel: (key: string) => void;
  remove: (key: string) => void;
  reattachFolder: (key: string, folder: DroppedFolder) => void;
  moveWaitingToIndex: (queueKey: string, key: string, targetIndex: number) => void;
  markPublished: (movieId: string) => void;
  patchJobTitle: (movieId: string, title: string) => void;
}

const BulkUploadContext = createContext<BulkUploadContextValue | undefined>(undefined);

/**
 * Owns every bulk/episode upload queue in the app as one flat `jobs` array
 * (each job tagged with its `queueKey`), mounted once at the root so the
 * queue processor, chunk workers, and connectivity effects keep running
 * across route changes instead of being torn down when a page unmounts.
 * Reuses the exact same chunked-upload primitives as the rest of the
 * pre-transcoded upload flow.
 */
export function BulkUploadProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<MovieUploadJob[]>([]);
  const [readyQueues, setReadyQueues] = useState<Set<string>>(new Set());
  const isOnline = useNetworkStatus();

  const jobsRef = useRef<MovieUploadJob[]>([]);
  jobsRef.current = jobs;
  const onlineRef = useRef(isOnline);
  onlineRef.current = isOnline;

  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const pendingActionRef = useRef<Map<string, "pause" | "cancel">>(new Map());
  const speedSamplesRef = useRef<Map<string, { time: number; bytes: number }>>(new Map());
  const startingRef = useRef<Set<string>>(new Set());
  const nextQueueOrderRef = useRef<Map<string, number>>(new Map());
  // Guards against a duplicate restore/reconciliation pass for the same
  // queueKey — checked-and-set synchronously (before any await) so a page
  // remounting after a client-side route change reconnects to whatever's
  // already live instead of re-running restore and creating a second set of
  // in-flight requests for the same movie.
  const initializedQueuesRef = useRef<Set<string>>(new Set());

  // Restore whatever survives a refresh: the queue's identity and per-file
  // progress (both durable — movieId is a real backend row, sizes/statuses
  // are plain data) reconciled against each movie's authoritative current
  // status. What can never survive is the actual File bytes/handles, so
  // anything not fully uploaded comes back flagged needsReattach. Runs at
  // most once per queueKey for the provider's lifetime.
  const ensureQueue = useCallback((queueKey: string) => {
    if (initializedQueuesRef.current.has(queueKey)) return;
    initializedQueuesRef.current.add(queueKey);

    (async () => {
      const persisted = loadPersisted(queueKey);
      if (persisted.length === 0) {
        setReadyQueues((prev) => new Set(prev).add(queueKey));
        return;
      }

      const restored: MovieUploadJob[] = [];
      for (const p of persisted) {
        try {
          const movie = await movieService.getMovieById(p.movieId);
          if (movie.status === "PUBLISHED") continue; // graduated out of the upload queue entirely

          const assets: BulkAsset[] = p.assets.map((a) => ({ ...a, file: null }));
          const allDone = assets.length > 0 && assets.every((a) => a.status === "done");

          let status: MovieUploadStatus;
          if (movie.status === "READY_TO_PUBLISH") status = "ready_to_publish";
          else if (movie.status === "FAILED") status = "failed";
          else status = "waiting"; // still UPLOADING backend-side, but nothing is actively running client-side after a reload

          restored.push({
            key: p.movieId,
            queueKey,
            movieId: p.movieId,
            folderName: p.folderName,
            title: movie.title,
            // Rebuilt from the server rather than persisted — the movie row is the authority on episode position.
            subtitle:
              movie.seasonNumber != null && movie.episodeNumber != null
                ? `Season ${movie.seasonNumber} · Episode ${movie.episodeNumber}`
                : null,
            assets,
            status,
            queueOrder: p.queueOrder,
            addedAt: p.addedAt,
            needsReattach: status === "waiting" && !allDone,
            speedBps: 0,
            etaSeconds: null,
          });
        } catch {
          // movie no longer exists (deleted elsewhere) — drop it from the restored queue
        }
      }

      const maxOrder = restored.reduce((max, j) => Math.max(max, j.queueOrder + 1), 0);
      const existingOrder = nextQueueOrderRef.current.get(queueKey) ?? 0;
      nextQueueOrderRef.current.set(queueKey, Math.max(existingOrder, maxOrder));
      setJobs((prev) => [...prev, ...restored]);
      setReadyQueues((prev) => new Set(prev).add(queueKey));
    })();
  }, []);

  useEffect(() => {
    const byQueue = new Map<string, MovieUploadJob[]>();
    for (const job of jobs) {
      if (!byQueue.has(job.queueKey)) byQueue.set(job.queueKey, []);
      byQueue.get(job.queueKey)!.push(job);
    }
    for (const queueKey of readyQueues) {
      persist(queueKey, byQueue.get(queueKey) ?? []);
    }
  }, [jobs, readyQueues]);

  /** Updates one asset's bytes/status and recomputes the owning job's speed/ETA from the fresh aggregate — one atomic state transition instead of two separate updates racing each other. */
  const bumpAsset = useCallback(
    (key: string, relativePath: string, patch: Partial<BulkAsset>) => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.key !== key) return j;
          const assets = j.assets.map((a) => (a.relativePath === relativePath ? { ...a, ...patch } : a));
          const uploaded = assets.reduce((sum, a) => sum + a.uploadedBytes, 0);

          const now = Date.now();
          const sample = speedSamplesRef.current.get(key);
          let speedBps = j.speedBps;
          if (!sample) {
            speedSamplesRef.current.set(key, { time: now, bytes: uploaded });
          } else {
            const dt = (now - sample.time) / 1000;
            if (dt >= 0.2) {
              const instant = Math.max(0, (uploaded - sample.bytes) / dt);
              speedBps = speedBps === 0 ? instant : speedBps * 0.7 + instant * 0.3;
              speedSamplesRef.current.set(key, { time: now, bytes: uploaded });
            }
          }
          const total = assets.reduce((sum, a) => sum + a.size, 0);
          const etaSeconds = speedBps > 1 ? Math.max(0, Math.round((total - uploaded) / speedBps)) : null;

          return { ...j, assets, speedBps, etaSeconds };
        }),
      );
    },
    [],
  );

  const uploadOneAsset = useCallback(
    async (movieId: string, key: string, asset: BulkAsset, signal: AbortSignal) => {
      if (!asset.file) throw new Error(`${asset.relativePath} is not attached`);
      const file = asset.file;
      bumpAsset(key, asset.relativePath, { status: "uploading" });

      const { uploadId, chunkSize, totalChunks, uploadedChunks } = await withTransientRetry(
        () => uploadService.init(movieId, file.name, file.size, asset.relativePath),
        signal,
      );

      const done = new Set(uploadedChunks);
      let sent = 0;
      for (const idx of done) sent += Math.min(chunkSize, file.size - idx * chunkSize);
      bumpAsset(key, asset.relativePath, { uploadedBytes: sent });

      const remaining = Array.from({ length: totalChunks }, (_, i) => i).filter((n) => !done.has(n));
      let nextIndex = 0;
      const worker = async () => {
        for (;;) {
          const idx = nextIndex++;
          if (idx >= remaining.length) return;
          const chunkNumber = remaining[idx];
          const start = chunkNumber * chunkSize;
          const bytes = Math.min(chunkSize, file.size - start);
          const chunk = file.slice(start, start + bytes);

          // A transient network blip or a backend mid-restart 5xx never
          // surfaces to the job's status — it's retried in place, with the
          // job staying "uploading" throughout, so the admin never has to
          // notice or click anything.
          await withTransientRetry(() => uploadService.uploadChunk(uploadId, chunkNumber, chunk, signal), signal);
          sent += bytes;
          bumpAsset(key, asset.relativePath, { uploadedBytes: sent });
        }
      };
      await Promise.all(Array.from({ length: Math.min(CHUNK_UPLOAD_CONCURRENCY, remaining.length) }, worker));

      await uploadService.complete(uploadId);
      bumpAsset(key, asset.relativePath, { status: "done" });
    },
    [bumpAsset],
  );

  const startUpload = useCallback(
    async (key: string) => {
      if (startingRef.current.has(key)) return;
      const job = jobsRef.current.find((j) => j.key === key);
      if (!job) return;

      if (job.assets.some((a) => a.status !== "done" && !a.file)) {
        setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, needsReattach: true } : j)));
        return;
      }

      startingRef.current.add(key);
      const controller = new AbortController();
      controllersRef.current.set(key, controller);
      speedSamplesRef.current.delete(key);
      setJobs((prev) =>
        prev.map((j) => (j.key === key ? { ...j, status: "uploading", error: undefined, needsReattach: false } : j)),
      );

      try {
        const pending = job.assets.filter((a) => a.status !== "done");
        let nextIndex = 0;
        let firstError: unknown = null;
        const worker = async () => {
          for (;;) {
            const idx = nextIndex++;
            if (idx >= pending.length) return;
            try {
              await uploadOneAsset(job.movieId, key, pending[idx], controller.signal);
            } catch (err) {
              if (controller.signal.aborted) throw err;
              firstError ??= err;
              bumpAsset(key, pending[idx].relativePath, { status: "error" });
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(FILE_UPLOAD_CONCURRENCY, pending.length) }, worker));
        if (firstError) throw firstError;

        setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "completed" } : j)));
        const relativePaths = job.assets.map((a) => a.relativePath);
        await uploadService.finalizeExternalUpload(job.movieId, relativePaths);
        setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "ready_to_publish" } : j)));
      } catch (err) {
        // An explicit user action (Pause/Cancel button) always wins, even if
        // it happens to race with a connectivity drop. Absent one, blame
        // connectivity whenever we know we're offline right now, or when the
        // error itself looks transient (network failure, or a 5xx/408/429
        // that survived every chunk-level retry attempt) — either way this
        // is what routes an interrupted upload to "offline" instead of
        // "failed" so it auto-resumes later instead of needing a manual
        // retry click.
        const explicitAction = pendingActionRef.current.get(key);
        pendingActionRef.current.delete(key);

        if (explicitAction === "cancel") {
          setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "failed", error: "Cancelled by admin" } : j)));
        } else if (explicitAction === "pause") {
          setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "paused" } : j)));
        } else if (err instanceof ApiError && err.status === 404) {
          // The movie itself is gone — e.g. deleted from the Movies list
          // while this job was mid-retry. There's nothing left to upload to,
          // and retrying can only ever 404 again, so drop it from the queue
          // entirely instead of leaving a permanently-stuck "Failed" card.
          setJobs((prev) => prev.filter((j) => j.key !== key));
        } else if (!onlineRef.current || isTransient(err)) {
          setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "offline" } : j)));
        } else if (err instanceof DOMException && err.name === "AbortError") {
          setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "paused" } : j)));
        } else {
          const message = err instanceof Error ? err.message : "Upload failed";
          setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "failed", error: message } : j)));
        }
      } finally {
        controllersRef.current.delete(key);
        startingRef.current.delete(key);
      }
    },
    [uploadOneAsset, bumpAsset],
  );

  // The queue processor: for every queue that's finished restoring and has
  // nothing actively uploading, start its next eligible waiting job. Each
  // queue advances independently — a series' episode queue and the movie
  // bulk-upload queue can both be uploading at once, one file at a time
  // within themselves. Re-runs on every jobs change, so pausing, failing,
  // completing, or removing a queue's active job all naturally advance it.
  // Gated on isOnline — no new upload starts while there's no real
  // connection, so a "waiting" job just stays waiting rather than starting
  // only to immediately fail.
  useEffect(() => {
    if (!isOnline) return;
    const queueKeys = new Set(jobs.filter((j) => readyQueues.has(j.queueKey)).map((j) => j.queueKey));
    for (const queueKey of queueKeys) {
      const queueJobs = jobs.filter((j) => j.queueKey === queueKey);
      if (queueJobs.some((j) => j.status === "uploading")) continue;
      const next = queueJobs
        .filter((j) => j.status === "waiting" && !j.needsReattach)
        .sort((a, b) => a.queueOrder - b.queueOrder)[0];
      if (next) void startUpload(next.key);
    }
  }, [jobs, isOnline, readyQueues, startUpload]);

  // The moment connectivity drops, proactively abort whatever's actively
  // uploading rather than waiting for its in-flight request to eventually
  // time out on its own — this is what makes the pause immediate ("Upload
  // pauses automatically") instead of a stall the admin has to notice.
  useEffect(() => {
    if (isOnline) return;
    for (const job of jobs) {
      if (job.status === "uploading") controllersRef.current.get(job.key)?.abort();
    }
  }, [isOnline, jobs]);

  // Every job parked in "offline" — whether from a real connectivity drop or
  // from a chunk retry loop exhausting its attempts while the browser still
  // thinks it's online (e.g. the backend itself restarting) — goes back to
  // "waiting" once we're online. The queue processor above then picks it up
  // on its own, no admin interaction required. It resumes via the exact same
  // startUpload() path as everything else, which always re-checks
  // uploadedChunks first — so it only ever sends whatever chunks are still
  // actually missing. Re-checking on every `jobs` change (not just when
  // isOnline itself flips) is what catches the second case, since isOnline
  // may never have gone false at all.
  useEffect(() => {
    if (!isOnline) return;
    setJobs((prev) => {
      if (!prev.some((j) => j.status === "offline")) return prev;
      return prev.map((j) => (j.status === "offline" ? { ...j, status: "waiting" } : j));
    });
  }, [isOnline, jobs]);

  /**
   * With `series` set, each folder becomes an episode of that series —
   * `series.episodeNumbers[i]` is folder i's episode number (the page
   * derives these from folder names or sequential position before calling).
   * Without it, folders become standalone movies, exactly as before.
   */
  const addFolders = useCallback(
    async (queueKey: string, folders: DroppedFolder[], series?: AddFoldersSeries): Promise<number> => {
      let added = 0;
      for (const [index, folder] of folders.entries()) {
        const title = extractTitleFromFolderName(folder.folderName);
        try {
          const movie = await movieService.createUploadPlaceholder(
            title,
            series
              ? { seriesId: series.seriesId, seasonNumber: series.seasonNumber, episodeNumber: series.episodeNumbers[index] }
              : undefined,
          );
          const assets: BulkAsset[] = folder.files.map((f) => ({
            relativePath: mapLocalPathToRelativePath(f.relativePath),
            file: f.file,
            size: f.file.size,
            status: "pending",
            uploadedBytes: 0,
          }));
          const queueOrder = nextQueueOrderRef.current.get(queueKey) ?? 0;
          nextQueueOrderRef.current.set(queueKey, queueOrder + 1);
          const job: MovieUploadJob = {
            key: movie.id,
            queueKey,
            movieId: movie.id,
            folderName: folder.folderName,
            title,
            subtitle: series ? `Season ${series.seasonNumber} · Episode ${series.episodeNumbers[index]}` : null,
            assets,
            status: "waiting",
            queueOrder,
            addedAt: Date.now(),
            needsReattach: false,
            speedBps: 0,
            etaSeconds: null,
          };
          setJobs((prev) => [...prev, job]);
          added++;
        } catch {
          // this one folder's placeholder failed to create — keep going with the rest
        }
      }
      return added;
    },
    [],
  );

  const pause = useCallback((key: string) => {
    const controller = controllersRef.current.get(key);
    if (!controller) return;
    pendingActionRef.current.set(key, "pause");
    controller.abort();
  }, []);

  const resume = useCallback((key: string) => {
    setJobs((prev) => prev.map((j) => (j.key === key && j.status === "paused" ? { ...j, status: "waiting" } : j)));
  }, []);

  const retry = useCallback((key: string) => {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.key !== key || j.status !== "failed") return j;
        const assets = j.assets.map((a) => (a.status === "error" ? { ...a, status: "pending" as const } : a));
        return { ...j, assets, status: "waiting", error: undefined };
      }),
    );
  }, []);

  /**
   * Cancelling or removing an unfinished job always means giving up on it —
   * without deleting its placeholder movie row too, it's left behind
   * forever as a zombie "Uploading" entry with no video, invisible to the
   * queue but still sitting in the catalog. Worse, a stale retry (e.g. the
   * auto-resume effect picking it back up from "offline") can then race a
   * later manual cleanup and 404 against a movie that's already gone.
   * Deleting it here closes that gap. Never applies to `ready_to_publish` —
   * that's a real, fully-uploaded movie just waiting on a separate Publish
   * action, not something to delete.
   */
  const deletePlaceholderIfUnfinished = useCallback((job: MovieUploadJob | undefined) => {
    if (job && job.status !== "ready_to_publish") {
      movieService.deleteMovie(job.movieId).catch(() => {});
    }
  }, []);

  const cancel = useCallback(
    (key: string) => {
      const job = jobsRef.current.find((j) => j.key === key);
      const controller = controllersRef.current.get(key);
      if (controller) {
        pendingActionRef.current.set(key, "cancel");
        controller.abort();
      } else {
        setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "failed", error: "Cancelled by admin" } : j)));
      }
      deletePlaceholderIfUnfinished(job);
    },
    [deletePlaceholderIfUnfinished],
  );

  const remove = useCallback(
    (key: string) => {
      const job = jobsRef.current.find((j) => j.key === key);
      const controller = controllersRef.current.get(key);
      if (controller) {
        pendingActionRef.current.set(key, "cancel");
        controller.abort();
      }
      setJobs((prev) => prev.filter((j) => j.key !== key));
      deletePlaceholderIfUnfinished(job);
    },
    [deletePlaceholderIfUnfinished],
  );

  /** Matches a re-selected folder's files back onto this job's assets by relativePath — the only way to resume/retry after a page refresh, since File handles never survive one. */
  const reattachFolder = useCallback((key: string, folder: DroppedFolder) => {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.key !== key) return j;
        const byPath = new Map(folder.files.map((f) => [mapLocalPathToRelativePath(f.relativePath), f.file]));
        const assets = j.assets.map((a) => (byPath.has(a.relativePath) ? { ...a, file: byPath.get(a.relativePath)! } : a));
        const stillMissing = assets.some((a) => a.status !== "done" && !a.file);
        return { ...j, assets, needsReattach: stillMissing };
      }),
    );
  }, []);

  /** Drag-to-reorder for the waiting queue — moves one job to an arbitrary position among the OTHER WAITING JOBS OF THE SAME QUEUE (never mixing e.g. two different series' episode queues together). */
  const moveWaitingToIndex = useCallback((queueKey: string, key: string, targetIndex: number) => {
    setJobs((prev) => {
      const waiting = prev
        .filter((j) => j.queueKey === queueKey && j.status === "waiting")
        .sort((a, b) => a.queueOrder - b.queueOrder);
      const fromIndex = waiting.findIndex((j) => j.key === key);
      if (fromIndex === -1) return prev;
      const reordered = [...waiting];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(Math.max(0, Math.min(targetIndex, reordered.length)), 0, moved);
      const orderOf = new Map(reordered.map((j, i) => [j.key, i]));
      return prev.map((j) => (orderOf.has(j.key) ? { ...j, queueOrder: orderOf.get(j.key)! } : j));
    });
  }, []);

  /** Removes a job from the queue view once its movie is actually published — "published" isn't a queue status, the movie has graduated to the main catalog. */
  const markPublished = useCallback((movieId: string) => {
    setJobs((prev) => prev.filter((j) => j.movieId !== movieId));
  }, []);

  const patchJobTitle = useCallback((movieId: string, title: string) => {
    setJobs((prev) => prev.map((j) => (j.movieId === movieId ? { ...j, title } : j)));
  }, []);

  const value: BulkUploadContextValue = {
    jobs,
    readyQueues,
    isOnline,
    ensureQueue,
    addFolders,
    pause,
    resume,
    retry,
    cancel,
    remove,
    reattachFolder,
    moveWaitingToIndex,
    markPublished,
    patchJobTitle,
  };

  return <BulkUploadContext.Provider value={value}>{children}</BulkUploadContext.Provider>;
}

/**
 * Consumes one named queue (e.g. `myanflix-episode-queue-<seriesId>`) out of
 * the shared `BulkUploadProvider` — same call-site shape as the old
 * page-scoped hook it replaces, so callers don't change beyond the import.
 * The underlying jobs/effects live at the provider (mounted once at the
 * root), so they keep running across route changes; this hook just
 * registers interest in `queueKey` (via `ensureQueue`, safe to call
 * repeatedly — it's a once-per-queueKey no-op after the first mount) and
 * returns a filtered, queue-scoped view.
 */
export function useBulkUploadQueue(queueKey: string = DEFAULT_QUEUE_KEY) {
  const ctx = useContext(BulkUploadContext);
  if (!ctx) throw new Error("useBulkUploadQueue must be used within a BulkUploadProvider");

  useEffect(() => {
    ctx.ensureQueue(queueKey);
  }, [ctx, queueKey]);

  const jobs = useMemo(() => ctx.jobs.filter((j) => j.queueKey === queueKey), [ctx.jobs, queueKey]);

  const addFolders = useCallback(
    (folders: DroppedFolder[], series?: AddFoldersSeries) => ctx.addFolders(queueKey, folders, series),
    [ctx, queueKey],
  );
  const moveWaitingToIndex = useCallback(
    (key: string, targetIndex: number) => ctx.moveWaitingToIndex(queueKey, key, targetIndex),
    [ctx, queueKey],
  );

  return {
    jobs,
    restoring: !ctx.readyQueues.has(queueKey),
    isOnline: ctx.isOnline,
    addFolders,
    pause: ctx.pause,
    resume: ctx.resume,
    retry: ctx.retry,
    cancel: ctx.cancel,
    remove: ctx.remove,
    reattachFolder: ctx.reattachFolder,
    moveWaitingToIndex,
    markPublished: ctx.markPublished,
    patchJobTitle: ctx.patchJobTitle,
  };
}
