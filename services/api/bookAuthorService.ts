import { apiClient } from "./apiClient";
import type { BookAuthor, BookAuthorFormValues } from "@/types/bookAuthor";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export interface BookAuthorQuery extends PaginationParams {
  /** Matches on name — what the author picker types into. */
  search?: string;
}

export const bookAuthorService = {
  getAuthors(query: BookAuthorQuery = {}, signal?: AbortSignal) {
    return apiClient.get<PaginatedResponse<BookAuthor>>("/book-authors", {
      params: query,
      signal,
    });
  },

  createAuthor(values: BookAuthorFormValues, signal?: AbortSignal) {
    return apiClient.post<BookAuthor>("/book-authors", values, { signal });
  },

  updateAuthor(
    id: string,
    values: Partial<BookAuthorFormValues>,
    signal?: AbortSignal,
  ) {
    return apiClient.put<BookAuthor>(`/book-authors/${id}`, values, { signal });
  },

  /** 409 when the author is still credited on a book — the message names the count. */
  deleteAuthor(id: string) {
    return apiClient.delete<void>(`/book-authors/${id}`);
  },
};
