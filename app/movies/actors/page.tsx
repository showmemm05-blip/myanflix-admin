"use client";

import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { getActorColumns } from "@/components/actors/columns";
import { ActorFormDialog } from "@/components/actors/ActorFormDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { actorService } from "@/services/api/actorService";
import { ApiError } from "@/services/api/apiClient";
import type { Actor } from "@/types/actor";
import { toast } from "sonner";

const PAGE_LIMIT = 100;

export default function ActorsPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canCreate = can("ACTORS.CREATE");
  const canEdit = can("ACTORS.EDIT");
  const canDelete = can("ACTORS.DELETE");

  // Search runs on the SERVER. The list is paginated, so filtering the loaded
  // page client-side would silently hide every match past the first page —
  // the endpoint's own ?search= is the only one that sees the whole catalog.
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () => actorService.getActors({ limit: PAGE_LIMIT, search: appliedSearch || undefined }),
    [appliedSearch],
  );
  const actors = data?.items ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Actor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Actor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (actor: Actor) => {
    setEditing(actor);
    setFormOpen(true);
  };

  // Refetch rather than patch the row in place: `movieCount` is counted
  // server-side, and a rename doesn't change it — but a fresh list is the one
  // shape guaranteed to stay in step with what the backend just stored.
  const handleSaved = () => refetch();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await actorService.deleteActor(deleteTarget.id);
      toast.success(t.actors.page.deletedToast);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(t.actors.page.deleteFailedToast, {
        description: err instanceof ApiError ? err.message : t.movies.pleaseTryAgain,
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = getActorColumns({
    t,
    canEdit,
    canDelete,
    onEdit: openEdit,
    onDelete: setDeleteTarget,
  });

  const addButton = canCreate ? (
    <Button onClick={openCreate}>
      <Plus className="size-4" />
      {t.actors.page.add}
    </Button>
  ) : null;

  return (
    <RequirePermission
      permission="ACTORS.VIEW"
      title={t.actors.page.title}
      description={t.actors.page.description}
    >
      {error ? (
        <div>
          <PageHeader title={t.actors.page.title} description={t.actors.page.description} />
          <ErrorState description={t.actors.page.loadError} onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title={t.actors.page.title}
            description={t.actors.page.description}
            actions={addButton}
          />

          {/* The full-page empty state stands in only for a genuinely empty
              catalog — with a term typed the table (and the box being typed
              into) must stay mounted, showing its own no-results row. */}
          {!isLoading && actors.length === 0 && !search ? (
            <EmptyState
              icon={Users}
              title={t.actors.page.emptyTitle}
              description={t.actors.page.emptyDescription}
              action={addButton}
            />
          ) : (
            <DataTable
              columns={columns}
              data={actors}
              isLoading={isLoading}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={t.actors.page.searchPlaceholder}
            />
          )}

          <ActorFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            actor={editing}
            onSaved={handleSaved}
          />

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title={t.actors.page.deleteTitle}
            description={deleteTarget ? t.actors.page.deleteDescription(deleteTarget.name) : ""}
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
