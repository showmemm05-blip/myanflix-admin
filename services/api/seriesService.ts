import { apiClient } from "./apiClient";
import type { AdminEpisode, SeasonSummary, Series, SeriesFormValues, SeriesListItem, SeriesStatus } from "@/types/series";
import type { AccessType, Movie, MovieStatus } from "@/types/movie";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export interface EpisodeQuery extends PaginationParams {
  seriesId?: string;
  seasonNumber?: number;
  status?: MovieStatus;
  /** Episode title or show title, matched server-side over the whole queue. */
  search?: string;
}

export interface SeriesQuery extends PaginationParams {
  accessType?: AccessType;
  /** Title or description, matched server-side. */
  search?: string;
}

/** The API's page-size ceiling (`@Max(100)`), used when a picker needs every row. */
const MAX_PAGE_LIMIT = 100;
/** Safety stop for `getAllSeries` — 5,000 shows, far past any real catalogue. */
const MAX_PICKER_PAGES = 50;

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

  /**
   * Every show, for a filter dropdown — walks GET /series page by page
   * instead of trusting one 100-row page to hold the whole catalogue (H-24).
   */
  async getAllSeries(): Promise<SeriesListItem[]> {
    const items: SeriesListItem[] = [];
    for (let page = 1; page <= MAX_PICKER_PAGES; page++) {
      const res = await seriesService.getSeries({ page, limit: MAX_PAGE_LIMIT });
      items.push(...res.items);
      if (res.items.length < MAX_PAGE_LIMIT || items.length >= res.total) break;
    }
    return items;
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
