"use client";

import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, FileText, Loader2, Pencil, Rocket, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { languageLabel } from "@/lib/constants/book-options";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Book, BookEdition, BookStatus, BookType } from "@/types/book";

export const BOOK_STATUS_TONE: Record<BookStatus, StatusTone> = {
  DRAFT: "neutral",
  UPLOADING: "info",
  PROCESSING: "info",
  READY: "warning",
  PUBLISHED: "success",
  FAILED: "danger",
};

const FALLBACK_COVER = "https://picsum.photos/seed/myanflix-book/400/560";

/**
 * How many language badges a row shows before the rest collapse into "+N".
 * A book with a dozen translations must not be twice the height of its
 * neighbours.
 */
const MAX_VISIBLE_EDITIONS = 3;

/**
 * How many waiting languages get their own visible Publish button before
 * they collapse into one Publish button that opens a language chooser. Same
 * ceiling as the badges: three fits a row, a dozen does not.
 */
const MAX_INLINE_PUBLISH = 3;

export function getBookStatusLabel(
  t: TranslationShape,
  status: BookStatus,
): string {
  const labels: Record<BookStatus, string> = {
    DRAFT: t.books.status.draft,
    UPLOADING: t.books.status.uploading,
    PROCESSING: t.books.status.processing,
    READY: t.books.status.ready,
    PUBLISHED: t.books.status.published,
    FAILED: t.books.status.failed,
  };
  return labels[status];
}

export function getBookTypeLabel(t: TranslationShape, type: BookType): string {
  return type === "EDITOR" ? t.books.type.editor : t.books.type.pdf;
}

/**
 * Where a book's "open it" action goes. BOTH types are made of chapters now,
 * so there is ONE workspace: the written editor and the per-chapter PDF
 * conversion live on the same screen, chosen by the book's type once you are
 * in it.
 */
export function bookManageHref(book: Book): string {
  return `/books/${book.id}/chapters`;
}

/** "မြန်မာ · Published" — one language and what it is doing, in one badge. */
function editionLabel(t: TranslationShape, edition: BookEdition): string {
  return `${languageLabel(edition.language)} · ${getBookStatusLabel(t, edition.status)}`;
}

interface GetBookColumnsOptions {
  t: TranslationShape;
  /** BOOKS.EDIT — the Edit button. */
  canEdit: boolean;
  /** BOOKS.DELETE — the destructive button. */
  canDelete: boolean;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  /**
   * Opt-in, like the movies table's: when provided, a book with a READY
   * language shows a visible Publish button. Publishing is always an explicit
   * admin action, and always about one language.
   */
  onPublish?: (book: Book, edition: BookEdition) => void;
  /** Either the book id or the edition id, whichever the caller tracks. */
  publishingId?: string | null;
  /** BOOKS.PUBLISH — required on top of `onPublish` for the button to show. */
  canPublish?: boolean;
}

export function getBookColumns({
  t,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onPublish,
  publishingId,
  canPublish = false,
}: GetBookColumnsOptions): ColumnDef<Book>[] {
  const columns: ColumnDef<Book>[] = [
    {
      accessorKey: "title",
      header: t.books.columns.book,
      cell: ({ row }) => {
        const book = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image
                src={book.coverUrl ?? FALLBACK_COVER}
                alt={book.title}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <div className="min-w-0">
              <p className="max-w-52 truncate font-medium">{book.title}</p>
              <p className="max-w-52 truncate text-xs text-muted-foreground">
                {book.author}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: t.books.columns.type,
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-normal">
          {row.original.type === "EDITOR" ? (
            <BookOpen className="size-3.5" />
          ) : (
            <FileText className="size-3.5" />
          )}
          {getBookTypeLabel(t, row.original.type)}
        </Badge>
      ),
    },
    {
      // There is no single status any more: each language publishes on its
      // own, so the row shows every language with the state it is in.
      id: "languages",
      header: t.books.editions.title,
      cell: ({ row }) => {
        const editions = row.original.editions;
        if (editions.length === 0) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        const visible = editions.slice(0, MAX_VISIBLE_EDITIONS);
        const hidden = editions.slice(MAX_VISIBLE_EDITIONS);
        return (
          <div className="flex max-w-60 flex-wrap items-center gap-1">
            {visible.map((edition) => (
              <StatusBadge
                key={edition.id}
                label={editionLabel(t, edition)}
                tone={BOOK_STATUS_TONE[edition.status]}
              />
            ))}
            {hidden.length > 0 && (
              <Badge
                variant="secondary"
                className="font-normal"
                title={hidden.map((e) => editionLabel(t, e)).join(", ")}
              >
                +{hidden.length}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "size",
      header: t.books.columns.chapters,
      cell: ({ row }) => {
        const book = row.original;
        // Chapters belong to a language, and translations run at different
        // speeds — the row summarises the fullest language rather than adding
        // them up, which would claim a size the book never has. A PDF book is
        // counted in chapters too: each one is a release with its own file.
        const count = book.editions.reduce(
          (most, e) => Math.max(most, e.chapterCount),
          0,
        );
        return (
          <span className="text-sm tabular-nums text-muted-foreground">
            {count > 0
              ? `${count} ${t.books.columns.chapters.toLowerCase()}`
              : "—"}
          </span>
        );
      },
    },
  ];

  columns.push({
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const book = row.original;
      // Publishable = not live yet, and holding at least one chapter a
      // reader could open. Edition status alone cannot say this any more:
      // an edition sits in DRAFT until it is published, and readiness is a
      // fact about its chapters.
      const ready = book.editions.filter(
        (e) => e.status !== "PUBLISHED" && e.readyChapterCount > 0,
      );
      // The queue page keys its spinner by book id, a per-language caller by
      // edition id — accept either rather than force one on both.
      const isPublishing = (edition: BookEdition) =>
        publishingId != null &&
        (publishingId === book.id || publishingId === edition.id);
      const showPublish = canPublish && onPublish;
      return (
        <div className="flex items-center justify-end gap-2">
          {/* Up to three waiting languages each get their own visible
              Publish button — the language tag tells them apart. */}
          {showPublish &&
            ready.length >= 1 &&
            ready.length <= MAX_INLINE_PUBLISH &&
            ready.map((edition) => (
              <Button
                key={edition.id}
                size="sm"
                disabled={isPublishing(edition)}
                onClick={() => onPublish(book, edition)}
              >
                {isPublishing(edition) ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Rocket className="size-3.5" />
                )}
                {t.books.actions.publish}
                {book.editions.length > 1 && (
                  <span className="opacity-70">{languageLabel(edition.language)}</span>
                )}
              </Button>
            ))}
          {/* More than that would not fit a row: one Publish button opens a
              language chooser holding the same per-language items. */}
          {showPublish && ready.length > MAX_INLINE_PUBLISH && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 rounded-md"
                    aria-label={t.books.actions.publish}
                    title={t.books.actions.publish}
                  />
                }
              >
                <Rocket className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ready.map((edition) => (
                  <DropdownMenuItem
                    key={edition.id}
                    disabled={isPublishing(edition)}
                    onClick={() => onPublish(book, edition)}
                  >
                    <Rocket className="size-4" />
                    {t.books.actions.publish}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {languageLabel(edition.language)}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <RowActions>
            {/* One destination for both types: written chapters and PDF
                chapter conversion are the same workspace now. */}
            <RowActionButton
              icon={book.type === "EDITOR" ? BookOpen : FileText}
              label={t.books.actions.manageChapters}
              href={bookManageHref(book)}
            />
            {/* Retrying a conversion needs the CHAPTER it belongs to, and
                a row cannot know which one is stuck — the workspace above
                is where that decision is made. */}
            {canEdit && (
              <RowActionButton
                icon={Pencil}
                label={t.books.actions.edit}
                onClick={() => onEdit(book)}
              />
            )}
            {canDelete && (
              <RowActionButton
                icon={Trash2}
                label={t.books.actions.delete}
                destructive
                onClick={() => onDelete(book)}
              />
            )}
          </RowActions>
        </div>
      );
    },
  });

  return columns;
}
