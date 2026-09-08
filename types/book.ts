import type { BookAuthorRef } from "./bookAuthor";

/**
 * `EDITOR` books are written in the dashboard's rich-text editor and are made
 * of chapters. `PDF` books are uploaded whole and converted page-by-page into
 * WebP images. The type is chosen once, at creation, and never changes — the
 * two share only their catalog metadata.
 */
export type BookType = "EDITOR" | "PDF";

/**
 * One lifecycle for both types. EDITOR books only ever move DRAFT <->
 * PUBLISHED; PDF books walk UPLOADING -> PROCESSING -> READY -> PUBLISHED,
 * with FAILED as the retryable dead end.
 */
export type BookStatus =
  | "DRAFT"
  | "UPLOADING"
  | "PROCESSING"
  | "READY"
  | "PUBLISHED"
  | "FAILED";

export interface BookCategoryRef {
  id: string;
  name: string;
}

/** A shelf in the book library — the books' OWN taxonomy, not the movies'. */
export interface BookCategory {
  id: string;
  name: string;
  description: string | null;
  bookCount: number;
}

/**
 * A chapter's own lifecycle, distinct from its edition's publish state. A
 * written chapter is READY as soon as it has text; a PDF chapter carries its
 * own file and walks UPLOADING -> PROCESSING -> READY (or FAILED).
 */
export type ChapterStatus =
  | "DRAFT"
  | "UPLOADING"
  | "PROCESSING"
  | "READY"
  | "FAILED";

/**
 * ONE LANGUAGE of a book, and the unit that actually holds content.
 *
 * The book is the work — title, author, cover, categories — and every
 * chapter, page and lifecycle state belongs to an edition beneath it. That
 * is why publishing is per language: a finished Burmese translation goes
 * live while the English one is still converting.
 */
export interface BookEdition {
  id: string;
  /** A code, e.g. "my" or "en" — see lib/constants/book-options.ts. */
  language: string;
  status: BookStatus;
  publishedAt: string | null;
  /** Chapters in this language — BOTH book types have them now. */
  chapterCount: number;
  /**
   * Chapters a reader could actually open. This — not chapterCount — is what
   * makes a language publishable: an edition goes live on its FIRST ready
   * chapter, so a serialised title publishes while later chapters convert.
   */
  readyChapterCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  title: string;
  /** The denormalised display name — always equal to `authorRef.name` once linked. */
  author: string;
  /** Null only on rows that predate managed authors. */
  authorId: string | null;
  authorRef: BookAuthorRef | null;
  description: string;
  coverUrl: string | null;
  type: BookType;
  categories: BookCategoryRef[];
  /** Every language this book exists in, ordered by code. Never empty. */
  editions: BookEdition[];
  /** Their codes, in the same order. */
  languages: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Chapter as it arrives in a list — no `content` (that has its own request).
 * A PDF chapter's conversion numbers ride along so a chapter list can show
 * progress per row without a request each.
 */
export interface BookChapterSummary {
  id: string;
  title: string;
  order: number;
  /** Optional cover for the chapter — available to both book types. */
  imageUrl: string | null;
  status: ChapterStatus;
  /** PDF chapters — pages the file reports. 0 until probed. */
  pageCount: number;
  /** PDF chapters — pages converted so far. */
  processedPages: number;
  processingError: string | null;
  pdfFileSize: number | null;
  /** The part this chapter sits in; null for every chapter of a part-less book. */
  partId: string | null;
  /**
   * The chapter's reading-order number as the server derives it ("3") —
   * continuous across parts, never stored, so no client recomputes it.
   */
  number: string;
  sections: BookSectionSummary[];
}

/** GET /books/:id. Chapters hang off an edition, so they are fetched per language. */
export type BookDetail = Book;

/** A chapter with its ProseMirror document — what the editor loads and saves. */
export interface BookChapter extends BookChapterSummary {
  editionId: string;
  /** NULL on a PDF chapter, whose content is its converted pages. */
  content: Record<string, unknown> | null;
  /** With content — the detail route carries the sections' own documents. */
  sections: BookSection[];
  createdAt: string;
  updatedAt: string;
}

/**
 * An optional grouping of chapters ("Part One") inside ONE edition. Purely
 * structural — it owns no content — and `number` is its position, derived
 * by the server.
 */
export interface BookPart {
  id: string;
  editionId: string;
  title: string;
  order: number;
  number: number;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A subdivision inside a chapter as a table of contents lists it. `number`
 * is "3.1". A PDF section is a page anchor: it starts at `startPage` and
 * runs to `endPage`, which the server derives from the next section's
 * start. A written section has null pages.
 */
export interface BookSectionSummary {
  id: string;
  chapterId: string;
  title: string;
  order: number;
  number: string;
  startPage: number | null;
  endPage: number | null;
}

/** A section with its own ProseMirror document (written books only). */
export interface BookSection extends BookSectionSummary {
  content: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The admin credits an author by id only; the backend copies the row's name
 * into `Book.author` so every reader keeps its string.
 */
export interface BookFormValues {
  title: string;
  authorId: string;
  description: string;
  categoryIds: string[];
  coverUrl?: string;
}

/** Polled while ONE CHAPTER converts — conversion is per chapter now. */
export interface BookProcessingStatus {
  id: string;
  title: string;
  order: number;
  status: ChapterStatus;
  pageCount: number;
  processedPages: number;
  /** Server-computed, so the admin shows real progress rather than a time-based guess. */
  percent: number;
  processingError: string | null;
  pdfFileSize: number | null;
  updatedAt: string;
}

/** One converted page — width/height let a reader reserve space before the image loads. */
export interface BookPage {
  pageNumber: number;
  url: string;
  width: number;
  height: number;
}
