"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
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
export default function ReadyToPublishPage() {
  const { t } = useLanguage();
  const { can } = useRole();

  const { data, isLoading, error, refetch } = useAsyncData(
    () => movieService.getMovies({ limit: 100, status: "READY_TO_PUBLISH" }),
    []
  );
  const [movies, setMovies] = useState<Movie[] | null>(null);

  const activeMovies = movies ?? data?.items ?? [];

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
    setMovies(activeMovies.filter((m) => m.id !== deleteMovie.id));
    setDeleting(false);
    toast.success(t.movies.page.deletedToast, { description: t.movies.page.deletedDescription(deleteMovie.title) });
    setDeleteMovie(null);
  };

  const handleReprocess = async (movie: Movie) => {
    setReprocessingId(movie.id);
    try {
      await uploadService.reprocess(movie.id);
      setMovies(activeMovies.filter((m) => m.id !== movie.id));
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
      setMovies(activeMovies.filter((m) => m.id !== movie.id));
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

          {!isLoading && activeMovies.length === 0 ? (
            <EmptyState
              icon={Rocket}
              title={t.movies.readyToPublish.emptyTitle}
              description={t.movies.readyToPublish.emptyDescription}
            />
          ) : (
            <DataTable
              columns={columns}
              data={activeMovies}
              isLoading={isLoading}
              searchKey="title"
              searchPlaceholder={t.movies.page.searchPlaceholder}
            />
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
                setMovies(activeMovies.filter((m) => m.id !== updated.id));
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
