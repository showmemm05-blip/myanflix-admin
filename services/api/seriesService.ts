import { apiClient } from "./apiClient";
import type { AdminEpisode, SeasonSummary, Series, SeriesFormValues, SeriesListItem, SeriesStatus } from "@/types/series";
import type { AccessType, Movie, MovieStatus } from "@/types/movie";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export interface EpisodeQuery extends PaginationParams {
  seriesId?: string;
  seasonNumber?: number;
  status?: MovieStatus;
}

export interface SeriesQuery extends PaginationParams {
  accessType?: AccessType;
}

/** Result of DELETE /series/:id — episodes are cascade-deleted with the show. */
export interface SeriesRemovalResult {
  deletedEpisodes: number;
  storageCleanup: "complete" | "partial";
  failedObjects: string[];
}

export const seriesService = {
  getSeries(query: SeriesQuery = {}) {
    return apiClient.get<PaginatedResponse<SeriesListItem>>("/series", { params: query });
  },

  getSeriesById(id: string) {
    return apiClient.get<Series>(`/series/${id}`);
  },

  /** Which season numbers exist for this show, with per-season episode counts — seasons are implicit, not rows. */
  getSeasons(id: string) {
    return apiClient.get<SeasonSummary[]>(`/series/${id}/seasons`);
  },

  /** Episodes in playback order; staff see every status. */
  getEpisodes(id: string, seasonNumber?: number) {
    return apiClient.get<Movie[]>(`/series/${id}/episodes`, {
      params: seasonNumber !== undefined ? { seasonNumber } : {},
    });
  },

  /** Cross-series episode listing for the Series > Ready to Publish tab — staff only. */
  getEpisodesForAdmin(query: EpisodeQuery = {}) {
    return apiClient.get<PaginatedResponse<AdminEpisode>>("/series/episodes", { params: query });
  },

  createSeries(values: SeriesFormValues) {
    return apiClient.post<Series>("/series", values);
  },

  updateSeries(id: string, values: Partial<SeriesFormValues>) {
    return apiClient.put<Series>(`/series/${id}`, values);
  },

  /** Publish/unpublish the whole show — users only ever see PUBLISHED series. */
  updateStatus(id: string, status: SeriesStatus) {
    return apiClient.patch<Series>(`/series/${id}/status`, { status });
  },

  /**
   * Permanently removes the show AND all of its seasons/episodes (DB cascade),
   * then cleans up their MinIO objects. `storageCleanup` is "partial" when some
   * storage objects could not be removed — the DB delete still succeeded.
   */
  deleteSeries(id: string) {
    return apiClient.delete<SeriesRemovalResult>(`/series/${id}`);
  },
};
