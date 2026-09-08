import { apiClient } from "./apiClient";

export type VideoProcessingStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

export interface VideoStatusInfo {
  id: string;
  status: VideoProcessingStatus;
  failureReason: string | null;
  duration: number | null;
  resolution: string | null;
  hlsMasterPath: string | null;
  renditions: { resolution: string; playlistPath: string }[] | null;
  createdAt: string;
  updatedAt: string;
}

export const videoService = {
  getProcessingStatus(movieId: string, signal?: AbortSignal) {
    return apiClient.get<VideoStatusInfo>(`/videos/status/${movieId}`, { signal });
  },
};
