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
import {
  missingMovieDetails,
  publishQuestionNeeded,
  publishQuestionWords,
} from "@/components/movies/missingDetails";
import { MovieDetailsSheet } from "@/components/movies/MovieDetailsSheet";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
import { TmdbMatchDialog, tmdbTargetOfMovie } from "@/components/tmdb/TmdbMatchDialog";
import {
  folderNamesOf,
  rowBehindItsDetails,
  rowRemoved,
  rowReplaced,
  tmdbStatesUse,
} from "@/components/tmdb/tmdbPolling";
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
 *
 * Since 2026-11-09 each row also says what it still needs before it goes
 * live (components/movies/missingDetails.ts, the `Missing` board): "Still
 * needed: Poster · Description" or "Ready" under the title, with or without
 * TMDB. Publish asks first when a poster, a description or a category is
 * missing — "Publish anyway" then publishes exactly as before — and goes
 * straight through otherwise. Publishing is still never blocked.
 */
/** Rows per server page (H-24): the queue is paged and searched on the server. */
const PAGE_LIMIT = 25;

const NO_IDS: ReadonlySet<string> = new Set();

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

  // The rows on screen right now, for a change that lands some time after
  // the render that asked for it (a lookup can end many seconds later; a
  // Publish, a Delete or a Reprocess waits for its request). Empty while a
  // page loads: the rows still held then belong to the page being left, and
  // writing them back would show them under the new page.
  const rowsRef = useRef<Movie[]>([]);
  useEffect(() => {
    rowsRef.current = isLoading ? [] : activeMovies;
  });
  // Every change to the list is made on the rows as they are when React
  // applies it (`prev`), never on a copy held since the click or the last
  // render: a row read again while another answer was on its way keeps its
  // fresh copy, and a row that just left is not put back. `prev` is null
  // while the list is still the one the server sent; the rows on screen
  // stand in for it then.

  // A title leaves the queue once published, reprocessed, deleted or edited
  // out of READY_TO_PUBLISH. Emptying the page by hand reloads (or steps
  // back one page) so the next batch shows instead of a false "all done".
  const removeFromQueue = (id: string) => {
    // Judged by the rows on screen now, not the ones of the click: the
    // request took a while. A row that is not on screen any more (it is
    // gone already, or another page is showing or loading) leaves nothing
    // to take out.
    const shown = rowsRef.current;
    if (!shown.some((m) => m.id === id)) return;
    if (rowRemoved(shown, id).length > 0) {
      setMovies((prev) => rowRemoved(prev ?? shown, id));
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

  /** Swaps one row for its fresh copy — if it is still on this page and still waiting to be published. */
  const replaceRow = (updated: Movie) => {
    if (updated.status !== "READY_TO_PUBLISH") return;
    const shown = rowsRef.current;
    if (!shown.some((m) => m.id === updated.id)) return;
    // Two rows are often read again at the same moment (one states read
    // reports both lookups as ended): each answer swaps its own row in the
    // list the other has already changed.
    setMovies((prev) => rowReplaced(prev ?? shown, updated));
  };

  // Rows TMDB has just filled in, until their fresh copy is here. The badge
  // turns green a moment before the row is read again, and for that moment
  // the old row would say "Still needed: Poster" about a poster that has
  // arrived — so its line keeps saying that the list is coming.
  const [refreshingIds, setRefreshingIds] = useState(NO_IDS);
  /** Reads one row again: TMDB changed its name, its poster and more on the server. A failed read leaves the row as it is. */
  const rereadRow = (movieId: string) => {
    const done = () =>
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(movieId);
        return next;
      });
    setRefreshingIds((prev) => new Set(prev).add(movieId));
    movieService.getMovieById(movieId).then((fresh) => {
      replaceRow(fresh);
      done();
    }, done);
  };
  // The fills a row was already read again for (movie id + when it was
  // filled): each is asked once, so a read that fails is not asked for ever.
  const rereadForRef = useRef(new Set<string>());

  const tmdb = useTmdbStates(tmdbIds, {
    enabled: statesUse !== "none",
    // "Finding details…" ended: a match changed the name, the poster and
    // more on the server, so the row is read again.
    onSettled: (state) => {
      if (state.status !== "MATCHED") return;
      rereadForRef.current.add(`${state.movieId}:${state.fetchedAt}`);
      rereadRow(state.movieId);
    },
  });
  // A row can also turn "Details from TMDB" without this page having
  // watched the lookup end: someone else picked its match (this page's own
  // "Try again" is then refused as already matched, and only the states are
  // read again), or the rows were read a moment before the fill and the
  // states a moment after. The row on screen is then older than its
  // details, and its line, its thumbnail and its Publish question would
  // speak of a poster the movie has by now — so it is read again, once.
  useEffect(() => {
    for (const movie of rowsRef.current) {
      const state = tmdb.states.get(movie.id);
      if (!rowBehindItsDetails(movie.updatedAt, state)) continue;
      const fill = `${movie.id}:${state?.fetchedAt}`;
      if (rereadForRef.current.has(fill)) continue;
      rereadForRef.current.add(fill);
      rereadRow(movie.id);
    }
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
      // "refill" is a linked row's "Get from TMDB": straight to the review
      // of the entry it has, where a missing poster is one switch.
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
      // another staff member started it, or it is matched by now. Matched
      // by now: the fresh states say the row is older than its details,
      // and it is read again (the effect above).
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

  // ---- Publish asks first when something is still needed ----
  // The movie the question is about. It stays after the answer, so the
  // words are still there while the dialog fades out.
  const [publishAsk, setPublishAsk] = useState<Movie | null>(null);
  const [publishAskOpen, setPublishAskOpen] = useState(false);
  const publishQuestion = publishAsk
    ? publishQuestionWords(t, "movie", publishAsk.title, missingMovieDetails(publishAsk))
    : null;

  /**
   * The row's Publish button. Judged by the row as it is: only the status
   * is sent, so the movie goes live as stored. With a poster, a description
   * and a category it is published at once, exactly as before.
   */
  const handlePublishClick = (movie: Movie) => {
    if (!publishQuestionNeeded(missingMovieDetails(movie))) {
      void handlePublish(movie);
      return;
    }
    setPublishAsk(movie);
    setPublishAskOpen(true);
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
    onPublish: handlePublishClick,
    publishingId,
    tmdb: tmdbOff
      ? undefined
      : {
          states: tmdb.states,
          canAct: canUseTmdb,
          busyId: lookupBusyId,
          timedOut: tmdb.timedOut,
          refreshingIds,
          onAction: handleTmdbAction,
        },
    // Connected or not: the folder is how an uploader recognises the title.
    folderNames: folderNamesOf(tmdb.states),
    // Connected or not: what each title still needs before it goes live.
    missingDetails: true,
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
              {/* Goes with the "Still needed" lines, which show with or without TMDB. */}
              <p className="mt-4 text-sm text-muted-foreground">{t.tmdbPages.readyToPublish.publishNeverBlocked}</p>
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
              if (updated.status === "READY_TO_PUBLISH") replaceRow(updated);
              else removeFromQueue(updated.id);
            }}
          />

          {/* "Go back" closes and nothing happens; "Publish anyway" is the
              Publish it always was — the row's own button shows the wait. */}
          <ConfirmDialog
            open={publishAskOpen && publishQuestion !== null}
            onOpenChange={setPublishAskOpen}
            title={publishQuestion?.title ?? ""}
            description={publishQuestion?.description ?? ""}
            confirmLabel={publishQuestion?.confirmLabel}
            cancelLabel={publishQuestion?.cancelLabel}
            onConfirm={() => {
              // The dialog takes a moment to fade: a second press in that
              // moment must not publish twice.
              if (!publishAskOpen || !publishAsk) return;
              setPublishAskOpen(false);
              void handlePublish(publishAsk);
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
