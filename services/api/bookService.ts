import { apiClient } from "./apiClient";
import type {
  Book,
  BookChapter,
  BookChapterSummary,
  BookDetail,
  BookEdition,
  BookFormValues,
  BookPage,
  BookPart,
  BookProcessingStatus,
  BookSection,
  BookStatus,
  BookType,
} from "@/types/book";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export interface BookQuery extends PaginationParams {
  /** Matches books having AT LEAST ONE edition in this status. */
  status?: BookStatus;
  /**
   * The review queue: a language not live yet that already holds a chapter a
   * reader could open. Not a `status` filter — editions are never put in
   * READY, that vocabulary belongs to chapters now.
   */
  readyToPublish?: boolean;
  /** Matches books available in this language. */
  language?: string;
  type?: BookType;
  categoryId?: string;
  search?: string;
}

export const bookService = {
  getBooks(query: BookQuery = {}) {
    return apiClient.get<PaginatedResponse<Book>>("/books", { params: query });
  },

  getBookById(id: string, signal?: AbortSignal) {
    return apiClient.get<BookDetail>(`/books/${id}`, { signal });
  },

  /** A book is born with its first language — `language` is required. */
  createBook(
    values: BookFormValues & { type: BookType; language: string },
    signal?: AbortSignal,
  ) {
    return apiClient.post<Book>("/books", values, { signal });
  },

  /** Metadata only. Status and language are per edition — see updateEdition. */
  updateBook(
    id: string,
    values: Partial<BookFormValues>,
    signal?: AbortSignal,
  ) {
    return apiClient.put<Book>(`/books/${id}`, values, { signal });
  },

  deleteBook(id: string) {
    return apiClient.delete<void>(`/books/${id}`);
  },

  // --- Editions (languages) --------------------------------------------

  /** Adds a language. 409s if the book already has that one. */
  addEdition(bookId: string, language: string, signal?: AbortSignal) {
    return apiClient.post<BookEdition>(
      `/books/${bookId}/editions`,
      { language },
      { signal },
    );
  },

  /**
   * Renames a language, or publishes/unpublishes it. Publishing is per
   * language — this is the only route that moves a book's visibility.
   */
  updateEdition(
    bookId: string,
    editionId: string,
    values: { language?: string; status?: BookStatus },
    signal?: AbortSignal,
  ) {
    return apiClient.put<BookEdition>(
      `/books/${bookId}/editions/${editionId}`,
      values,
      { signal },
    );
  },

  /** Removes a language with its chapters/pages. Refused for the last one. */
  deleteEdition(bookId: string, editionId: string) {
    return apiClient.delete<void>(`/books/${bookId}/editions/${editionId}`);
  },

  // --- PDF conversion ---------------------------------------------------

  /**
   * Start — or, after a failure, retry — ONE CHAPTER's PDF -> WebP
   * conversion. Each chapter is its own release with its own file, so they
   * convert independently and one failing never stalls the rest.
   */
  processChapter(
    bookId: string,
    editionId: string,
    chapterId: string,
    signal?: AbortSignal,
  ) {
    return apiClient.post<{ started: boolean }>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}/process`,
      undefined,
      { signal },
    );
  },

  /** Polled while a chapter converts — carries a real page-based percent. */
  getProcessingStatus(
    bookId: string,
    editionId: string,
    chapterId: string,
    signal?: AbortSignal,
  ) {
    return apiClient.get<BookProcessingStatus>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}/processing-status`,
      { signal },
    );
  },

  getPages(
    bookId: string,
    editionId: string,
    chapterId: string,
    signal?: AbortSignal,
  ) {
    return apiClient.get<BookPage[]>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}/pages`,
      { signal },
    );
  },

  // --- Chapters (EDITOR books) -----------------------------------------

  /** The chapter list of ONE language. */
  getChapters(bookId: string, editionId: string, signal?: AbortSignal) {
    return apiClient.get<BookChapterSummary[]>(
      `/books/${bookId}/editions/${editionId}/chapters`,
      { signal },
    );
  },

  getChapter(
    bookId: string,
    editionId: string,
    chapterId: string,
    signal?: AbortSignal,
  ) {
    return apiClient.get<BookChapter>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}`,
      { signal },
    );
  },

  createChapter(
    bookId: string,
    editionId: string,
    values: {
      title: string;
      content?: Record<string, unknown>;
      imageUrl?: string;
      /** Born straight into a part; omit for an unparted chapter. */
      partId?: string | null;
    },
    signal?: AbortSignal,
  ) {
    return apiClient.post<BookChapter>(
      `/books/${bookId}/editions/${editionId}/chapters`,
      values,
      { signal },
    );
  },

  updateChapter(
    bookId: string,
    editionId: string,
    chapterId: string,
    values: {
      title?: string;
      content?: Record<string, unknown>;
      imageUrl?: string;
      /** Undefined leaves the part alone; null moves the chapter out of its part. */
      partId?: string | null;
    },
    signal?: AbortSignal,
  ) {
    return apiClient.put<BookChapter>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}`,
      values,
      { signal },
    );
  },

  deleteChapter(bookId: string, editionId: string, chapterId: string) {
    return apiClient.delete<void>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}`,
    );
  },

  /** Sends EVERY chapter id of that language in its new order — the backend renumbers from the array. */
  reorderChapters(bookId: string, editionId: string, chapterIds: string[]) {
    return apiClient.patch<void>(
      `/books/${bookId}/editions/${editionId}/chapters/reorder`,
      { chapterIds },
    );
  },

  // --- Parts (optional grouping above chapters) -------------------------

  getParts(bookId: string, editionId: string, signal?: AbortSignal) {
    return apiClient.get<BookPart[]>(
      `/books/${bookId}/editions/${editionId}/parts`,
      { signal },
    );
  },

  createPart(
    bookId: string,
    editionId: string,
    title: string,
    signal?: AbortSignal,
  ) {
    return apiClient.post<BookPart>(
      `/books/${bookId}/editions/${editionId}/parts`,
      { title },
      { signal },
    );
  },

  updatePart(
    bookId: string,
    editionId: string,
    partId: string,
    values: { title?: string },
    signal?: AbortSignal,
  ) {
    return apiClient.put<BookPart>(
      `/books/${bookId}/editions/${editionId}/parts/${partId}`,
      values,
      { signal },
    );
  },

  /** The part's chapters are kept — they simply become unparted again. */
  deletePart(bookId: string, editionId: string, partId: string) {
    return apiClient.delete<void>(
      `/books/${bookId}/editions/${editionId}/parts/${partId}`,
    );
  },

  /** EVERY part id of that language in its new order, like reorderChapters. */
  reorderParts(bookId: string, editionId: string, partIds: string[]) {
    return apiClient.patch<void>(
      `/books/${bookId}/editions/${editionId}/parts/reorder`,
      { partIds },
    );
  },

  // --- Sections (optional subdivisions inside a chapter) ----------------

  getSections(
    bookId: string,
    editionId: string,
    chapterId: string,
    signal?: AbortSignal,
  ) {
    return apiClient.get<BookSection[]>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}/sections`,
      { signal },
    );
  },

  /**
   * A written section carries `content`; a PDF section carries `startPage`.
   * The backend refuses the wrong field for the book type.
   */
  createSection(
    bookId: string,
    editionId: string,
    chapterId: string,
    values: {
      title: string;
      content?: Record<string, unknown>;
      startPage?: number;
    },
    signal?: AbortSignal,
  ) {
    return apiClient.post<BookSection>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}/sections`,
      values,
      { signal },
    );
  },

  updateSection(
    bookId: string,
    editionId: string,
    chapterId: string,
    sectionId: string,
    values: {
      title?: string;
      content?: Record<string, unknown>;
      startPage?: number;
    },
    signal?: AbortSignal,
  ) {
    return apiClient.put<BookSection>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}/sections/${sectionId}`,
      values,
      { signal },
    );
  },

  deleteSection(
    bookId: string,
    editionId: string,
    chapterId: string,
    sectionId: string,
  ) {
    return apiClient.delete<void>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}/sections/${sectionId}`,
    );
  },

  /** Written chapters only — PDF sections are ordered by their start page. */
  reorderSections(
    bookId: string,
    editionId: string,
    chapterId: string,
    sectionIds: string[],
  ) {
    return apiClient.patch<void>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}/sections/reorder`,
      { sectionIds },
    );
  },
};
