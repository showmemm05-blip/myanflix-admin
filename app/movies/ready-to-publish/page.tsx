"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { getMovieColumns } from "@/components/movies/columns";
import { MovieDetailsSheet } from "@/components/movies/MovieDetailsSheet";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
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
  const { role } = useRole();
  const canManage = role !== "USER";

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
    toast.success("Movie deleted", { description: `"${deleteMovie.title}" was removed from the catalog.` });
    setDeleteMovie(null);
  };

  const handleReprocess = async (movie: Movie) => {
    setReprocessingId(movie.id);
    try {
      await uploadService.reprocess(movie.id);
      setMovies(activeMovies.filter((m) => m.id !== movie.id));
      toast.success("Reprocessing started", {
        description: `"${movie.title}" is transcoding again — no re-upload needed.`,
      });
    } catch (err) {
      toast.error("Couldn't reprocess this movie", {
        description:
          err instanceof ApiError
            ? err.message
            : "Only a movie whose video failed to process can be reprocessed.",
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
      toast.success("Movie published", { description: `"${movie.title}" is now live on MyanFlix.` });
    } catch {
      toast.error("Couldn't publish this movie", { description: "Please try again." });
    } finally {
      setPublishingId(null);
    }
  };

  const columns = getMovieColumns({
    canManage,
    onView: setViewMovie,
    onEdit: setEditMovie,
    onDelete: setDeleteMovie,
    onReprocess: handleReprocess,
    reprocessingId,
    onPublish: handlePublish,
    publishingId,
  });

  if (error) {
    return (
      <div>
        <PageHeader title="Ready to Publish" description="Review completed uploads before they go live." />
        <ErrorState description="We couldn't load the review queue." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Ready to Publish"
        description="Uploads that finished and passed validation, waiting on your review. They stay hidden from users until you publish them."
      />

      {!isLoading && activeMovies.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="Nothing waiting to publish"
          description="Movies show up here once a bulk or pre-transcoded upload finishes and passes validation."
        />
      ) : (
        <DataTable
          columns={columns}
          data={activeMovies}
          isLoading={isLoading}
          searchKey="title"
          searchPlaceholder="Search movies by title..."
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
        title="Delete this movie?"
        description={`"${deleteMovie?.title}" will be permanently removed from the catalog. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
