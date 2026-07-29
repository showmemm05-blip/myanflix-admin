"use client";

import { useState } from "react";
import Link from "next/link";
import { Film, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { getMovieColumns } from "@/components/movies/columns";
import { MovieDetailsSheet } from "@/components/movies/MovieDetailsSheet";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
import { Button } from "@/components/ui/button";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { movieService } from "@/services/api/movieService";
import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import type { Movie } from "@/types/movie";
import { toast } from "sonner";

export default function MoviesPage() {
  const { role } = useRole();
  const canManage = role !== "USER";

  const { data, isLoading, error, refetch } = useAsyncData(
    () => movieService.getMovies({ limit: 100 }),
    []
  );
  const [movies, setMovies] = useState<Movie[] | null>(null);

  const activeMovies = movies ?? data?.items ?? [];

  const [viewMovie, setViewMovie] = useState<Movie | null>(null);
  const [editMovie, setEditMovie] = useState<Movie | null>(null);
  const [deleteMovie, setDeleteMovie] = useState<Movie | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

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
      setMovies(activeMovies.map((m) => (m.id === movie.id ? { ...m, status: "PROCESSING" } : m)));
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

  const columns = getMovieColumns({
    canManage,
    onView: setViewMovie,
    onEdit: setEditMovie,
    onDelete: setDeleteMovie,
    onReprocess: handleReprocess,
    reprocessingId,
  });

  if (error) {
    return (
      <div>
        <PageHeader title="All Movies" description="Browse and manage the MyanFlix catalog." />
        <ErrorState description="We couldn't load the movie catalog." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="All Movies"
        description="Browse and manage the MyanFlix catalog."
        actions={
          canManage && (
            <Button render={<Link href="/movies/upload" />} nativeButton={false}>
              <Plus className="size-4" />
              Upload Movie
            </Button>
          )
        }
      />

      {!isLoading && activeMovies.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No movies yet"
          description="Upload your first title to start building the catalog."
          action={
            canManage && (
              <Button render={<Link href="/movies/upload" />} nativeButton={false}>
                <Plus className="size-4" />
                Upload Movie
              </Button>
            )
          }
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
        onSaved={(updated) => setMovies(activeMovies.map((m) => (m.id === updated.id ? updated : m)))}
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
