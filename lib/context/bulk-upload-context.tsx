"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { movieService } from "@/services/api/movieService";
import { uploadService } from "@/services/api/uploadService";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import {
  extractTitleFromFolderName,
  mapLocalPathToRelativePath,
  type DroppedFolder,
} from "@/lib/upload/read-dropped-folders";

const FILE_UPLOAD_CONCURRENCY = 4;
const CHUNK_UPLOAD_CONCURRENCY = 6;
const STORAGE_KEY = "myanflix-bulk-upload-queue-v1";

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
  movieId: string;
  folderName: string;
  title: string;
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

function loadPersisted(): PersistedJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedJob[]) : [];
  } catch {
    return [];
  }
}

function persist(jobs: MovieUploadJob[]) {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
 * Drives the sequential bulk-upload queue: up to 10 movie folders, exactly
 * one uploading its files at a time, the rest waiting (reorderable). Every
 * movie gets its placeholder created immediately on selection (so the whole
 * queue — including ones still waiting — is durable and restorable from the
 * very first render, not just once it starts). Reuses the exact same
 * chunked-upload primitives as the rest of the pre-transcoded upload flow.
 */
export function useBulkExternalUpload() {
  const [jobs, setJobs] = useState<MovieUploadJob[]>([]);
  const [restoring, setRestoring] = useState(true);
  const isOnline = useNetworkStatus();

  const jobsRef = useRef<MovieUploadJob[]>([]);
  jobsRef.current = jobs;
  const onlineRef = useRef(isOnline);
  onlineRef.current = isOnline;

  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const pendingActionRef = useRef<Map<string, "pause" | "cancel">>(new Map());
  const speedSamplesRef = useRef<Map<string, { time: number; bytes: number }>>(new Map());
  const startingRef = useRef<Set<string>>(new Set());
  const nextQueueOrderRef = useRef(0);

  // Restore whatever survives a refresh: the queue's identity and per-file
  // progress (both durable — movieId is a real backend row, sizes/statuses
  // are plain data) reconciled against each movie's authoritative current
  // status. What can never survive is the actual File bytes/handles, so
  // anything not fully uploaded comes back flagged needsReattach.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persisted = loadPersisted();
      if (persisted.length === 0) {
        setRestoring(false);
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
            movieId: p.movieId,
            folderName: p.folderName,
            title: movie.title,
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

      if (cancelled) return;
      nextQueueOrderRef.current = restored.reduce((max, j) => Math.max(max, j.queueOrder + 1), 0);
      setJobs(restored);
      setRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restoring) return;
    persist(jobs);
  }, [jobs, restoring]);

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

      const { uploadId, chunkSize, totalChunks, uploadedChunks } = await uploadService.init(
        movieId,
        file.name,
        file.size,
        asset.relativePath,
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
          await uploadService.uploadChunk(uploadId, chunkNumber, chunk, signal);
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
        // browser's own network-failure error shape says so — either way
        // this is what routes an interrupted upload to "offline" instead of
        // "failed" so it auto-resumes later instead of needing a manual retry.
        const explicitAction = pendingActionRef.current.get(key);
        pendingActionRef.current.delete(key);

        if (explicitAction === "cancel") {
          setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "failed", error: "Cancelled by admin" } : j)));
        } else if (explicitAction === "pause") {
          setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "paused" } : j)));
        } else if (!onlineRef.current || err instanceof TypeError) {
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

  // The queue processor: whenever nothing is actively uploading, start the
  // next eligible waiting job. Re-runs on every jobs change, so pausing,
  // failing, completing, or removing the active job all naturally advance
  // it. Gated on isOnline — no new upload starts while there's no real
  // connection, so a "waiting" job just stays waiting rather than starting
  // only to immediately fail.
  useEffect(() => {
    if (restoring || !isOnline) return;
    if (jobs.some((j) => j.status === "uploading")) return;
    const next = [...jobs].filter((j) => j.status === "waiting" && !j.needsReattach).sort((a, b) => a.queueOrder - b.queueOrder)[0];
    if (next) void startUpload(next.key);
  }, [jobs, restoring, isOnline, startUpload]);

  // The moment connectivity drops, proactively abort whatever's actively
  // uploading rather than waiting for its in-flight request to eventually
  // time out on its own — this is what makes the pause immediate ("Upload
  // pauses automatically") instead of a stall the admin has to notice.
  useEffect(() => {
    if (isOnline) return;
    const active = jobs.find((j) => j.status === "uploading");
    if (!active) return;
    controllersRef.current.get(active.key)?.abort();
  }, [isOnline, jobs]);

  // The moment connectivity returns, every job that was auto-paused for it
  // (never one the admin explicitly paused themselves) goes back to
  // "waiting" — the queue processor above then picks it up on its own, no
  // admin interaction required. It resumes via the exact same startUpload()
  // path as everything else, which always re-checks uploadedChunks first —
  // so it only ever sends whatever chunks are still actually missing.
  useEffect(() => {
    if (!isOnline) return;
    setJobs((prev) => {
      if (!prev.some((j) => j.status === "offline")) return prev;
      return prev.map((j) => (j.status === "offline" ? { ...j, status: "waiting" } : j));
    });
  }, [isOnline]);

  const addFolders = useCallback(async (folders: DroppedFolder[]): Promise<number> => {
    let added = 0;
    for (const folder of folders) {
      const title = extractTitleFromFolderName(folder.folderName);
      try {
        const movie = await movieService.createUploadPlaceholder(title);
        const assets: BulkAsset[] = folder.files.map((f) => ({
          relativePath: mapLocalPathToRelativePath(f.relativePath),
          file: f.file,
          size: f.file.size,
          status: "pending",
          uploadedBytes: 0,
        }));
        const job: MovieUploadJob = {
          key: movie.id,
          movieId: movie.id,
          folderName: folder.folderName,
          title,
          assets,
          status: "waiting",
          queueOrder: nextQueueOrderRef.current++,
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
  }, []);

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

  const cancel = useCallback((key: string) => {
    const controller = controllersRef.current.get(key);
    if (controller) {
      pendingActionRef.current.set(key, "cancel");
      controller.abort();
    } else {
      setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, status: "failed", error: "Cancelled by admin" } : j)));
    }
  }, []);

  const remove = useCallback((key: string) => {
    const controller = controllersRef.current.get(key);
    if (controller) {
      pendingActionRef.current.set(key, "cancel");
      controller.abort();
    }
    setJobs((prev) => prev.filter((j) => j.key !== key));
  }, []);

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

  /** Drag-to-reorder for the waiting queue — moves one job to an arbitrary position among the other waiting jobs. */
  const moveWaitingToIndex = useCallback((key: string, targetIndex: number) => {
    setJobs((prev) => {
      const waiting = prev.filter((j) => j.status === "waiting").sort((a, b) => a.queueOrder - b.queueOrder);
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

  return {
    jobs,
    restoring,
    isOnline,
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
}
