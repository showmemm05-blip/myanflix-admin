import { ApiError } from "@/services/api/apiClient";
import { uploadService } from "@/services/api/uploadService";
import { PresignedPartUrlPool } from "./presigned-part-pool";
import { putToMinio } from "./minio-put";

/**
 * Uploads ONE book PDF straight to MinIO and reports byte progress.
 *
 * This is the bulk-upload context's `uploadLargeAssetDirect` reduced to the
 * one shape books need: a single file, no queue, no persistence, no
 * cross-navigation survival. Book uploads are one file at a time from a
 * form the admin is looking at, so the queue machinery movies need would be
 * all cost and no benefit — but the wire protocol (multipart init -> pooled
 * presigned part URLs -> direct PUTs -> complete, with transient retry) is
 * deliberately identical, because that is what the backend implements.
 */

const RETRY_ATTEMPTS = 5;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 8000;
const PART_UPLOAD_CONCURRENCY = 4;
const PROGRESS_FLUSH_INTERVAL_MS = 250;

/** Matches MultipartUploadService.MULTIPART_PART_SIZE; below it, one presigned PUT is enough. */
const MULTIPART_THRESHOLD_BYTES = 32 * 1024 * 1024;

/** ResourceUploadTypeRegistry's "book" entry keys off this, and writes to documents/books/<bookId>/<relativePath>. */
const RESOURCE_TYPE = "book";

/**
 * Every CHAPTER has its own PDF now — a chapter is a release — so both the
 * edition and the chapter are part of the path rather than part of the
 * resource id. The registry still resolves the resource by BOOK id, which is
 * what keeps the whole title under one key prefix so deleting a book still
 * cleans every language and chapter in a single sweep. This string stays
 * exactly what it always was: the source-vs-generated split lives entirely
 * server-side, where the registry prefixes it with `documents/` so the
 * uploaded PDF sits apart from the reader pages generated from it. The
 * result matches StorageService.bookPdfKey exactly:
 * `documents/books/<bookId>/<editionId>/<chapterId>/original.pdf`.
 */
const pdfRelativePath = (editionId: string, chapterId: string) =>
  `${editionId}/${chapterId}/original.pdf`;

/** See bulk-upload-context.tsx's isTransient — same classification, same reasons. */
function isTransient(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return false;
  if (err instanceof ApiError)
    return err.status >= 500 || err.status === 408 || err.status === 429;
  if (err instanceof TypeError) return true;
  return false;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function withTransientRetry<T>(
  fn: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (signal.aborted || !isTransient(err) || attempt >= RETRY_ATTEMPTS)
        throw err;
      const backoff = Math.min(
        RETRY_BASE_MS * 2 ** (attempt - 1),
        RETRY_MAX_MS,
      );
      await sleep(backoff, signal);
    }
  }
}

export interface UploadBookPdfOptions {
  bookId: string;
  /** The language this PDF belongs to. */
  editionId: string;
  /** The chapter it is a release of — each chapter has its own file. */
  chapterId: string;
  file: File;
  /** Called with 0-100 as bytes land, throttled to ~4x a second. */
  onProgress?: (percent: number) => void;
  signal: AbortSignal;
}

export async function uploadBookPdf({
  bookId,
  editionId,
  chapterId,
  file,
  onProgress,
  signal,
}: UploadBookPdfOptions): Promise<void> {
  const relativePath = pdfRelativePath(editionId, chapterId);

  if (file.size < MULTIPART_THRESHOLD_BYTES) {
    const { files } = await withTransientRetry(
      () =>
        uploadService.presignBatch(
          RESOURCE_TYPE,
          bookId,
          [{ relativePath, filesize: file.size }],
          signal,
        ),
      signal,
    );
    const target = files[0];
    if (!target) throw new Error("The backend issued no upload URL for this PDF");

    onProgress?.(0);
    await withTransientRetry(() => putToMinio(target.url, file, signal), signal);
    onProgress?.(100);
    return;
  }

  const { sessionId, partSize, totalParts, uploadedParts } =
    await withTransientRetry(
      () =>
        uploadService.multipartInit(
          RESOURCE_TYPE,
          bookId,
          file.name,
          file.size,
          relativePath,
          signal,
        ),
      signal,
    );

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
