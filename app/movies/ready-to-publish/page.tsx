"use client";

import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
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
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { movieService } from "@/services/api/movieService";
import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import type { Movie } from "@/types/movie";
import { toast } from "sonner";

/**
 * A dedicated review queue for uploads that have finished and passed
 * validation (status READY_TO_PUBLISH) but haven't gone live yet. Publishing
 * here is always the admin's own explicit click — nothing on this page (or
 * anywhere in the upload flow that feeds it) ever sets a movie to PUBLISHED
 * on its own.
 */
/** Rows per server page (H-24): the queue is paged and searched on the server. */
const PAGE_LIMIT = 25;

export default function ReadyToPublishPage() {
  const { t } = useLanguage();
  const { can } = useRole();

  const [page, setPage] = useState(1);
  const [movies, setMovies] = useState<Movie[] | null>(null);
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
        status: "READY_TO_PUBLISH",
        search: appliedSearch || undefined,
      }),
    [appliedSearch, page]
  );

  const activeMovies = movies ?? data?.items ?? [];
  // Rows that left the queue on this page since the fetch leave the total too.
  const total = data ? data.total + activeMovies.length - data.items.length : 0;

  const handlePageChange = (next: number) => {
    setMovies(null);
    setPage(next);
  };

  // A title leaves the queue once published, reprocessed, deleted or edited
  // out of READY_TO_PUBLISH. Emptying the page by hand reloads (or steps
  // back one page) so the next batch shows instead of a false "all done".
  const removeFromQueue = (id: string) => {
    const remaining = activeMovies.filter((m) => m.id !== id);
    if (remaining.length > 0) {
      setMovies(remaining);
      return;
    }
    setMovies(null);
    if (page > 1) setPage(page - 1);
    else refetch();
  };

  const [viewMovie, setViewMovie] = useState<Movie | null>(null);
  const [editMovie, setEditMovie] = useState<Movie | null>(null);
  const [deleteMovie, setDeleteMovie] = useState<Movie | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteMovie) return;
    setDeleting(true);
    await movieService.deleteMovie(deleteMovie.id);
    removeFromQueue(deleteMovie.id);
    setDeleting(false);
    toast.success(t.movies.page.deletedToast, { description: t.movies.page.deletedDescription(deleteMovie.title) });
    setDeleteMovie(null);
  };

  const handleReprocess = async (movie: Movie) => {
    setReprocessingId(movie.id);
    try {
      await uploadService.reprocess(movie.id);
      removeFromQueue(movie.id);
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

  const handlePublish = async (movie: Movie) => {
    setPublishingId(movie.id);
    try {
      await movieService.updateMovie(movie.id, { status: "PUBLISHED" });
      removeFromQueue(movie.id);
      toast.success(t.movies.publishedToast, { description: t.movies.publishedDescription(movie.title) });
    } catch {
      toast.error(t.movies.publishFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setPublishingId(null);
    }
  };

  const columns = getMovieColumns({
    t,
    canEdit: can("MOVIES.EDIT"),
    canDelete: can("MOVIES.DELETE"),
    canPublish: can("MOVIES.PUBLISH"),
    onView: setViewMovie,
    onEdit: setEditMovie,
    onDelete: setDeleteMovie,
    onReprocess: handleReprocess,
    reprocessingId,
    onPublish: handlePublish,
    publishingId,
  });

  return (
    <RequirePermission
      permission="MOVIES.PUBLISH"
      title={t.movies.readyToPublish.title}
      description={t.movies.readyToPublish.description}
    >
      {error ? (
        <div>
          <PageHeader title={t.movies.readyToPublish.title} description={t.movies.readyToPublish.description} />
          <ErrorState description={t.movies.readyToPublish.loadError} onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title={t.movies.readyToPublish.title}
            description={t.movies.readyToPublish.pageDescription}
          />

          {!isLoading && total === 0 && !search ? (
            <EmptyState
              icon={Rocket}
              title={t.movies.readyToPublish.emptyTitle}
              description={t.movies.readyToPublish.emptyDescription}
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
            onSaved={(updated) => {
              // Editing (or publishing from inside the dialog) can move the
              // movie out of READY_TO_PUBLISH — either way it no longer belongs
              // on this page's list once its status has changed.
              if (updated.status === "READY_TO_PUBLISH") {
                setMovies(activeMovies.map((m) => (m.id === updated.id ? updated : m)));
              } else {
                removeFromQueue(updated.id);
              }
            }}
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
      )}
    </RequirePermission>
  );
}
