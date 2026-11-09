"use client";

import { useEffect, useRef, useState } from "react";
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
import { TmdbMatchDialog, tmdbTargetOfMovie } from "@/components/tmdb/TmdbMatchDialog";
import { folderNamesOf, tmdbStatesUse } from "@/components/tmdb/tmdbPolling";
import { tmdbActionOpensDialog, type TmdbAction } from "@/components/tmdb/tmdbStatus";
import { tmdbErrorCode, tmdbErrorMessage } from "@/components/tmdb/tmdbWords";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useTmdbConnection, useTmdbStates } from "@/lib/hooks/use-tmdb-states";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { movieService } from "@/services/api/movieService";
import { tmdbService } from "@/services/api/tmdbService";
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
 *
 * Since 2026-11-06 the "Details" column says what TMDB found for each title
 * (docs/movie-details-tmdb-2026-11-06): the lookup runs by itself when an
 * upload finishes, and a row that needs a person gets its button here —
 * Pick a match, Search TMDB, Try again. Publish is never blocked by it, and
 * while TMDB is not connected the page is the table it always was, under
 * one quiet line — plus the folder each upload came from, under its title.
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

  // ---- Details from TMDB ----
  // The status and the states both ask MOVIES.VIEW; a publisher without it
  // gets the table as it always was. "Not connected" is only what the
  // server itself said — an unknown status keeps the column.
  const canSeeTmdb = can("MOVIES.VIEW");
  const canUseTmdb = can("MOVIES.EDIT") && can("MEDIA.UPLOAD");
  const connection = useTmdbConnection({ enabled: canSeeTmdb });
  // Until the server has answered about its key the column waits, so a
  // server without one never flashes an empty "Details" column. The answer
  // comes back with the rows, or before them. A server without a key is
  // still asked for the states, but only for the folder names: every status
  // then reads NONE, and no badge or button is drawn from it.
  const connectionAnswered = !(connection.isLoading && connection.status === null);
  const statesUse = tmdbStatesUse(canSeeTmdb, connectionAnswered, connection.notConnected);
  // Episodes are never looked up; this queue lists movies, but a stray
  // episode row must not be asked about. The hook reads again only when the
  // set of ids changes, so a new array each render costs nothing.
  const tmdbIds = activeMovies.filter((m) => m.seriesId === null).map((m) => m.id);

  // The rows on screen right now, for a reload that lands long after the
  // render that asked for it (a lookup can end many seconds later). Empty
  // while a page loads: the rows still held then belong to the page being
  // left, and writing them back would show them under the new page.
  const rowsRef = useRef<Movie[]>([]);
  useEffect(() => {
    rowsRef.current = isLoading ? [] : activeMovies;
  });
  /** Swaps one row for its fresh copy — if it is still on this page and still waiting to be published. */
  const replaceRow = (updated: Movie) => {
    if (updated.status !== "READY_TO_PUBLISH") return;
    if (!rowsRef.current.some((m) => m.id === updated.id)) return;
    setMovies(rowsRef.current.map((m) => (m.id === updated.id ? updated : m)));
  };

  const tmdb = useTmdbStates(tmdbIds, {
    enabled: statesUse !== "none",
    // "Finding details…" ended: a match changed the name, the poster and
    // more on the server, so the row is read again.
    onSettled: (state) => {
      if (state.status !== "MATCHED") return;
      movieService.getMovieById(state.movieId).then(replaceRow, () => {});
    },
  });
  const tmdbNotConnected = statesUse === "folders";
  // No column while there is nothing to put in it: TMDB is off or not
  // heard from yet, this member may not read the states, or the read was
  // refused and no row has one.
  const tmdbOff = statesUse !== "all" || (tmdb.error !== null && tmdb.states.size === 0);

  const [lookupBusyId, setLookupBusyId] = useState<string | null>(null);
  const [tmdbDialog, setTmdbDialog] = useState<{ movie: Movie; start: "pick" | "refill" } | null>(null);

  const handleTmdbAction = async (movie: Movie, action: TmdbAction) => {
    if (action === "refresh") {
      tmdb.refresh();
      return;
    }
    if (tmdbActionOpensDialog(action)) {
      setTmdbDialog({ movie, start: action === "refill" ? "refill" : "pick" });
      return;
    }
    // "Find details" / "Try again": the automatic lookup, in the background.
    setLookupBusyId(movie.id);
    try {
      await tmdbService.lookupMovie(movie.id);
      tmdb.markPending(movie.id);
      toast.success(t.tmdbPages.readyToPublish.lookupStartedToast, {
        description: t.tmdbPages.readyToPublish.lookupStartedDescription(movie.title),
      });
    } catch (err) {
      toast.error(t.tmdbPages.readyToPublish.lookupFailedToast, { description: tmdbErrorMessage(err, t) });
      // Refused because the row is not what this page shows any more —
      // another staff member started it, or it is matched by now.
      const code = tmdbErrorCode(err);
      if (code === "TMDB_BUSY" || code === "TMDB_ALREADY_MATCHED") tmdb.refresh();
    } finally {
      setLookupBusyId(null);
    }
  };

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
    tmdb: tmdbOff
      ? undefined
      : {
          states: tmdb.states,
          canAct: canUseTmdb,
          busyId: lookupBusyId,
          timedOut: tmdb.timedOut,
          onAction: handleTmdbAction,
        },
    // Connected or not: the folder is how an uploader recognises the title.
    folderNames: folderNamesOf(tmdb.states),
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
              {/* Only what the server itself said: no key, so no TMDB column and no TMDB buttons. */}
              {tmdbNotConnected && (
                <p className="mb-4 rounded-lg border border-border bg-secondary/20 px-4 py-2.5 text-sm text-muted-foreground">
                  {t.tmdbPages.notConnected}
                </p>
              )}
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
              {!tmdbOff && (
                <p className="mt-4 text-sm text-muted-foreground">{t.tmdbPages.readyToPublish.publishNeverBlocked}</p>
              )}
            </>
          )}

          <MovieDetailsSheet movie={viewMovie} open={!!viewMovie} onOpenChange={(o) => !o && setViewMovie(null)} />

          <TmdbMatchDialog
            open={!!tmdbDialog}
            onOpenChange={(o) => !o && setTmdbDialog(null)}
            target={tmdbDialog ? tmdbTargetOfMovie(tmdbDialog.movie, tmdb.states.get(tmdbDialog.movie.id)) : null}
            start={tmdbDialog?.start}
            onApplied={(result) => {
              // The details are written; the dialog stays on its summary.
              // A fill never touches the status, so the row stays in the queue.
              if (result.kind === "movie") replaceRow(result.movie);
              tmdb.refresh();
              toast.success(t.tmdbPages.readyToPublish.appliedToast);
            }}
            onApplyFailed={() => tmdb.refresh()}
          />

          <EditMovieDialog
            movie={editMovie}
            open={!!editMovie}
            onOpenChange={(o) => {
              if (o) return;
              setEditMovie(null);
              // The dialog has its own TMDB strip: a match picked or a lookup
              // started in there shows on the row once it is closed. Asked
              // also while the column is hidden because a read failed — this
              // is what brings it back. (Nothing is asked when the states
              // are not read at all.)
              tmdb.refresh();
            }}
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
