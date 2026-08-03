import { apiClient } from "./apiClient";
import type { SeasonSummary, Series, SeriesFormValues, SeriesListItem } from "@/types/series";
import type { Movie } from "@/types/movie";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export const seriesService = {
  getSeries(pagination: PaginationParams = {}) {
    return apiClient.get<PaginatedResponse<SeriesListItem>>("/series", { params: pagination });
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

  createSeries(values: SeriesFormValues) {
    return apiClient.post<Series>("/series", values);
  },

  updateSeries(id: string, values: Partial<SeriesFormValues>) {
    return apiClient.put<Series>(`/series/${id}`, values);
  },

  /** Removes only the show-level metadata — its episodes survive detached, still manageable from the movies table. */
  deleteSeries(id: string) {
    return apiClient.delete<void>(`/series/${id}`);
  },
};
