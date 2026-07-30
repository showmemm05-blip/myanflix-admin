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

export interface ValidateExternalBundleResponse {
  missing: string[];
  /** Bundle doesn't match the fixed folder-structure contract (e.g. no original.mp4, no rendition folder) — distinct from files simply not having arrived yet. */
  structureErrors: string[];
  valid: boolean;
}

export interface PublishExternalVideoResponse {
  videoId: string;
  status: string;
}

export interface UploadStatusResponse {
  uploadedChunks: number[];
  remainingChunks: number;
  totalChunks: number;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
}

export interface CompleteUploadResponse {
  videoId: string;
  status: string;
}

export const uploadService = {
  /**
   * `relativePath` (e.g. "original.mp4", "hls/720p/index.m3u8") switches this
   * upload into the externally-pre-transcoded flow: completeUpload() on the
   * backend uploads the merged file straight to
   * `videos/<movieId>/<relativePath>` in storage and never runs ffmpeg or
   * creates a Video row — omit it for the classic single-video-file flow.
   */
  init(movieId: string, filename: string, filesize: number, relativePath?: string) {
    return apiClient.post<InitUploadResponse>("/uploads/init", { movieId, filename, filesize, relativePath });
  },

  // chunkNumber travels as a form field rather than part of the URL, so
  // every chunk in an upload hits the exact same endpoint — letting the
  // browser reuse one cached CORS preflight for the whole upload instead of
  // repeating it per chunk.
  uploadChunk(uploadId: string, chunkNumber: number, chunk: Blob, signal?: AbortSignal) {
    const formData = new FormData();
    formData.append("chunk", chunk, `chunk-${chunkNumber}`);
    formData.append("chunkNumber", String(chunkNumber));
    return apiClient.post<UploadStatusResponse>(`/uploads/${uploadId}/chunk`, formData, { signal });
  },

  getStatus(uploadId: string) {
    return apiClient.get<UploadStatusResponse>(`/uploads/${uploadId}/status`);
  },

  complete(uploadId: string) {
    return apiClient.post<CompleteUploadResponse>(`/uploads/${uploadId}/complete`);
  },

  /** Retries transcoding for a movie whose video failed — no re-upload required. */
  reprocess(movieId: string) {
    return apiClient.post<ReprocessResponse>(`/uploads/${movieId}/reprocess`);
  },

  /** Cross-checks an externally-pre-transcoded bundle's uploaded files against what's actually in storage. */
  validateExternalBundle(movieId: string, relativePaths: string[]) {
    return apiClient.post<ValidateExternalBundleResponse>(`/uploads/${movieId}/validate-external`, { relativePaths });
  },

  /**
   * Publishes a movie whose video was transcoded entirely externally — never
   * runs ffmpeg. `relativePaths` is every file uploaded for the bundle; the
   * backend derives which renditions and subtitles exist from it.
   */
  publishExternalVideo(movieId: string, relativePaths: string[]) {
    return apiClient.post<PublishExternalVideoResponse>(`/uploads/${movieId}/publish-external`, { relativePaths });
  },

  /** Uploads an image and resolves its backend-relative path into an absolute URL (movie DTOs require @IsUrl()). */
  async uploadImage(file: File, signal?: AbortSignal): Promise<{ url: string }> {
    const { url } = await apiClient.post<{ url: string }>("/uploads/image", (() => {
      const formData = new FormData();
      formData.append("file", file);
      return formData;
    })(), { signal });
    return { url: url.startsWith("http") ? url : `${API_ORIGIN}${url}` };
  },
};
