import { uploadSingleFileDirect } from "./upload-single-file";

/**
 * Uploads ONE book PDF straight to MinIO and reports byte progress.
 *
 * The transfer itself is `uploadSingleFileDirect` (upload-single-file.ts):
 * one file, no queue, no persistence, no cross-navigation survival, the
 * same presign/multipart protocol the bundle uploader speaks. What this
 * wrapper decides is only WHERE the file lands — the resource type and the
 * relative path below — exactly as it always has.
 */

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

export function uploadBookPdf({
  bookId,
  editionId,
  chapterId,
  file,
  onProgress,
  signal,
}: UploadBookPdfOptions): Promise<void> {
  return uploadSingleFileDirect({
    resourceType: RESOURCE_TYPE,
    resourceId: bookId,
    relativePath: pdfRelativePath(editionId, chapterId),
    file,
    onProgress,
    signal,
  });
}
