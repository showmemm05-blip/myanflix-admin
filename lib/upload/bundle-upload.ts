import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import { putToMinio } from "@/lib/upload/minio-put";
import { PresignedPartUrlPool } from "@/lib/upload/presigned-part-pool";

/**
 * The presigned direct-to-MinIO bundle uploader, shared by the Bulk Upload
 * queue (bulk-upload-context.tsx, resourceType "movie" — a NEW title) and
 * the Edit Movie dialog's Video section (VideoSection.tsx, resourceType
 * "movie-replace" — a replacement bundle for an EXISTING title, landing in
 * a private staging prefix). The bodies here were lifted out of
 * bulk-upload-context.tsx verbatim; the only two things that vary between
 * the callers are the `resourceType` the backend's
 * ResourceUploadTypeRegistry maps to a key builder + permission, and where
 * per-file progress goes (`onPatches`). Everything else — concurrency
 * numbers, retry policy, the 403 -> pool.invalidate path, the ETag check,
 * "finalizing" before multipartComplete — is deliberately identical, so the
 * Bulk Upload page's behaviour does not change by being routed through here.
 */

const CHUNK_RETRY_ATTEMPTS = 5;
const CHUNK_RETRY_BASE_MS = 500;
const CHUNK_RETRY_MAX_MS = 8000;
// How often in-flight progress is pushed to React state, instead of on
// every chunk — a state update (and the re-render it triggers) for each of
// potentially thousands of chunks would itself compete with the browser's
// work of actually sending bytes.
export const PROGRESS_FLUSH_INTERVAL_MS = 250;
// Below this, a file goes through one presigned single PUT; at/above it,
// through real S3/MinIO multipart. Matches the backend's own
// MultipartUploadService.MULTIPART_PART_SIZE — kept in sync manually since
// nothing here can import a backend constant across the client/server
// boundary; the backend is the actual source of truth for `partSize` at
// upload time (returned by multipartInit), this only decides which
// endpoint to call in the first place.
export const MULTIPART_THRESHOLD_BYTES = 32 * 1024 * 1024;
// Real multipart parts are bandwidth-bound (large, few), so concurrency
// stays at the same level the old chunked flow used.
export const PART_UPLOAD_CONCURRENCY = 6;
// Small files (HLS playlists, subtitles, segments — often thousands per
// bundle) are latency-bound, not bandwidth-bound: each pays close to a full
// round trip regardless of its own size, so a much higher concurrency
// actually helps here in a way it wouldn't for the one large file. Requires
// the write-side proxy to serve HTTP/2 to be real concurrency rather than
// getting capped to ~6 by the browser's HTTP/1.1 per-origin connection
// limit — see the upload migration plan's throughput analysis.
export const SMALL_FILE_CONCURRENCY = 16;
// Presign requests are paginated at this size rather than one request per
// bundle (a multi-thousand-file payload) or one request per file (thousands
// of round trips) — see MultipartUploadService.PresignBatchDto's own
// ArrayMaxSize(500) backstop on the backend.
export const PRESIGN_BATCH_SIZE = 250;

/** "finalizing" = every chunk is on the backend, which is now merging them and pushing the result to storage — no bytes moving over HTTP, so it's tracked separately from "uploading" instead of just looking stuck at 100%. */
export type AssetStatus = "pending" | "uploading" | "finalizing" | "done" | "error";

export interface BundleUploadAsset {
  relativePath: string;
  /** Null after a page refresh — browsers never let a File handle survive a reload, so it must be re-attached before this asset can (re)send. */
  file: File | null;
  size: number;
  status: AssetStatus;
  uploadedBytes: number;
  /** Direct-to-MinIO flow only (USE_DIRECT_MINIO_UPLOAD): the active MultipartUploadSession id, set once multipartInit() resolves — needed so Cancel can abort it on the backend/MinIO. Never persisted to localStorage; a resumed upload always re-inits and gets a fresh one. */
  sessionId?: string;
}

export type AssetPatch = Partial<BundleUploadAsset>;
/** A batch of per-file patches keyed by relativePath. Several patches for the same file are already merged (later fields win), so the receiver applies each entry once. */
export type AssetPatches = ReadonlyMap<string, AssetPatch>;
/**
 * Where file progress/status goes — the queue context routes it into its
 * job, the Video section into local state. Always called with a batch so
 * the receiver can update its whole asset list in ONE pass: a bundle has
 * thousands of small files, and one state update per file used to copy the
 * full list thousands of times.
 */
export type OnAssetPatches = (patches: AssetPatches) => void;

/** One file's patch as a batch of one. */
function patchOne(onPatches: OnAssetPatches, relativePath: string, patch: AssetPatch): void {
  onPatches(new Map([[relativePath, patch]]));
}

/**
 * Collects per-file patches and hands them over in one batch every
 * PROGRESS_FLUSH_INTERVAL_MS. Patches for the same file are merged in
 * arrival order (`{...earlier, ...later}`), so a later "done" can never be
 * overwritten by an earlier "uploading" from the same window. After
 * close() (which flushes whatever is pending) any straggler patch is passed
 * straight through, so nothing that arrives late is ever dropped.
 */
class PatchBatcher {
  private pending = new Map<string, AssetPatch>();
  private timer: ReturnType<typeof setInterval> | null;

  constructor(private readonly onPatches: OnAssetPatches) {
    this.timer = setInterval(() => this.flush(), PROGRESS_FLUSH_INTERVAL_MS);
  }

  add(relativePath: string, patch: AssetPatch): void {
    if (this.timer === null) {
      patchOne(this.onPatches, relativePath, patch);
      return;
    }
    const earlier = this.pending.get(relativePath);
    this.pending.set(relativePath, earlier ? { ...earlier, ...patch } : patch);
  }

  flush(): void {
    if (this.pending.size === 0) return;
    const batch = this.pending;
    this.pending = new Map();
    this.onPatches(batch);
  }

  close(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.flush();
  }
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
export function isTransient(err: unknown): boolean {
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
export async function withTransientRetry<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
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

/** The one (typically) large file in a bundle — original.mp4 — via real S3/MinIO multipart, straight to MinIO. */
export async function uploadLargeAssetDirect(
  resourceType: string,
  resourceId: string,
  asset: BundleUploadAsset,
  signal: AbortSignal,
  onPatches: OnAssetPatches,
): Promise<void> {
  if (!asset.file) throw new Error(`${asset.relativePath} is not attached`);
  const file = asset.file;
  // A single large file only patches a handful of times plus once per
  // flush interval, so each patch goes out on its own.
  const onPatch = (relativePath: string, patch: AssetPatch) => patchOne(onPatches, relativePath, patch);
  onPatch(asset.relativePath, { status: "uploading" });

  const { sessionId, partSize, totalParts, uploadedParts } = await withTransientRetry(
    () => uploadService.multipartInit(resourceType, resourceId, file.name, file.size, asset.relativePath, signal),
    signal,
  );
  onPatch(asset.relativePath, { sessionId });

  const doneParts = new Map(uploadedParts.map((p) => [p.partNumber, p.etag]));
  let sent = 0;
  for (const partNumber of doneParts.keys()) {
    const start = (partNumber - 1) * partSize;
    sent += Math.min(partSize, file.size - start);
  }
  onPatch(asset.relativePath, { uploadedBytes: sent });

  let lastFlushedSent = sent;
  const flush = () => {
    if (sent === lastFlushedSent) return;
    lastFlushedSent = sent;
    onPatch(asset.relativePath, { uploadedBytes: sent });
  };
  const flushTimer = setInterval(flush, PROGRESS_FLUSH_INTERVAL_MS);

  const pool = new PresignedPartUrlPool(sessionId, PART_UPLOAD_CONCURRENCY);
  const remaining = Array.from({ length: totalParts }, (_, i) => i + 1).filter((n) => !doneParts.has(n));

  try {
    let nextIndex = 0;
    const worker = async () => {
      for (;;) {
        const idx = nextIndex++;
        if (idx >= remaining.length) return;
        const partNumber = remaining[idx];
        const start = (partNumber - 1) * partSize;
        const bytes = Math.min(partSize, file.size - start);
        const blob = file.slice(start, start + bytes);

        const etag = await withTransientRetry(async () => {
          const url = await pool.getUrl(partNumber, remaining.slice(idx + 1));
          try {
            const { etag: putEtag } = await putToMinio(url, blob, signal);
            if (!putEtag) {
              throw new Error(`MinIO returned no ETag for part ${partNumber} of ${asset.relativePath} — check bucket CORS ExposeHeaders`);
            }
            return putEtag;
          } catch (err) {
            // The presigned URL's own 1-hour expiry ran out (e.g. this
            // part sat behind a long pause) — a plain retry would just
            // hit the same dead URL forever; force the pool to fetch a
            // fresh one instead.
            if (err instanceof ApiError && err.status === 403) pool.invalidate(partNumber);
            throw err;
          }
        }, signal);

        doneParts.set(partNumber, etag);
        sent += bytes;
      }
    };
    await Promise.all(Array.from({ length: Math.min(PART_UPLOAD_CONCURRENCY, remaining.length) }, worker));
  } finally {
    clearInterval(flushTimer);
  }
  flush();

  onPatch(asset.relativePath, { status: "finalizing" });
  const parts = Array.from(doneParts.entries()).map(([partNumber, etag]) => ({ partNumber, etag }));
  await withTransientRetry(() => uploadService.multipartComplete(sessionId, parts, signal), signal);
  onPatch(asset.relativePath, { status: "done" });
}

/**
 * Every small file in a bundle (playlists, subtitles, segments — often
 * thousands per bundle) shares ONE flat worker pool at
 * SMALL_FILE_CONCURRENCY, rather than each getting its own worker slot
 * the way FILE_UPLOAD_CONCURRENCY does for the classic/large-file path —
 * each request here is cheap and latency-bound, so a much higher shared
 * concurrency is what actually helps (see the upload migration plan).
 * Progress per file is coarse (0% or 100%) since a single PUT is atomic —
 * no per-byte tracking needed the way the large-file path needs per-part.
 */
export async function uploadSmallAssetsDirect(
  resourceType: string,
  resourceId: string,
  assets: BundleUploadAsset[],
  signal: AbortSignal,
  onPatches: OnAssetPatches,
): Promise<void> {
  if (assets.length === 0) return;
  // Per-file status changes are batched (see PatchBatcher): one state update
  // per flush interval instead of one per file, for thousands of files.
  const batcher = new PatchBatcher(onPatches);
  let firstError: unknown = null;
  try {
    for (const asset of assets) batcher.add(asset.relativePath, { status: "uploading" });
    // Show every file as "uploading" straight away, as before.
    batcher.flush();

    const urlByPath = new Map<string, string>();
    for (let i = 0; i < assets.length; i += PRESIGN_BATCH_SIZE) {
      const batch = assets.slice(i, i + PRESIGN_BATCH_SIZE);
      const { files } = await withTransientRetry(
        () =>
          uploadService.presignBatch(
            resourceType,
            resourceId,
            batch.map((a) => ({ relativePath: a.relativePath, filesize: a.size })),
            signal,
          ),
        signal,
      );
      for (const f of files) urlByPath.set(f.relativePath, f.url);
    }

    let nextIndex = 0;
    const worker = async () => {
      for (;;) {
        const idx = nextIndex++;
        if (idx >= assets.length) return;
        const asset = assets[idx];
        try {
          const url = urlByPath.get(asset.relativePath);
          if (!url) throw new Error(`No presigned URL was issued for ${asset.relativePath}`);
          if (!asset.file) throw new Error(`${asset.relativePath} is not attached`);
          await withTransientRetry(() => putToMinio(url, asset.file!, signal), signal);
          batcher.add(asset.relativePath, { uploadedBytes: asset.size, status: "done" });
        } catch (err) {
          if (signal.aborted) throw err;
          firstError ??= err;
          batcher.add(asset.relativePath, { status: "error" });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SMALL_FILE_CONCURRENCY, assets.length) }, worker));
  } finally {
    // Final flush before returning OR throwing, so the last statuses (and
    // the "done" flags the queue persists for resume) are never lost.
    batcher.close();
  }
  if (firstError) throw firstError;
}

export interface UploadBundleDirectOptions {
  resourceType: string;
  resourceId: string;
  /** Only assets not already `done` are sent — a resumed job passes its full list and the finished ones are skipped here. */
  assets: BundleUploadAsset[];
  signal: AbortSignal;
  onPatches: OnAssetPatches;
}

/**
 * The large/small split from the queue's startUploadDirect(): the (usually
 * one) file at/above MULTIPART_THRESHOLD_BYTES goes through multipart, every
 * other file through the shared single-PUT pool, all concurrently. An abort
 * propagates immediately; any other failure marks that file `error`, lets
 * the rest finish, and then rethrows the FIRST error so the caller sees one
 * cause rather than a swallowed partial upload.
 */
export async function uploadBundleDirect({
  resourceType,
  resourceId,
  assets,
  signal,
  onPatches,
}: UploadBundleDirectOptions): Promise<void> {
  const pending = assets.filter((a) => a.status !== "done");
  const largeAssets = pending.filter((a) => a.size >= MULTIPART_THRESHOLD_BYTES);
  const smallAssets = pending.filter((a) => a.size < MULTIPART_THRESHOLD_BYTES);

  let firstError: unknown = null;
  await Promise.all([
    ...largeAssets.map((asset) =>
      uploadLargeAssetDirect(resourceType, resourceId, asset, signal, onPatches).catch((err) => {
        if (signal.aborted) throw err;
        firstError ??= err;
        patchOne(onPatches, asset.relativePath, { status: "error" });
      }),
    ),
    uploadSmallAssetsDirect(resourceType, resourceId, smallAssets, signal, onPatches).catch((err) => {
      if (signal.aborted) throw err;
      firstError ??= err;
    }),
  ]);
  if (firstError) throw firstError;
}
