import { apiClient } from "./apiClient";
import type { AccessType, Movie, MovieCategory, MovieStatus, MovieUploadFormValues } from "@/types/movie";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export interface MovieQuery extends PaginationParams {
  status?: MovieStatus;
  accessType?: AccessType;
  genre?: string;
  categoryId?: string;
  search?: string;
}

export const movieService = {
  getMovies(query: MovieQuery = {}) {
    return apiClient.get<PaginatedResponse<Movie>>("/movies", { params: query });
  },

  getMovieById(id: string) {
    return apiClient.get<Movie>(`/movies/${id}`);
  },

  getCategories() {
    return apiClient.get<MovieCategory[]>("/categories");
  },

  createCategory(name: string, description?: string) {
    return apiClient.post<MovieCategory>("/categories", { name, description });
  },

  updateCategory(id: string, values: { name?: string; description?: string }) {
    return apiClient.put<MovieCategory>(`/categories/${id}`, values);
  },

  deleteCategory(id: string) {
    return apiClient.delete<void>(`/categories/${id}`);
  },

  createMovie(values: MovieUploadFormValues, signal?: AbortSignal) {
    return apiClient.post<Movie>("/movies", values, { signal });
  },

  /**
   * Bootstraps a movie (or, with `series` set, an episode of a series) for
   * the bulk pre-transcoded upload flow — title (plus the runtime the browser
   * probed from the bundle, when it could), status UPLOADING. Everything else
   * is filled in later via updateMovie().
   *
   * `options.duration` is whole minutes and is only sent when >= 1: 0 is the
   * API's unknown sentinel and the DTO rejects it, so an unmeasured bundle
   * simply omits the field and the row is born with 0.
   */
  createUploadPlaceholder(
    title: string,
    series?: { seriesId: string; seasonNumber: number; episodeNumber: number },
    options?: { duration?: number },
    signal?: AbortSignal,
  ) {
    return apiClient.post<Movie>(
      "/movies/upload-placeholder",
      { title, ...series, ...(options?.duration ? { duration: options.duration } : {}) },
      { signal },
    );
  },

  /**
   * Fills Movie.duration for every title still at 0 that has a READY HLS
   * video, by summing the rendition playlist on the server. Idempotent —
   * only unknown values are written — and capped at 100 titles per call, so
   * a larger backlog is cleared by clicking again (`remaining` says how many
   * are left).
   */
  backfillDurations(limit?: number) {
    return apiClient.post<{
      scanned: number;
      updated: number;
      failed: { movieId: string; reason: string }[];
      remaining: number;
    }>("/movies/durations/backfill", limit ? { limit } : {});
  },

  updateMovie(
    id: string,
    values: Partial<MovieUploadFormValues> & {
      status?: MovieStatus;
      /** Episode position (episodes only) — which series it belongs to is not editable. */
      seasonNumber?: number;
      episodeNumber?: number;
    },
    signal?: AbortSignal,
  ) {
    return apiClient.put<Movie>(`/movies/${id}`, values, { signal });
  },

  deleteMovie(id: string) {
    return apiClient.delete<void>(`/movies/${id}`);
  },
};
