"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Settings2, Trash2, Tv } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SeriesFormDialog } from "@/components/series/SeriesFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { seriesService } from "@/services/api/seriesService";
import type { Series, SeriesListItem } from "@/types/series";
import { toast } from "sonner";

export default function SeriesPage() {
  const { data, isLoading, error, refetch } = useAsyncData(
    () => seriesService.getSeries({ limit: 100 }),
    []
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editSeries, setEditSeries] = useState<Series | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SeriesListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const items = data?.items ?? [];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await seriesService.deleteSeries(deleteTarget.id);
      toast.success("Series deleted", {
        description: `"${deleteTarget.title}" was removed. Its episodes are kept and remain manageable from the Movies table.`,
      });
      refetch();
    } catch {
      toast.error("Couldn't delete the series", { description: "Please try again." });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

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
          <Button onClick={() => { setEditSeries(null); setFormOpen(true); }}>
            <Plus className="size-4" />
            Create Series
          </Button>
        }
      />

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={Tv}
          title="No series yet"
          description="Create your first show, then add episodes with Bulk Upload Episodes."
          action={
            <Button onClick={() => { setEditSeries(null); setFormOpen(true); }}>
              <Plus className="size-4" />
              Create Series
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((series) => (
            <Card key={series.id} className="glass-card border-white/[0.08]">
              <CardContent className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{series.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {series.genre} · {series.language} · {series.releaseYear}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 font-normal">
                  {series.episodeCount} episode{series.episodeCount === 1 ? "" : "s"}
                </Badge>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    render={<Link href={`/series/${series.id}`} />}
                    nativeButton={false}
                  >
                    <Settings2 className="size-3.5" />
                    Manage
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(series)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
