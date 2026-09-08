import { apiClient } from "./apiClient";
import type { BookCategory } from "@/types/book";

export interface BookCategoryValues {
  name: string;
  description?: string;
}

/**
 * The books' own shelves. Deliberately NOT movieService.getCategories: books
 * have a separate taxonomy on the backend, so a genre invented for a manga
 * never turns up in the movie picker and vice versa.
 */
export const bookCategoryService = {
  getCategories(signal?: AbortSignal) {
    return apiClient.get<BookCategory[]>("/book-categories", { signal });
  },

  createCategory(values: BookCategoryValues, signal?: AbortSignal) {
    return apiClient.post<BookCategory>("/book-categories", values, { signal });
  },

  updateCategory(
    id: string,
    values: Partial<BookCategoryValues>,
    signal?: AbortSignal,
  ) {
    return apiClient.put<BookCategory>(`/book-categories/${id}`, values, {
      signal,
    });
  },

  deleteCategory(id: string) {
    return apiClient.delete<void>(`/book-categories/${id}`);
  },
};
