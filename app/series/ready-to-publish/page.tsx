"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequireRole } from "@/components/shared/RequireRole";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { getEpisodeColumns } from "@/components/series/episode-columns";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { seriesService } from "@/services/api/seriesService";
import { movieService } from "@/services/api/movieService";
import type { AdminEpisode } from "@/types/series";
import type { MovieStatus } from "@/types/movie";
import { toast } from "sonner";

const STATUS_OPTIONS: { value: MovieStatus; label: string }[] = [
  { value: "READY_TO_PUBLISH", label: "Ready to publish" },
  { value: "PUBLISHED", label: "Published" },
  { value: "PROCESSING", label: "Processing" },
  { value: "UPLOADING", label: "Uploading" },
  { value: "FAILED", label: "Failed" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

const ALL = "all";

/**
 * The Series module's counterpart to Movies > Ready to Publish — episodes
 * only (Movie rows with seriesId set), filterable by series/season/status.
 * Publishing/editing/deleting reuses the exact same movie endpoints and
 * EditMovieDialog the movie workflow uses; nothing here touches it.
 */
export default function SeriesReadyToPublishPage() {
  const { role } = useRole();
  const canManage = role !== "USER";

  const [seriesFilter, setSeriesFilter] = useState<string>(ALL);
  const [seasonFilter, setSeasonFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>("READY_TO_PUBLISH");

  const { data: seriesOptions } = useAsyncData(() => seriesService.getSeries({ limit: 100 }), []);
  const { data: seasonOptions } = useAsyncData(
    () => (seriesFilter !== ALL ? seriesService.getSeasons(seriesFilter) : Promise.resolve([])),
    [seriesFilter],
  );

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      seriesService.getEpisodesForAdmin({
        limit: 100,
        seriesId: seriesFilter !== ALL ? seriesFilter : undefined,
        seasonNumber: seasonFilter !== ALL ? Number(seasonFilter) : undefined,
        status: statusFilter !== ALL ? (statusFilter as MovieStatus) : undefined,
      }),
    [seriesFilter, seasonFilter, statusFilter],
  );
  const [episodes, setEpisodes] = useState<AdminEpisode[] | null>(null);

  const activeEpisodes = episodes ?? data?.items ?? [];

  const [editEpisode, setEditEpisode] = useState<AdminEpisode | null>(null);
  const [deleteEpisode, setDeleteEpisode] = useState<AdminEpisode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteEpisode) return;
    setDeleting(true);
    await movieService.deleteMovie(deleteEpisode.id);
    setEpisodes(activeEpisodes.filter((e) => e.id !== deleteEpisode.id));
    setDeleting(false);
    toast.success("Episode deleted", { description: `"${deleteEpisode.title}" was removed from the catalog.` });
    setDeleteEpisode(null);
  };

  const handlePublish = async (episode: AdminEpisode) => {
    setPublishingId(episode.id);
    try {
      await movieService.updateMovie(episode.id, { status: "PUBLISHED" });
      setEpisodes(activeEpisodes.filter((e) => e.id !== episode.id));
      toast.success("Episode published", { description: `"${episode.title}" is now live on MyanFlix.` });
    } catch {
      toast.error("Couldn't publish this episode", { description: "Please try again." });
    } finally {
      setPublishingId(null);
    }
  };

  const handleSaved = () => {
    // Editing (or publishing from inside the dialog) can move the episode
    // out of the current status filter — refetch rather than trying to
    // patch it in place, since the filters (not just status) decide
    // membership in this list.
    setEpisodes(null);
    refetch();
  };

  const columns = getEpisodeColumns({
    canManage,
    onEdit: setEditEpisode,
    onDelete: setDeleteEpisode,
    onPublish: handlePublish,
    publishingId,
  });

  const filters = (
    <>
      <Select value={seriesFilter} onValueChange={(v) => { if (v) { setSeriesFilter(v); setSeasonFilter(ALL); } }}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Series" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All series</SelectItem>
          {seriesOptions?.items.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={seasonFilter} onValueChange={(v) => v && setSeasonFilter(v)}>
        <SelectTrigger className="w-32" disabled={seriesFilter === ALL}>
          <SelectValue placeholder="Season" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All seasons</SelectItem>
          {seasonOptions?.map((s) => (
            <SelectItem key={s.seasonNumber} value={String(s.seasonNumber)}>
              Season {s.seasonNumber}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN"]}
      title="Ready to Publish"
      description="Review completed episode uploads before they go live."
    >
      {error ? (
        <div>
          <PageHeader title="Ready to Publish" description="Review completed episode uploads before they go live." />
          <ErrorState description="We couldn't load the review queue." onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title="Ready to Publish"
            description="Episodes that finished uploading, waiting on your review. They stay hidden from users until you publish them."
          />

          {!isLoading && activeEpisodes.length === 0 ? (
            <EmptyState
              icon={Rocket}
              title="Nothing waiting to publish"
              description="Episodes show up here once a bulk upload finishes, or adjust the filters above."
            />
          ) : (
            <DataTable
              columns={columns}
              data={activeEpisodes}
              isLoading={isLoading}
              searchKey="title"
              searchPlaceholder="Search episodes by title..."
              toolbar={filters}
            />
          )}

          <EditMovieDialog
            movie={editEpisode}
            open={!!editEpisode}
            onOpenChange={(o) => !o && setEditEpisode(null)}
            onSaved={handleSaved}
          />

          <ConfirmDialog
            open={!!deleteEpisode}
            onOpenChange={(o) => !o && setDeleteEpisode(null)}
            title="Delete this episode?"
            description={`"${deleteEpisode?.title}" will be permanently removed from the catalog. This action cannot be undone.`}
            confirmLabel="Delete"
            variant="destructive"
            loading={deleting}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </RequireRole>
  );
}
