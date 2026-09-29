"use client";

import { useEffect, useState } from "react";
import { Plus, Tv } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { getSeriesColumns } from "@/components/series/columns";
import { SeriesFormDialog } from "@/components/series/SeriesFormDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { seriesService } from "@/services/api/seriesService";
import type { AccessType } from "@/types/movie";
import type { Series, SeriesListItem } from "@/types/series";
import { toast } from "sonner";

const ALL = "all";
/** Rows per server page (H-24): the shows are paged and searched on the server. */
const PAGE_LIMIT = 25;

function SeriesPageContent() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canCreate = can("SERIES.CREATE");
  const [accessTypeFilter, setAccessTypeFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SeriesListItem[] | null>(null);
  // Server search over every show (see the Movies page for the same idiom).
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = search.trim().slice(0, 100);
      if (next === appliedSearch) return;
      setItems(null);
      setPage(1);
      setAppliedSearch(next);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      seriesService.getSeries({
        page,
        limit: PAGE_LIMIT,
        search: appliedSearch || undefined,
        accessType: accessTypeFilter !== ALL ? (accessTypeFilter as AccessType) : undefined,
      }),
    [accessTypeFilter, appliedSearch, page],
  );

  const activeItems = items ?? data?.items ?? [];
  // Rows removed on this page since the fetch leave the total with them.
  const total = data ? data.total + activeItems.length - data.items.length : 0;

  const handlePageChange = (next: number) => {
    setItems(null);
    setPage(next);
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editSeries] = useState<Series | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SeriesListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusTarget, setStatusTarget] = useState<SeriesListItem | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    const publishing = statusTarget.status !== "PUBLISHED";
    setUpdatingStatus(true);
    try {
      const updated = await seriesService.updateStatus(
        statusTarget.id,
        publishing ? "PUBLISHED" : "UNPUBLISHED",
      );
      setItems(activeItems.map((s) => (s.id === statusTarget.id ? { ...s, status: updated.status } : s)));
      if (publishing) {
        toast.success(t.series.publishedToast, {
          description: t.series.publishedDescription(statusTarget.title),
        });
      } else {
        toast.success(t.series.unpublishedToast, {
          description: t.series.unpublishedDescription(statusTarget.title),
        });
      }
    } catch {
      toast.error(t.series.statusUpdateFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setUpdatingStatus(false);
      setStatusTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await seriesService.deleteSeries(deleteTarget.id);
      const remaining = activeItems.filter((s) => s.id !== deleteTarget.id);
      if (remaining.length > 0) {
        setItems(remaining);
      } else {
        // The page was emptied by hand: step back (or reload page 1).
        setItems(null);
        if (page > 1) setPage(page - 1);
        else refetch();
      }
      if (result.storageCleanup === "partial") {
        toast.warning(t.series.page.deletedPartialToast(result.failedObjects.length));
      } else {
        toast.success(t.series.page.deletedToast, {
          description: t.series.page.deletedDescription(deleteTarget.title),
        });
      }
    } catch {
      toast.error(t.series.page.deleteFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filters = (
    <Select
      value={accessTypeFilter}
      onValueChange={(v) => {
        if (!v) return;
        setAccessTypeFilter(v);
        setPage(1);
        setItems(null);
      }}
    >
      <SelectTrigger className="w-40"><SelectValue placeholder={t.movies.page.accessTypeFilterPlaceholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t.movies.page.allAccessTypes}</SelectItem>
        <SelectItem value="FREE">{t.movies.accessType.free}</SelectItem>
        <SelectItem value="SUBSCRIPTION">{t.movies.accessType.subscription}</SelectItem>
      </SelectContent>
    </Select>
  );

  const columns = getSeriesColumns({
    t,
    canDelete: can("SERIES.DELETE"),
    canPublish: can("SERIES.PUBLISH"),
    canUnpublish: can("SERIES.UNPUBLISH"),
    onDelete: setDeleteTarget,
    onToggleStatus: setStatusTarget,
  });

  if (error) {
    return (
      <div>
        <PageHeader title={t.series.page.title} description={t.series.page.description} />
        <ErrorState description={t.series.page.loadError} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t.series.page.title}
        description={t.series.page.description}
        actions={
          canCreate && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              {t.series.createSeries}
            </Button>
          )
        }
      />

      {!isLoading && total === 0 && accessTypeFilter === ALL && !search ? (
        <EmptyState
          icon={Tv}
          title={t.series.page.emptyTitle}
          description={t.series.page.emptyDescription}
          action={
            canCreate && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="size-4" />
                {t.series.createSeries}
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={activeItems}
            isLoading={isLoading}
            pageSize={PAGE_LIMIT}
            manualPagination
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.series.page.searchPlaceholder}
            toolbar={filters}
          />
          {!isLoading && (
            <ServerPagination page={page} pageSize={PAGE_LIMIT} total={total} onPageChange={handlePageChange} />
          )}
        </>
      )}

      <SeriesFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        series={editSeries}
        onSaved={() => refetch()}
      />

      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={
          statusTarget?.status === "PUBLISHED"
            ? t.series.unpublishConfirmTitle
            : t.series.publishConfirmTitle
        }
        description={
          statusTarget
            ? statusTarget.status === "PUBLISHED"
              ? t.series.unpublishConfirmDescription(statusTarget.title)
              : t.series.publishConfirmDescription(statusTarget.title)
            : ""
        }
        confirmLabel={statusTarget?.status === "PUBLISHED" ? t.series.unpublish : t.movies.publish}
        loading={updatingStatus}
        onConfirm={handleToggleStatus}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t.series.page.deleteTitle}
        description={t.series.page.deleteDescription}
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function SeriesPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission
      permission="SERIES.VIEW"
      title={t.series.page.title}
      description={t.series.page.description}
    >
      <SeriesPageContent />
    </RequirePermission>
  );
}
