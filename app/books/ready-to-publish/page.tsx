"use client";

import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { getBookColumns } from "@/components/books/columns";
import { EditBookDialog } from "@/components/books/EditBookDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { bookService } from "@/services/api/bookService";
import { ApiError } from "@/services/api/apiClient";
import { languageLabel } from "@/lib/constants/book-options";
import type { Book, BookEdition } from "@/types/book";
import { toast } from "sonner";

/**
 * The books review queue — really a queue of LANGUAGES. A book lands here as
 * soon as one of its editions reaches READY (a PDF fully converted, or an
 * editor language with chapters) and waits for an explicit publish; nothing
 * in either workflow ever publishes on its own.
 *
 * Because publishing is per language, the same book can sit in this queue
 * with its English edition waiting while Burmese is already live — so every
 * action here names the language it applies to.
 */
/** Rows per server page (H-24): the queue is paged and searched on the server. */
const PAGE_LIMIT = 25;

export default function BooksReadyToPublishPage() {
  const { t } = useLanguage();
  const { can } = useRole();

  const [page, setPage] = useState(1);
  const [books, setBooks] = useState<Book[] | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = search.trim().slice(0, 100);
      if (next === appliedSearch) return;
      setBooks(null);
      setPage(1);
      setAppliedSearch(next);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      bookService.getBooks({
        readyToPublish: true,
        page,
        limit: PAGE_LIMIT,
        search: appliedSearch || undefined,
      }),
    [appliedSearch, page],
  );

  const activeBooks = books ?? data?.items ?? [];
  // Rows that left the queue on this page since the fetch leave the total too.
  const total = data ? data.total + activeBooks.length - data.items.length : 0;

  const handlePageChange = (next: number) => {
    setBooks(null);
    setPage(next);
  };

  // Emptying the page by hand reloads (or steps back one page) so the next
  // batch shows instead of a false "nothing waiting".
  const showQueue = (next: Book[]) => {
    if (next.length > 0) {
      setBooks(next);
      return;
    }
    setBooks(null);
    if (page > 1) setPage(page - 1);
    else refetch();
  };

  const [editBook, setEditBook] = useState<Book | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deleteBook, setDeleteBook] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteBook) return;
    setDeleting(true);
    try {
      await bookService.deleteBook(deleteBook.id);
      showQueue(activeBooks.filter((b) => b.id !== deleteBook.id));
      toast.success(t.books.page.deletedToast, {
        description: t.books.page.deletedDescription(deleteBook.title),
      });
      setDeleteBook(null);
    } catch (err) {
      toast.error(t.books.page.deleteFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePublish = async (book: Book, edition: BookEdition) => {
    setPublishingId(edition.id);
    try {
      const updated = await bookService.updateEdition(book.id, edition.id, {
        status: "PUBLISHED",
      });
      // Publishing one language does not finish the book: another edition may
      // still be waiting, so the row only leaves the queue once nothing in it
      // is READY any more.
      showQueue(
        activeBooks
          .map((b) =>
            b.id === book.id
              ? {
                  ...b,
                  editions: b.editions.map((e) =>
                    e.id === edition.id ? updated : e,
                  ),
                }
              : b,
          )
          .filter((b) => b.editions.some((e) => e.status === "READY")),
      );
      toast.success(t.books.publishedToast, {
        description: t.books.publishedDescription(
          `${book.title} (${languageLabel(edition.language)})`,
        ),
      });
    } catch (err) {
      toast.error(t.books.publishFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setPublishingId(null);
    }
  };

  const columns = getBookColumns({
    t,
    canEdit: can("BOOKS.EDIT"),
    canDelete: can("BOOKS.DELETE"),
    onEdit: setEditBook,
    onDelete: setDeleteBook,
    onPublish: handlePublish,
    publishingId,
    canPublish: can("BOOKS.PUBLISH"),
  });

  if (error) {
    return (
      <RequirePermission
        permission="BOOKS.PUBLISH"
        title={t.books.readyToPublish.title}
        description={t.books.readyToPublish.description}
      >
        <div>
          <PageHeader title={t.books.readyToPublish.title} />
          <ErrorState
            description={t.books.readyToPublish.loadError}
            onRetry={refetch}
          />
        </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission
      permission="BOOKS.PUBLISH"
      title={t.books.readyToPublish.title}
      description={t.books.readyToPublish.description}
    >
      <div>
        <PageHeader
          title={t.books.readyToPublish.title}
          description={t.books.readyToPublish.description}
        />

        {!isLoading && total === 0 && !search ? (
          <EmptyState
            icon={Rocket}
            title={t.books.readyToPublish.emptyTitle}
            description={t.books.readyToPublish.emptyDescription}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={activeBooks}
              isLoading={isLoading}
              pageSize={PAGE_LIMIT}
              manualPagination
              searchValue={search}
              onSearchChange={setSearch}
            />
            {!isLoading && (
              <ServerPagination page={page} pageSize={PAGE_LIMIT} total={total} onPageChange={handlePageChange} />
            )}
          </>
        )}

        <EditBookDialog
          book={editBook}
          open={!!editBook}
          onOpenChange={(o) => !o && setEditBook(null)}
          onSaved={(updated) =>
            setBooks(activeBooks.map((b) => (b.id === updated.id ? updated : b)))
          }
        />

        <ConfirmDialog
          open={!!deleteBook}
          onOpenChange={(o) => !o && setDeleteBook(null)}
          title={t.books.page.deleteTitle}
          description={
            deleteBook ? t.books.page.deleteDescription(deleteBook.title) : ""
          }
          confirmLabel={t.common.delete}
          variant="destructive"
          loading={deleting}
          onConfirm={handleDelete}
        />
      </div>
    </RequirePermission>
  );
}
