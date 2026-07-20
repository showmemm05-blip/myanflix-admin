import { apiClient, API_ORIGIN } from "./apiClient";

export interface InitUploadResponse {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
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
  init(movieId: string, filename: string, filesize: number) {
    return apiClient.post<InitUploadResponse>("/uploads/init", { movieId, filename, filesize });
  },

  uploadChunk(uploadId: string, chunkNumber: number, chunk: Blob) {
    const formData = new FormData();
    formData.append("chunk", chunk, `chunk-${chunkNumber}`);
    return apiClient.post<UploadStatusResponse>(`/uploads/${uploadId}/chunk/${chunkNumber}`, formData);
  },

  getStatus(uploadId: string) {
    return apiClient.get<UploadStatusResponse>(`/uploads/${uploadId}/status`);
  },

  complete(uploadId: string) {
    return apiClient.post<CompleteUploadResponse>(`/uploads/${uploadId}/complete`);
  },

  /** Uploads an image and resolves its backend-relative path into an absolute URL (movie DTOs require @IsUrl()). */
  async uploadImage(file: File): Promise<{ url: string }> {
    const { url } = await apiClient.post<{ url: string }>("/uploads/image", (() => {
      const formData = new FormData();
      formData.append("file", file);
      return formData;
    })());
    return { url: url.startsWith("http") ? url : `${API_ORIGIN}${url}` };
  },
};
