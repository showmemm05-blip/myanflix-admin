"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { getBookColumns } from "@/components/books/columns";
import { EditBookDialog } from "@/components/books/EditBookDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { bookService } from "@/services/api/bookService";
import { ApiError } from "@/services/api/apiClient";
import { languageLabel } from "@/lib/constants/book-options";
import type { Book, BookEdition, BookStatus, BookType } from "@/types/book";
import { toast } from "sonner";

const ALL = "all";

export default function BooksPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canCreate = can("BOOKS.CREATE");

  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  // The status filter asks for books with AT LEAST ONE language in that
  // status — a book has no single status any more, so "Processing" means
  // "something here is converting", not "all of it is".
  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      bookService.getBooks({
        limit: 100,
        type: typeFilter !== ALL ? (typeFilter as BookType) : undefined,
        status: statusFilter !== ALL ? (statusFilter as BookStatus) : undefined,
      }),
    [typeFilter, statusFilter],
  );
  const [books, setBooks] = useState<Book[] | null>(null);

  const activeBooks = books ?? data?.items ?? [];
  const isFiltered = typeFilter !== ALL || statusFilter !== ALL;

  const [editBook, setEditBook] = useState<Book | null>(null);
  const [deleteBook, setDeleteBook] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Publishing is per language and the row hands over the edition it acted
  // on, so a book with several finished translations publishes them one at a
  // time rather than all at once. Unlike the queue, nothing leaves this list
  // afterwards — the badge simply flips.
  const handlePublish = async (book: Book, edition: BookEdition) => {
    setPublishingId(edition.id);
    try {
      const updated = await bookService.updateEdition(book.id, edition.id, {
        status: "PUBLISHED",
      });
      setBooks(
        activeBooks.map((b) =>
          b.id === book.id
            ? {
                ...b,
                editions: b.editions.map((e) =>
                  e.id === edition.id ? updated : e,
                ),
              }
            : b,
        ),
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

  const handleDelete = async () => {
    if (!deleteBook) return;
    setDeleting(true);
    try {
      await bookService.deleteBook(deleteBook.id);
      setBooks(activeBooks.filter((b) => b.id !== deleteBook.id));
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

  const filters = (
    <div className="flex items-center gap-2">
      <Select
        value={typeFilter}
        onValueChange={(v) => {
          if (!v) return;
          setTypeFilter(v);
          setBooks(null);
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t.books.page.typeFilterPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t.books.page.allTypes}</SelectItem>
          <SelectItem value="EDITOR">{t.books.type.editor}</SelectItem>
          <SelectItem value="PDF">{t.books.type.pdf}</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={statusFilter}
        onValueChange={(v) => {
          if (!v) return;
          setStatusFilter(v);
          setBooks(null);
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t.books.page.statusFilterPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t.books.page.allStatuses}</SelectItem>
          <SelectItem value="DRAFT">{t.books.status.draft}</SelectItem>
          <SelectItem value="UPLOADING">{t.books.status.uploading}</SelectItem>
          <SelectItem value="PROCESSING">{t.books.status.processing}</SelectItem>
          <SelectItem value="READY">{t.books.status.ready}</SelectItem>
          <SelectItem value="PUBLISHED">{t.books.status.published}</SelectItem>
          <SelectItem value="FAILED">{t.books.status.failed}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

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

  const createButton = canCreate && (
    <Button render={<Link href="/books/new" />} nativeButton={false}>
      <Plus className="size-4" />
      {t.books.createBook}
    </Button>
  );

  if (error) {
    return (
      <RequirePermission
        permission="BOOKS.VIEW"
        title={t.books.page.title}
        description={t.books.page.description}
      >
        <div>
          <PageHeader
            title={t.books.page.title}
            description={t.books.page.description}
          />
          <ErrorState description={t.books.page.loadError} onRetry={refetch} />
        </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission
      permission="BOOKS.VIEW"
      title={t.books.page.title}
      description={t.books.page.description}
    >
      <div>
        <PageHeader
          title={t.books.page.title}
          description={t.books.page.description}
          actions={createButton}
        />

        {!isLoading && activeBooks.length === 0 && !isFiltered ? (
          <EmptyState
            icon={BookOpen}
            title={t.books.page.emptyTitle}
            description={t.books.page.emptyDescription}
            action={createButton}
          />
        ) : (
          <DataTable
            columns={columns}
            data={activeBooks}
            isLoading={isLoading}
            searchKey="title"
            toolbar={filters}
          />
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
