"use client";

import { useState } from "react";
import { Plus, Tv } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
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
import { seriesService } from "@/services/api/seriesService";
import type { AccessType } from "@/types/movie";
import type { Series, SeriesListItem } from "@/types/series";
import { toast } from "sonner";

const ALL = "all";

export default function SeriesPage() {
  const { t } = useLanguage();
  const [accessTypeFilter, setAccessTypeFilter] = useState<string>(ALL);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      seriesService.getSeries({
        limit: 100,
        accessType: accessTypeFilter !== ALL ? (accessTypeFilter as AccessType) : undefined,
      }),
    [accessTypeFilter],
  );
  const [items, setItems] = useState<SeriesListItem[] | null>(null);

  const activeItems = items ?? data?.items ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editSeries] = useState<Series | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SeriesListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await seriesService.deleteSeries(deleteTarget.id);
      setItems(activeItems.filter((s) => s.id !== deleteTarget.id));
      toast.success(t.series.page.deletedToast, {
        description: t.series.page.deletedDescription(deleteTarget.title),
      });
    } catch {
      toast.error(t.series.page.deleteFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filters = (
    <Select value={accessTypeFilter} onValueChange={(v) => v && setAccessTypeFilter(v)}>
      <SelectTrigger className="w-40"><SelectValue placeholder={t.movies.page.accessTypeFilterPlaceholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t.movies.page.allAccessTypes}</SelectItem>
        <SelectItem value="FREE">{t.movies.accessType.free}</SelectItem>
        <SelectItem value="SUBSCRIPTION">{t.movies.accessType.subscription}</SelectItem>
      </SelectContent>
    </Select>
  );

  const columns = getSeriesColumns({ t, onDelete: setDeleteTarget });

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
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            {t.series.createSeries}
          </Button>
        }
      />

      {!isLoading && activeItems.length === 0 && accessTypeFilter === ALL ? (
        <EmptyState
          icon={Tv}
          title={t.series.page.emptyTitle}
          description={t.series.page.emptyDescription}
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              {t.series.createSeries}
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={activeItems}
          isLoading={isLoading}
          searchKey="title"
          searchPlaceholder={t.series.page.searchPlaceholder}
          toolbar={filters}
        />
      )}

      <SeriesFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        series={editSeries}
        onSaved={() => refetch()}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t.series.page.deleteTitle}
        description={deleteTarget ? t.series.page.deleteDescription(deleteTarget.title) : ""}
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
