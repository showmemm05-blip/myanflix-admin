"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { getEpisodeColumns } from "@/components/series/episode-columns";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { seriesService } from "@/services/api/seriesService";
import { movieService } from "@/services/api/movieService";
import { getStatusLabel } from "@/components/movies/columns";
import type { AdminEpisode } from "@/types/series";
import type { MovieStatus } from "@/types/movie";
import { toast } from "sonner";

const STATUS_OPTIONS: MovieStatus[] = [
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "PROCESSING",
  "UPLOADING",
  "FAILED",
  "DRAFT",
  "ARCHIVED",
];

const ALL = "all";

/**
 * The Series module's counterpart to Movies > Ready to Publish — episodes
 * only (Movie rows with seriesId set), filterable by series/season/status.
 * Publishing/editing/deleting reuses the exact same movie endpoints and
 * EditMovieDialog the movie workflow uses; nothing here touches it.
 */
export default function SeriesReadyToPublishPage() {
  const { t } = useLanguage();
  const { can } = useRole();

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
    toast.success(t.series.episodeDeletedToast, { description: t.movies.page.deletedDescription(deleteEpisode.title) });
    setDeleteEpisode(null);
  };

  const handlePublish = async (episode: AdminEpisode) => {
    setPublishingId(episode.id);
    try {
      await movieService.updateMovie(episode.id, { status: "PUBLISHED" });
      setEpisodes(activeEpisodes.filter((e) => e.id !== episode.id));
      toast.success(t.series.episodePublishedToast, { description: t.movies.publishedDescription(episode.title) });
    } catch {
      toast.error(t.series.publishFailedToast, { description: t.movies.pleaseTryAgain });
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
    t,
    canEdit: can("SERIES.EDIT"),
    canDelete: can("SERIES.DELETE"),
    canPublish: can("SERIES.PUBLISH"),
    onEdit: setEditEpisode,
    onDelete: setDeleteEpisode,
    onPublish: handlePublish,
    publishingId,
  });

  const filters = (
    <>
      <Select value={seriesFilter} onValueChange={(v) => { if (v) { setSeriesFilter(v); setSeasonFilter(ALL); } }}>
        <SelectTrigger className="w-40"><SelectValue placeholder={t.series.readyToPublish.seriesFilterPlaceholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t.series.readyToPublish.allSeries}</SelectItem>
          {seriesOptions?.items.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={seasonFilter} onValueChange={(v) => v && setSeasonFilter(v)}>
        <SelectTrigger className="w-32" disabled={seriesFilter === ALL}>
          <SelectValue placeholder={t.series.readyToPublish.seasonFilterPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t.series.readyToPublish.allSeasons}</SelectItem>
          {seasonOptions?.map((s) => (
            <SelectItem key={s.seasonNumber} value={String(s.seasonNumber)}>
              {t.series.readyToPublish.seasonOption(s.seasonNumber)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder={t.series.readyToPublish.statusFilterPlaceholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t.series.readyToPublish.allStatuses}</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>{getStatusLabel(t, s)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <RequirePermission
      permission="SERIES.PUBLISH"
      title={t.nav.readyToPublish}
      description={t.series.readyToPublish.description}
    >
      {error ? (
        <div>
          <PageHeader title={t.nav.readyToPublish} description={t.series.readyToPublish.description} />
          <ErrorState description={t.movies.readyToPublish.loadError} onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title={t.nav.readyToPublish}
            description={t.series.readyToPublish.pageDescription}
          />

          {!isLoading && activeEpisodes.length === 0 ? (
            <EmptyState
              icon={Rocket}
              title={t.movies.readyToPublish.emptyTitle}
              description={t.series.readyToPublish.emptyDescription}
            />
          ) : (
            <DataTable
              columns={columns}
              data={activeEpisodes}
              isLoading={isLoading}
              searchKey="title"
              searchPlaceholder={t.series.readyToPublish.searchPlaceholder}
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
            title={t.series.deleteEpisodeTitle}
            description={deleteEpisode ? t.movies.page.deleteDescription(deleteEpisode.title) : ""}
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
