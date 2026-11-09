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

/** The API's limit for `sourceName` on POST /movies/upload-placeholder (`@MaxLength(255)`). */
const SOURCE_NAME_MAX_LENGTH = 255;

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
   *
   * `options.sourceName` is the raw folder name of a standalone movie
   * (2026-11-06, the TMDB details): the server keeps it for staff, reads the
   * title and year the row is born with out of it, and later searches TMDB
   * with it — so the title in the answer can differ from the `title` sent
   * (`Inception 2010 1080p BluRay` comes back as `Inception`). Never sent for
   * an episode. It is cut to the API's 255 characters on whole characters: a
   * longer one would have the whole placeholder refused.
   */
  createUploadPlaceholder(
    title: string,
    series?: { seriesId: string; seasonNumber: number; episodeNumber: number },
    options?: { duration?: number; sourceName?: string },
    signal?: AbortSignal,
  ) {
    const sourceName = series
      ? ""
      : Array.from(options?.sourceName?.trim() ?? "").slice(0, SOURCE_NAME_MAX_LENGTH).join("");
    return apiClient.post<Movie>(
      "/movies/upload-placeholder",
      {
        title,
        ...series,
        ...(options?.duration ? { duration: options.duration } : {}),
        ...(sourceName ? { sourceName } : {}),
      },
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
