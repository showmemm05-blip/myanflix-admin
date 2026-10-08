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
/** How many of those pages `getAllSeries` asks for at once. */
const PICKER_PARALLEL_PAGES = 6;

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
   * Page 1 says how many shows there are; the remaining pages (still capped
   * by MAX_PICKER_PAGES) are then fetched a few at a time in parallel rather
   * than strictly one after another, and joined back in page order.
   */
  async getAllSeries(): Promise<SeriesListItem[]> {
    const first = await seriesService.getSeries({ page: 1, limit: MAX_PAGE_LIMIT });
    const items: SeriesListItem[] = [...first.items];
    if (first.items.length < MAX_PAGE_LIMIT || items.length >= first.total) return items;

    const lastPage = Math.min(MAX_PICKER_PAGES, Math.ceil(first.total / MAX_PAGE_LIMIT));
    const rest = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
    for (let i = 0; i < rest.length; i += PICKER_PARALLEL_PAGES) {
      const pages = await Promise.all(
        rest
          .slice(i, i + PICKER_PARALLEL_PAGES)
          .map((page) => seriesService.getSeries({ page, limit: MAX_PAGE_LIMIT })),
      );
      for (const res of pages) items.push(...res.items);
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
