import { ApiError } from "@/services/api/apiClient";
import { uploadService } from "@/services/api/uploadService";
import { withTransientRetry } from "./bundle-upload";
import { PresignedPartUrlPool } from "./presigned-part-pool";
import { putToMinio } from "./minio-put";

/**
 * Uploads ONE file straight to MinIO under a resource type the backend's
 * ResourceUploadTypeRegistry knows, and reports byte progress.
 *
 * This is the bulk-upload context's `uploadLargeAssetDirect` reduced to the
 * one shape a single-file form needs: no queue, no persistence, no
 * cross-navigation survival. It was the body of upload-book-pdf.ts until
 * the ad video (2026-11-03) needed the exact same thing under another
 * resource type; the two wrappers now only decide the resource type and
 * the relative path. The wire protocol (multipart init -> pooled presigned
 * part URLs -> direct PUTs -> complete, with transient retry) is
 * deliberately identical to the bundle uploader's, because that is what the
 * backend implements.
 */

// Transient-error retry (5 attempts, 500 ms doubling to at most 8 s) is the
// shared withTransientRetry from bundle-upload.ts — the same policy this file
// used to declare a copy of.
const PART_UPLOAD_CONCURRENCY = 4;
const PROGRESS_FLUSH_INTERVAL_MS = 250;

/** Matches MultipartUploadService.MULTIPART_PART_SIZE; below it, one presigned PUT is enough. */
const MULTIPART_THRESHOLD_BYTES = 32 * 1024 * 1024;

export interface UploadSingleFileOptions {
  /** A ResourceUploadTypeRegistry type ("book", "ad"): decides the permission and the key prefix server-side. */
  resourceType: string;
  resourceId: string;
  /** The file's path under the resource's prefix — the registry's buildKey turns it into the object key. */
  relativePath: string;
  file: File;
  /** Called with 0-100 as bytes land, throttled to ~4x a second. */
  onProgress?: (percent: number) => void;
  /**
   * Called with the multipart session id as soon as one is opened (files at
   * or above the multipart threshold only), so a Cancel can tell the
   * backend to abort the MinIO-side upload — a live UploadId is real
   * server-side state the browser's abort alone cannot reach.
   */
  onSession?: (sessionId: string) => void;
  signal: AbortSignal;
}

export async function uploadSingleFileDirect({
  resourceType,
  resourceId,
  relativePath,
  file,
  onProgress,
  onSession,
  signal,
}: UploadSingleFileOptions): Promise<void> {
  if (file.size < MULTIPART_THRESHOLD_BYTES) {
    const { files } = await withTransientRetry(
      () =>
        uploadService.presignBatch(
          resourceType,
          resourceId,
          [{ relativePath, filesize: file.size }],
          signal,
        ),
      signal,
    );
    const target = files[0];
    if (!target) throw new Error("The backend issued no upload URL for this file");

    onProgress?.(0);
    await withTransientRetry(() => putToMinio(target.url, file, signal), signal);
    onProgress?.(100);
    return;
  }

  const { sessionId, partSize, totalParts, uploadedParts } =
    await withTransientRetry(
      () =>
        uploadService.multipartInit(
          resourceType,
          resourceId,
          file.name,
          file.size,
          relativePath,
          signal,
        ),
      signal,
    );
  onSession?.(sessionId);

  // Parts MinIO already holds — a resumed upload skips them entirely.
  const doneParts = new Map(uploadedParts.map((p) => [p.partNumber, p.etag]));
  let sent = 0;
  for (const partNumber of doneParts.keys()) {
    sent += Math.min(partSize, file.size - (partNumber - 1) * partSize);
  }

  // Progress is flushed on a timer rather than per part, so a fast
  // connection doesn't spend its time re-rendering instead of sending.
  let lastFlushed = -1;
  const flush = () => {
    const percent = Math.min(100, Math.round((sent / file.size) * 100));
    if (percent === lastFlushed) return;
    lastFlushed = percent;
    onProgress?.(percent);
  };
  flush();
  const flushTimer = setInterval(flush, PROGRESS_FLUSH_INTERVAL_MS);

  const pool = new PresignedPartUrlPool(sessionId, PART_UPLOAD_CONCURRENCY);
  const remaining = Array.from({ length: totalParts }, (_, i) => i + 1).filter(
    (n) => !doneParts.has(n),
  );

  try {
    let nextIndex = 0;
    const worker = async () => {
      for (;;) {
        const index = nextIndex++;
        if (index >= remaining.length) return;
        const partNumber = remaining[index];
        const start = (partNumber - 1) * partSize;
        const bytes = Math.min(partSize, file.size - start);
        const blob = file.slice(start, start + bytes);

        const etag = await withTransientRetry(async () => {
          const url = await pool.getUrl(partNumber, remaining.slice(index + 1));
          try {
            const { etag: putEtag } = await putToMinio(url, blob, signal);
            if (!putEtag) {
              throw new Error(
                `MinIO returned no ETag for part ${partNumber} — check bucket CORS ExposeHeaders`,
              );
            }
            return putEtag;
          } catch (err) {
            // The presigned URL's 1-hour expiry ran out; retrying the same
            // dead URL would loop forever, so force a fresh one.
            if (err instanceof ApiError && err.status === 403)
              pool.invalidate(partNumber);
            throw err;
          }
        }, signal);

        doneParts.set(partNumber, etag);
        sent += bytes;
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(PART_UPLOAD_CONCURRENCY, remaining.length) },
        worker,
      ),
    );
  } finally {
    clearInterval(flushTimer);
  }
  flush();

  const parts = Array.from(doneParts.entries()).map(([partNumber, etag]) => ({
    partNumber,
    etag,
  }));
  await withTransientRetry(
    () => uploadService.multipartComplete(sessionId, parts, signal),
    signal,
  );
  onProgress?.(100);
}
