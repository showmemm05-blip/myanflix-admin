"use client";

import { useEffect, useState } from "react";
import { Feather, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { Button } from "@/components/ui/button";
import { getBookAuthorColumns } from "@/components/book-authors/columns";
import { BookAuthorFormDialog } from "@/components/book-authors/BookAuthorFormDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { bookAuthorService } from "@/services/api/bookAuthorService";
import { ApiError } from "@/services/api/apiClient";
import type { BookAuthor } from "@/types/bookAuthor";
import { toast } from "sonner";

/** Rows per server page — the list is paged on the server, so every author is reachable (not just the first 100). */
const PAGE_LIMIT = 25;

/**
 * Authors are book metadata, so the page is gated like the book categories:
 * BOOKS.VIEW to see it, BOOKS.CREATE / EDIT / DELETE for each action.
 */
export default function BookAuthorsPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canCreate = can("BOOKS.CREATE");
  const canEdit = can("BOOKS.EDIT");
  const canDelete = can("BOOKS.DELETE");

  // Search runs on the SERVER. The list is paginated, so filtering the loaded
  // page client-side would silently hide every match past the first page —
  // the endpoint's own ?search= is the only one that sees the whole library.
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = search.trim();
      if (next === appliedSearch) return;
      // A new search starts again from its first page.
      setPage(1);
      setAppliedSearch(next);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      bookAuthorService.getAuthors({
        page,
        limit: PAGE_LIMIT,
        search: appliedSearch || undefined,
      }),
    [appliedSearch, page],
  );
  const authors = data?.items ?? [];
  // Rows removed elsewhere can leave a later page empty: step back to the last page that has rows.
  useClampPage({
    page,
    pageSize: PAGE_LIMIT,
    rowCount: data?.items.length,
    total: data?.total,
    isLoading,
    onPageChange: setPage,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BookAuthor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookAuthor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (author: BookAuthor) => {
    setEditing(author);
    setFormOpen(true);
  };

  // Refetch rather than patch the row in place: `bookCount` is counted
  // server-side, and a rename doesn't change it — but a fresh list is the one
  // shape guaranteed to stay in step with what the backend just stored.
  const handleSaved = () => refetch();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bookAuthorService.deleteAuthor(deleteTarget.id);
      toast.success(t.bookAuthors.page.deletedToast);
      setDeleteTarget(null);
      // The last row of a later page was removed: step back a page instead
      // of showing an empty table.
      if (authors.length === 1 && page > 1) setPage(page - 1);
      else refetch();
    } catch (err) {
      // An author still credited on a book is refused with a 409 whose
      // message says how many. That is a rule, not a failure — name the
      // count so the admin knows what to reassign, and close the dialog.
      if (err instanceof ApiError && err.status === 409) {
        // The server's refusal carries the live count; the list's bookCount
        // may predate a book linked since it loaded.
        const liveCount = Number(/(\d+) book/.exec(err.message)?.[1]);
        toast.error(
          t.bookAuthors.page.deleteBlockedToast(
            Number.isFinite(liveCount) ? liveCount : deleteTarget.bookCount,
          ),
          {
            description: err.message,
          },
        );
        setDeleteTarget(null);
      } else {
        toast.error(t.bookAuthors.page.deleteFailedToast, {
          description: err instanceof ApiError ? err.message : t.movies.pleaseTryAgain,
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  const columns = getBookAuthorColumns({
    t,
    canEdit,
    canDelete,
    onEdit: openEdit,
    onDelete: setDeleteTarget,
  });

  const addButton = canCreate ? (
    <Button onClick={openCreate}>
      <Plus className="size-4" />
      {t.bookAuthors.page.add}
    </Button>
  ) : null;

  return (
    <RequirePermission
      permission="BOOKS.VIEW"
      title={t.bookAuthors.page.title}
      description={t.bookAuthors.page.description}
    >
      {error ? (
        <div>
          <PageHeader
            title={t.bookAuthors.page.title}
            description={t.bookAuthors.page.description}
          />
          <ErrorState description={t.bookAuthors.page.loadError} onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title={t.bookAuthors.page.title}
            description={t.bookAuthors.page.description}
            actions={addButton}
          />

          {/* The full-page empty state stands in only for a genuinely empty
              library — with a term typed the table (and the box being typed
              into) must stay mounted, showing its own no-results row. */}
          {!isLoading && authors.length === 0 && !search && page === 1 ? (
            <EmptyState
              icon={Feather}
              title={t.bookAuthors.page.emptyTitle}
              description={t.bookAuthors.page.emptyDescription}
              action={addButton}
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={authors}
                isLoading={isLoading}
                pageSize={PAGE_LIMIT}
                manualPagination
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder={t.bookAuthors.page.searchPlaceholder}
              />
              {!isLoading && data && (
                <ServerPagination page={page} pageSize={PAGE_LIMIT} total={data.total} onPageChange={setPage} />
              )}
            </>
          )}

          <BookAuthorFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            author={editing}
            onSaved={handleSaved}
          />

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title={t.bookAuthors.page.deleteTitle}
            description={
              deleteTarget ? t.bookAuthors.page.deleteDescription(deleteTarget.name) : ""
            }
            confirmLabel={t.common.delete}
            variant="destructive"
            loading={deleting}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </RequirePermission>
  );
}
