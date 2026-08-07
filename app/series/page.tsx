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
import { seriesService } from "@/services/api/seriesService";
import type { AccessType } from "@/types/movie";
import type { Series, SeriesListItem } from "@/types/series";
import { toast } from "sonner";

const ALL = "all";

export default function SeriesPage() {
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
      toast.success("Series deleted", {
        description: `"${deleteTarget.title}" was removed. Its episodes are kept and remain manageable from the Movies table.`,
      });
    } catch {
      toast.error("Couldn't delete the series", { description: "Please try again." });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filters = (
    <Select value={accessTypeFilter} onValueChange={(v) => v && setAccessTypeFilter(v)}>
      <SelectTrigger className="w-40"><SelectValue placeholder="Access type" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All access types</SelectItem>
        <SelectItem value="FREE">Free</SelectItem>
        <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
      </SelectContent>
    </Select>
  );

  const columns = getSeriesColumns({ onDelete: setDeleteTarget });

  if (error) {
    return (
      <div>
        <PageHeader title="All Series" description="Manage shows and their episodes." />
        <ErrorState description="We couldn't load the series list." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="All Series"
        description="Manage shows and their episodes."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Create Series
          </Button>
        }
      />

      {!isLoading && activeItems.length === 0 && accessTypeFilter === ALL ? (
        <EmptyState
          icon={Tv}
          title="No series yet"
          description="Create your first show, then add episodes with Bulk Upload Episodes."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              Create Series
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={activeItems}
          isLoading={isLoading}
          searchKey="title"
          searchPlaceholder="Search series by title..."
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
        title="Delete this series?"
        description={`"${deleteTarget?.title}" will be removed. Its episodes are NOT deleted — they stay in the system, detached from the show, and remain manageable from the Movies table.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
