import { apiClient, API_ORIGIN } from "./apiClient";

export interface InitUploadResponse {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  /** Chunks the backend already has for this exact movie/filename/size(/relativePath) — an interrupted upload resuming, not a fresh one. */
  uploadedChunks: number[];
}

export interface ReprocessResponse {
  videoId: string;
  status: string;
}

export interface FinalizeExternalUploadResponse {
  videoId: string;
  status: string;
}

export interface CompleteUploadResponse {
  videoId: string;
  status: string;
}

/** A file below the multipart size threshold — one presigned PUT, no server-side session. */
export interface PresignedFile {
  relativePath: string;
  key: string;
  url: string;
}

export interface PresignBatchResponse {
  files: PresignedFile[];
}

export interface MultipartUploadedPart {
  partNumber: number;
  etag: string;
  size: number;
}

export interface MultipartInitResponse {
  sessionId: string;
  key: string;
  partSize: number;
  totalParts: number;
  /** Parts MinIO has already durably received for this exact resource/key/size — never a client-side cache, always fresh from MinIO's own ListPartsCommand. */
  uploadedParts: MultipartUploadedPart[];
}

export interface MultipartPartUrl {
  partNumber: number;
  url: string;
}

export interface MultipartGetPartUrlsResponse {
  parts: MultipartPartUrl[];
}

export interface MultipartCompleteResponse {
  relativePath: string;
  status: string;
}

/**
 * The folder an uploaded image lands in: `images/<purpose>/<uuid><ext>`.
 * Mirrors IMAGE_PURPOSES in the backend's media-taxonomy registry — the
 * route rejects anything outside that list with a 400, so a typo here has
 * to be a compile error rather than a runtime one.
 *
 * `user` is deliberately absent: avatars are written by the backend itself
 * into `images/user/<userId>/`, and no staff upload may land there.
 */
export type ImagePurpose =
  | "actor"
  | "movie"
  | "series"
  | "book"
  | "bookauthor"
  | "category"
  | "payment"
  | "music"
  | "other";

export const uploadService = {
  /**
   * `relativePath` — the file's path INSIDE the dropped bundle, e.g.
   * "original.mp4", "hls/720p/index.m3u8", "subtitles/english.vtt" — switches
   * this upload into the externally-pre-transcoded flow: completeUpload() on
   * the backend uploads the merged file to storage and never runs ffmpeg or
   * creates a Video row. Omit it for the classic single-video-file flow.
   *
   * Send the bundle's own structure and nothing else: the final object key is
   * decided server-side by ResourceUploadTypeRegistry.buildKey, which is the
   * ONE place the storage layout lives. It is not a plain join — video assets
   * land at `videos/<movieId>/<relativePath>`, but a "subtitles/" path is an
   * uploaded SOURCE file and is routed out of the video prefix to
   * `subtitles/<movieId>/<basename>`. Nothing here has to know that, which is
   * exactly why a queue persisted in localStorage stays valid across a
   * backend deploy that moves a folder.
   */
  init(movieId: string, filename: string, filesize: number, relativePath?: string) {
    return apiClient.post<InitUploadResponse>("/uploads/init", { movieId, filename, filesize, relativePath });
  },

  // chunkNumber travels as a form field rather than part of the URL, so
  // every chunk in an upload hits the exact same endpoint — letting the
  // browser reuse one cached CORS preflight for the whole upload instead of
  // repeating it per chunk.
  // The backend returns 204 No Content — nothing to read back per chunk.
  uploadChunk(uploadId: string, chunkNumber: number, chunk: Blob, signal?: AbortSignal) {
    const formData = new FormData();
    formData.append("chunk", chunk, `chunk-${chunkNumber}`);
    formData.append("chunkNumber", String(chunkNumber));
    return apiClient.post<void>(`/uploads/${uploadId}/chunk`, formData, { signal });
  },

  complete(uploadId: string, signal?: AbortSignal) {
    return apiClient.post<CompleteUploadResponse>(`/uploads/${uploadId}/complete`, undefined, { signal });
  },

  /** Retries transcoding for a movie whose video failed — no re-upload required. */
  reprocess(movieId: string) {
    return apiClient.post<ReprocessResponse>(`/uploads/${movieId}/reprocess`);
  },

  /**
   * Runs automatically once a bundle upload finishes — never runs ffmpeg.
   * `relativePaths` is every file uploaded for the bundle; the backend
   * derives which renditions and subtitles exist from it, then moves the
   * movie to READY_TO_PUBLISH (or FAILED if the bundle is incomplete) — it
   * never publishes the movie itself.
   */
  finalizeExternalUpload(movieId: string, relativePaths: string[]) {
    return apiClient.post<FinalizeExternalUploadResponse>(`/uploads/${movieId}/finalize`, { relativePaths });
  },

  /**
   * Uploads an image and resolves its backend-relative path into an absolute
   * URL (movie DTOs require @IsUrl()).
   *
   * `purpose` is required and positional on purpose: it decides the storage
   * folder (`images/<purpose>/…`), the backend 400s without it, and making it
   * an optional options bag would let a new call site forget it and only fail
   * at runtime. This way tsc names every caller.
   */
  async uploadImage(file: File, purpose: ImagePurpose, signal?: AbortSignal): Promise<{ url: string }> {
    const { url } = await apiClient.post<{ url: string }>("/uploads/image", (() => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", purpose);
      return formData;
    })(), { signal });
    return { url: url.startsWith("http") ? url : `${API_ORIGIN}${url}` };
  },

  // --- Direct browser->MinIO upload (feature-flagged, see bulk-upload-context.tsx) ---
  // Everything below only ever issues presigned URLs / tracks minimal
  // session metadata through the backend — the actual bytes never pass
  // through it. The returned URLs point at MinIO's write-side proxy, not
  // this backend, and must be PUT to directly (see lib/upload/minio-put.ts),
  // bypassing apiClient entirely for that step (no JWT, no {success,data}
  // envelope — MinIO's own response shape).

  /** Presigned single-PUT URLs for files below the multipart threshold (playlists, subtitles, segments) — paginate `files` client-side rather than sending an entire bundle at once. */
  presignBatch(
    resourceType: string,
    resourceId: string,
    files: { relativePath: string; filesize: number }[],
    signal?: AbortSignal,
  ) {
    return apiClient.post<PresignBatchResponse>(
      "/uploads/presign-batch",
      { resourceType, resourceId, files },
      { signal },
    );
  },

  /** Resume-aware: an in-progress session for the exact same resource/key/size is reused, with `uploadedParts` (from MinIO, never a Postgres cache) telling the caller what to skip. */
  multipartInit(
    resourceType: string,
    resourceId: string,
    filename: string,
    filesize: number,
    relativePath: string,
    signal?: AbortSignal,
  ) {
    return apiClient.post<MultipartInitResponse>(
      "/uploads/multipart/init",
      { resourceType, resourceId, filename, filesize, relativePath },
      { signal },
    );
  },

  multipartGetPartUrls(sessionId: string, partNumbers: number[], signal?: AbortSignal) {
    return apiClient.post<MultipartGetPartUrlsResponse>(
      `/uploads/multipart/${sessionId}/parts`,
      { partNumbers },
      { signal },
    );
  },

  multipartComplete(
    sessionId: string,
    parts: { partNumber: number; etag: string }[],
    signal?: AbortSignal,
  ) {
    return apiClient.post<MultipartCompleteResponse>(
      `/uploads/multipart/${sessionId}/complete`,
      { parts },
      { signal },
    );
  },

  /** Fire-and-forget from the caller's perspective on Cancel — the backend aborts the MinIO-side upload and marks the session FAILED either way. */
  multipartAbort(sessionId: string) {
    return apiClient.post<void>(`/uploads/multipart/${sessionId}/abort`);
  },
};
