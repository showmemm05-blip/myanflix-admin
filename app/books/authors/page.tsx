"use client";

import { useEffect, useState } from "react";
import { Feather, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { getBookAuthorColumns } from "@/components/book-authors/columns";
import { BookAuthorFormDialog } from "@/components/book-authors/BookAuthorFormDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { bookAuthorService } from "@/services/api/bookAuthorService";
import { ApiError } from "@/services/api/apiClient";
import type { BookAuthor } from "@/types/bookAuthor";
import { toast } from "sonner";

const PAGE_LIMIT = 100;

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
  useEffect(() => {
    const handle = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      bookAuthorService.getAuthors({
        limit: PAGE_LIMIT,
        search: appliedSearch || undefined,
      }),
    [appliedSearch],
  );
  const authors = data?.items ?? [];

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
      refetch();
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
          {!isLoading && authors.length === 0 && !search ? (
            <EmptyState
              icon={Feather}
              title={t.bookAuthors.page.emptyTitle}
              description={t.bookAuthors.page.emptyDescription}
              action={addButton}
            />
          ) : (
            <DataTable
              columns={columns}
              data={authors}
              isLoading={isLoading}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={t.bookAuthors.page.searchPlaceholder}
            />
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
