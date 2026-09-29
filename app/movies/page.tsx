"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Film, Loader2, Plus, Timer } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { getMovieColumns } from "@/components/movies/columns";
import { MovieDetailsSheet } from "@/components/movies/MovieDetailsSheet";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
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
import { movieService } from "@/services/api/movieService";
import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import type { AccessType, Movie } from "@/types/movie";
import { toast } from "sonner";

const ALL = "all";
/** Rows per server page (H-24): the catalogue is paged and searched on the server. */
const PAGE_LIMIT = 25;

export default function MoviesPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canCreate = can("MOVIES.CREATE");
  const canEdit = can("MOVIES.EDIT");

  const [accessTypeFilter, setAccessTypeFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [movies, setMovies] = useState<Movie[] | null>(null);
  // Search runs on the SERVER over the whole catalogue — a filter over the
  // loaded page could never find a title past the first page. Capped at the
  // API's shortest search limit so a long paste can't turn into a 400.
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = search.trim().slice(0, 100);
      if (next === appliedSearch) return;
      setMovies(null);
      setPage(1);
      setAppliedSearch(next);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      movieService.getMovies({
        page,
        limit: PAGE_LIMIT,
        search: appliedSearch || undefined,
        accessType: accessTypeFilter !== ALL ? (accessTypeFilter as AccessType) : undefined,
      }),
    [accessTypeFilter, appliedSearch, page],
  );

  const activeMovies = movies ?? data?.items ?? [];
  // Rows removed on this page since the fetch leave the total with them.
  const total = data ? data.total + activeMovies.length - data.items.length : 0;

  const handleAccessTypeFilterChange = (value: string) => {
    setAccessTypeFilter(value);
    setPage(1);
    setMovies(null);
  };

  const handlePageChange = (next: number) => {
    setMovies(null);
    setPage(next);
  };

  const [viewMovie, setViewMovie] = useState<Movie | null>(null);
  const [editMovie, setEditMovie] = useState<Movie | null>(null);
  const [deleteMovie, setDeleteMovie] = useState<Movie | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteMovie) return;
    setDeleting(true);
    await movieService.deleteMovie(deleteMovie.id);
    const remaining = activeMovies.filter((m) => m.id !== deleteMovie.id);
    if (remaining.length > 0) {
      setMovies(remaining);
    } else {
      // The page was emptied by hand: step back (or reload page 1) rather
      // than show an empty table while more titles wait on the server.
      setMovies(null);
      if (page > 1) setPage(page - 1);
      else refetch();
    }
    setDeleting(false);
    toast.success(t.movies.page.deletedToast, { description: t.movies.page.deletedDescription(deleteMovie.title) });
    setDeleteMovie(null);
  };

  const handleReprocess = async (movie: Movie) => {
    setReprocessingId(movie.id);
    try {
      await uploadService.reprocess(movie.id);
      setMovies(activeMovies.map((m) => (m.id === movie.id ? { ...m, status: "PROCESSING" } : m)));
      toast.success(t.movies.page.reprocessStartedToast, {
        description: t.movies.page.reprocessStartedDescription(movie.title),
      });
    } catch (err) {
      toast.error(t.movies.page.reprocessFailedToast, {
        description:
          err instanceof ApiError
            ? err.message
            : t.movies.page.reprocessFailedFallback,
      });
    } finally {
      setReprocessingId(null);
    }
  };

  // Server-side, idempotent: fills Movie.duration only where it is still 0
  // (bulk-uploaded titles whose runtime was never measured), 100 titles per
  // click — a larger backlog is cleared by clicking again.
  const [backfilling, setBackfilling] = useState(false);
  const handleBackfillDurations = async () => {
    setBackfilling(true);
    try {
      const result = await movieService.backfillDurations();
      if (result.scanned === 0) {
        toast.info(t.movies.page.backfillNothingToast, { description: t.movies.page.backfillNothingDescription });
      } else {
        toast.success(t.movies.page.backfillDoneToast, {
          description:
            t.movies.page.backfillDoneDescription(result.updated, result.scanned) +
            (result.failed.length ? ` ${t.movies.page.backfillPartialDescription(result.failed.length)}` : ""),
        });
      }
      setMovies(null);
      refetch();
    } catch {
      toast.error(t.movies.page.backfillFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setBackfilling(false);
    }
  };

  const filters = (
    <Select value={accessTypeFilter} onValueChange={(v) => v && handleAccessTypeFilterChange(v)}>
      <SelectTrigger className="w-40"><SelectValue placeholder={t.movies.page.accessTypeFilterPlaceholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t.movies.page.allAccessTypes}</SelectItem>
        <SelectItem value="FREE">{t.movies.accessType.free}</SelectItem>
        <SelectItem value="SUBSCRIPTION">{t.movies.accessType.subscription}</SelectItem>
      </SelectContent>
    </Select>
  );

  const columns = getMovieColumns({
    t,
    canEdit,
    canDelete: can("MOVIES.DELETE"),
    onView: setViewMovie,
    onEdit: setEditMovie,
    onDelete: setDeleteMovie,
    onReprocess: handleReprocess,
    reprocessingId,
  });

  if (error) {
    return (
      <RequirePermission
        permission="MOVIES.VIEW"
        title={t.movies.page.title}
        description={t.movies.page.description}
      >
        <div>
          <PageHeader title={t.movies.page.title} description={t.movies.page.description} />
          <ErrorState description={t.movies.page.loadError} onRetry={refetch} />
        </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission
      permission="MOVIES.VIEW"
      title={t.movies.page.title}
      description={t.movies.page.description}
    >
    <div>
      <PageHeader
        title={t.movies.page.title}
        description={t.movies.page.description}
        actions={
          (canEdit || canCreate) && (
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={handleBackfillDurations}
                  disabled={backfilling}
                  title={t.movies.page.backfillButton}
                >
                  {backfilling ? <Loader2 className="size-4 animate-spin" /> : <Timer className="size-4" />}
                  {t.movies.page.backfillButton}
                </Button>
              )}
              {canCreate && (
                <Button render={<Link href="/movies/upload" />} nativeButton={false}>
                  <Plus className="size-4" />
                  {t.movies.uploadMovie}
                </Button>
              )}
            </div>
          )
        }
      />

      {!isLoading && total === 0 && accessTypeFilter === ALL && !search ? (
        <EmptyState
          icon={Film}
          title={t.movies.page.emptyTitle}
          description={t.movies.page.emptyDescription}
          action={
            canCreate && (
              <Button render={<Link href="/movies/upload" />} nativeButton={false}>
                <Plus className="size-4" />
                {t.movies.uploadMovie}
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={activeMovies}
            isLoading={isLoading}
            pageSize={PAGE_LIMIT}
            manualPagination
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.movies.page.searchPlaceholder}
            toolbar={filters}
          />
          {!isLoading && (
            <ServerPagination page={page} pageSize={PAGE_LIMIT} total={total} onPageChange={handlePageChange} />
          )}
        </>
      )}

      <MovieDetailsSheet movie={viewMovie} open={!!viewMovie} onOpenChange={(o) => !o && setViewMovie(null)} />

      <EditMovieDialog
        movie={editMovie}
        open={!!editMovie}
        onOpenChange={(o) => !o && setEditMovie(null)}
        onSaved={(updated) => setMovies(activeMovies.map((m) => (m.id === updated.id ? updated : m)))}
      />

      <ConfirmDialog
        open={!!deleteMovie}
        onOpenChange={(o) => !o && setDeleteMovie(null)}
        title={t.movies.page.deleteTitle}
        description={deleteMovie ? t.movies.page.deleteDescription(deleteMovie.title) : ""}
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
    </RequirePermission>
  );
}
