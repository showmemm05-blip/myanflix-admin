import { apiClient } from "./apiClient";
import type { Movie, MovieCategory, MovieStatus, MovieUploadFormValues } from "@/types/movie";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { PurchaseEntry } from "@/types/user";

export interface MovieQuery extends PaginationParams {
  status?: MovieStatus;
  genre?: string;
  categoryId?: string;
  search?: string;
}

interface BackendPurchaseEntry {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string | null;
  amount: number;
  createdAt: string;
}

function mapPurchase(entry: BackendPurchaseEntry): PurchaseEntry {
  return {
    id: entry.id,
    movieId: entry.movieId,
    movieTitle: entry.movieTitle,
    posterUrl: entry.posterUrl,
    price: entry.amount,
    purchasedAt: entry.createdAt,
  };
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

  /** Bootstraps a movie for the bulk pre-transcoded upload flow — title only, status UPLOADING. Everything else is filled in later via updateMovie(). */
  createUploadPlaceholder(title: string, signal?: AbortSignal) {
    return apiClient.post<Movie>("/movies/upload-placeholder", { title }, { signal });
  },

  updateMovie(
    id: string,
    values: Partial<MovieUploadFormValues> & { status?: MovieStatus },
    signal?: AbortSignal,
  ) {
    return apiClient.put<Movie>(`/movies/${id}`, values, { signal });
  },

  deleteMovie(id: string) {
    return apiClient.delete<void>(`/movies/${id}`);
  },

  purchaseMovie(id: string) {
    return apiClient.post<{ id: string }>(`/movies/${id}/purchase`);
  },

  async getMyPurchases(pagination: PaginationParams = {}): Promise<PaginatedResponse<PurchaseEntry>> {
    const res = await apiClient.get<PaginatedResponse<BackendPurchaseEntry>>("/movies/me/purchases", {
      params: pagination,
    });
    return { ...res, items: res.items.map(mapPurchase) };
  },

  async getUserPurchases(userId: string, pagination: PaginationParams = {}): Promise<PaginatedResponse<PurchaseEntry>> {
    const res = await apiClient.get<PaginatedResponse<BackendPurchaseEntry>>(
      `/users/${userId}/purchases`,
      { params: pagination },
    );
    return { ...res, items: res.items.map(mapPurchase) };
  },
};
