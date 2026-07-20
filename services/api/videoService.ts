import { apiClient } from "./apiClient";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { WatchHistoryEntry } from "@/types/user";

interface BackendWatchHistoryEntry {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string | null;
  durationMinutes: number | null;
  progress: number;
  lastPosition: number;
  updatedAt: string;
}

function mapWatchHistory(entry: BackendWatchHistoryEntry): WatchHistoryEntry {
  return {
    id: entry.id,
    movieId: entry.movieId,
    movieTitle: entry.movieTitle,
    posterUrl: entry.posterUrl,
    watchedAt: entry.updatedAt,
    progressPercent: Math.round(entry.progress),
    durationMinutes: entry.durationMinutes,
  };
}

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
  async getMyWatchHistory(pagination: PaginationParams = {}): Promise<PaginatedResponse<WatchHistoryEntry>> {
    const res = await apiClient.get<PaginatedResponse<BackendWatchHistoryEntry>>(
      "/videos/me/watch-history",
      { params: pagination },
    );
    return { ...res, items: res.items.map(mapWatchHistory) };
  },

  async getUserWatchHistory(
    userId: string,
    pagination: PaginationParams = {},
  ): Promise<PaginatedResponse<WatchHistoryEntry>> {
    const res = await apiClient.get<PaginatedResponse<BackendWatchHistoryEntry>>(
      `/users/${userId}/watch-history`,
      { params: pagination },
    );
    return { ...res, items: res.items.map(mapWatchHistory) };
  },

  getProcessingStatus(movieId: string) {
    return apiClient.get<VideoStatusInfo>(`/videos/status/${movieId}`);
  },

  getStreamInfo(movieId: string) {
    return apiClient.get<{ playlistUrl: string }>(`/videos/${movieId}/stream`);
  },
};
