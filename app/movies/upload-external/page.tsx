"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, WifiOff } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { EditMovieDialog, type EditMovieTarget } from "@/components/movies/EditMovieDialog";
import {
  createAnswerOrder,
  missingMovieDetailsOrNull,
  publishQuestionWords,
  sameMissingDetails,
  type MissingDetails,
  type PublishQuestionWords,
} from "@/components/movies/missingDetails";
import { TmdbMatchDialog, tmdbTargetOfMovie } from "@/components/tmdb/TmdbMatchDialog";
import { tmdbActionOpensDialog, type TmdbAction } from "@/components/tmdb/tmdbStatus";
import { tmdbErrorCode, tmdbErrorMessage } from "@/components/tmdb/tmdbWords";
import { UploadQueueList, type UploadQueueTmdb } from "@/components/uploads/UploadQueueList";
import { Card, CardContent } from "@/components/ui/card";
import {
  useBulkUploadQueue,
  type MovieUploadJob,
  type MovieUploadStatus,
} from "@/lib/context/bulk-upload-context";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { useTmdbConnection, useTmdbStates } from "@/lib/hooks/use-tmdb-states";
import { readDroppedFolders, foldersFromFileList, type DroppedFolder } from "@/lib/upload/read-dropped-folders";
import { movieService } from "@/services/api/movieService";
import { tmdbService } from "@/services/api/tmdbService";
import type { Movie } from "@/types/movie";
import { toast } from "sonner";

const NOTHING_KNOWN: ReadonlyMap<string, MissingDetails | null> = new Map();
const NO_IDS: ReadonlySet<string> = new Set();

/**
 * Upload Movie: one transcoded folder = one movie. Since 2026-11-06
 * (docs/movie-details-tmdb-2026-11-06) the server looks each movie up on
 * TMDB when its upload finishes, so a finished card gains one line — what
 * TMDB found, and the button for when a person has to choose. The upload
 * itself never waits for TMDB and never fails because of it; while TMDB is
 * not connected the cards are exactly as before, under one quiet line.
 *
 * Since 2026-11-09 a finished card also says what the movie still needs
 * before it is published — "Still needed: Poster" — and its Publish asks
 * first while a poster, a description or a category is missing. Publishing
 * is never blocked (components/movies/missingDetails.ts).
 */
export default function BulkUploadExternalPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const {
    jobs,
    restoring,
    isOnline,
    addFolders,
    pause,
    resume,
    retry,
    cancel,
    remove,
    reattachFolder,
    moveWaitingToIndex,
    markPublished,
    patchJobTitle,
  } = useBulkUploadQueue();

  const [isDragging, setIsDragging] = useState(false);
  // The dialog loads the movie itself, so a card only has to name it.
  const [editMovie, setEditMovie] = useState<EditMovieTarget | null>(null);

  // ---- What each finished movie still needs ----
  // A card only knows its movie's id and name, so the movies are read: by
  // movie id, what each one lacks. Kept as the lists themselves, each one
  // the same object for as long as it says the same — they go to the
  // memoized cards. No entry = not known: no line, and Publish does not ask.
  const [missingByMovie, setMissingByMovie] = useState(NOTHING_KNOWN);
  // Which answer about each movie is the newest. A movie is read more than
  // once (the first read, again when TMDB has filled it in, a Save's own
  // answer) and the answers can land in another order than they were asked:
  // every read takes a number when it is sent, and an answer that a newer
  // one has overtaken is dropped.
  const answersRef = useRef(createAnswerOrder());

  // The movie as the server has it now: its card takes the name, and the
  // line what is still needed. `sent` is the number its read took when it
  // was sent; left out, the movie is news of this moment (a Save, an Apply)
  // and wins over every read still on its way. Stable — it is called from
  // effects.
  const noteMovie = useCallback(
    (movie: Movie, sent?: number) => {
      const answers = answersRef.current;
      if (!answers.accept(movie.id, sent ?? answers.send())) return;
      patchJobTitle(movie.id, movie.title);
      const missing = missingMovieDetailsOrNull(movie);
      setMissingByMovie((prev) =>
        prev.has(movie.id) && sameMissingDetails(prev.get(movie.id), missing)
          ? prev
          : new Map(prev).set(movie.id, missing),
      );
    },
    [patchJobTitle],
  );

  // One movie read again, after something changed it on the server. A
  // failed read is silent: the card keeps what it showed. The promise ends
  // when the read has, whichever way.
  const readMovie = useCallback(
    (movieId: string) => {
      const sent = answersRef.current.send();
      return movieService.getMovieById(movieId).then(
        (movie) => noteMovie(movie, sent),
        () => {},
      );
    },
    [noteMovie],
  );

  // Movies TMDB has just filled in, until they have been read again. The
  // badge turns green a moment before that read lands, and for that moment
  // the card would say "Still needed: Poster" about a poster that has
  // arrived — so its line keeps saying that the list is coming.
  const [missingPending, setMissingPending] = useState(NO_IDS);

  // ---- Details from TMDB ----
  // The status and the states both ask MOVIES.VIEW. `lookupsRun` is only
  // what the server itself said: it has a key, so a finished upload is
  // looked up. Unknown (still loading, the read failed) promises nothing.
  const canSeeTmdb = can("MOVIES.VIEW");
  const canUseTmdb = can("MOVIES.EDIT") && can("MEDIA.UPLOAD");
  const connection = useTmdbConnection({ enabled: canSeeTmdb });
  const lookupsRun = connection.status?.configured === true;
  // The states wait for the server's answer about its key, and a server
  // without one is not asked at all: every state would read NONE, and the
  // cards name their folder themselves.
  const connectionAnswered = !(connection.isLoading && connection.status === null);

  // Only finished uploads have something to say; the others are still folders.
  const readyIds = useMemo(
    () => jobs.filter((j) => j.status === "ready_to_publish").map((j) => j.movieId),
    [jobs],
  );
  const tmdb = useTmdbStates(readyIds, {
    enabled: canSeeTmdb && connectionAnswered && !connection.notConnected,
    // "Finding details…" ended with a match: the movie now carries TMDB's
    // name and details, so its card does too. Without a match nothing
    // changed — the movie is read only if it never was (the first read of
    // it failed), because the card said its list would appear now.
    onSettled: (state) => {
      const { movieId } = state;
      if (state.status === "MATCHED") {
        setMissingPending((prev) => new Set(prev).add(movieId));
        void readMovie(movieId).then(() =>
          setMissingPending((prev) => {
            const next = new Set(prev);
            next.delete(movieId);
            return next;
          }),
        );
      } else if (!answersRef.current.has(movieId)) {
        void readMovie(movieId);
      }
    },
  });
  const { markPending, refresh: refreshTmdb } = tmdb;
  const tmdbNotConnected = canSeeTmdb && (connection.notConnected || tmdb.notConfigured);
  // No TMDB line while there is nothing to put in it: TMDB is off, this
  // member may not read the states, or the read was refused and no card has one.
  const tmdbOff = !canSeeTmdb || tmdbNotConnected || (tmdb.error !== null && tmdb.states.size === 0);

  // An upload that finishes while this page is open: the server starts the
  // lookup a moment after the upload's own answer, so the card says
  // "Finding details…" at once and the states are read until it settles.
  // Cards already finished when the page opened are simply read once.
  const previousStatusRef = useRef(new Map<string, MovieUploadStatus>());
  useEffect(() => {
    const previous = previousStatusRef.current;
    if (lookupsRun) {
      for (const job of jobs) {
        const before = previous.get(job.movieId);
        if (job.status === "ready_to_publish" && before !== undefined && before !== "ready_to_publish") {
          markPending(job.movieId);
        }
      }
    }
    previousStatusRef.current = new Map(jobs.map((j) => [j.movieId, j.status]));
  }, [jobs, lookupsRun, markPending]);

  // The first read of each finished card's movie, in one request: the cards
  // already finished when the page opens, and every upload as it finishes.
  // Asked once per card. A failed read is silent — those cards show no line
  // and publish without a question, exactly as before.
  const askedRef = useRef(new Set<string>());
  useEffect(() => {
    const ids = readyIds.filter((id) => !askedRef.current.has(id));
    if (ids.length === 0) return;
    for (const id of ids) askedRef.current.add(id);
    const sent = answersRef.current.send();
    movieService.getMoviesByIds(ids).then(
      (movies) => {
        for (const movie of movies) noteMovie(movie, sent);
      },
      () => {},
    );
  }, [readyIds, noteMovie]);

  const [lookupBusyId, setLookupBusyId] = useState<string | null>(null);
  const [tmdbDialog, setTmdbDialog] = useState<{ job: MovieUploadJob; start: "pick" | "refill" } | null>(null);

  // Stable, like handleEdit / handlePublish below: it goes to the memoized cards.
  const handleTmdbAction = useCallback(
    async (job: MovieUploadJob, action: TmdbAction) => {
      if (action === "refresh") {
        refreshTmdb();
        return;
      }
      if (tmdbActionOpensDialog(action)) {
        setTmdbDialog({ job, start: action === "refill" ? "refill" : "pick" });
        return;
      }
      // "Find details" / "Try again": the automatic lookup, in the background.
      setLookupBusyId(job.movieId);
      try {
        await tmdbService.lookupMovie(job.movieId);
        markPending(job.movieId);
        toast.success(t.tmdbPages.readyToPublish.lookupStartedToast, {
          description: t.tmdbPages.readyToPublish.lookupStartedDescription(job.title),
        });
      } catch (err) {
        toast.error(t.tmdbPages.readyToPublish.lookupFailedToast, { description: tmdbErrorMessage(err, t) });
        // Refused because the card is behind the server: a lookup is
        // already running, or the movie is matched by now.
        const code = tmdbErrorCode(err);
        if (code === "TMDB_BUSY" || code === "TMDB_ALREADY_MATCHED") refreshTmdb();
        // Matched by a lookup this page never saw end: its details are news too.
        if (code === "TMDB_ALREADY_MATCHED") void readMovie(job.movieId);
      } finally {
        setLookupBusyId(null);
      }
    },
    [markPending, readMovie, refreshTmdb, t],
  );

  const queueTmdb = useMemo<UploadQueueTmdb | undefined>(
    () =>
      tmdbOff
        ? undefined
        : {
            states: tmdb.states,
            canAct: canUseTmdb,
            busyId: lookupBusyId,
            timedOut: tmdb.timedOut,
            looksUpAfterUpload: lookupsRun,
            onAction: handleTmdbAction,
          },
    [tmdbOff, tmdb.states, tmdb.timedOut, canUseTmdb, lookupBusyId, lookupsRun, handleTmdbAction],
  );

  const addDroppedFolders = async (folders: DroppedFolder[]) => {
    const toAdd = folders.filter((f) => f.files.length > 0);
    if (toAdd.length === 0) {
      toast.error(t.movies.externalUpload.emptyFolderToast);
      return;
    }
    const added = await addFolders(toAdd);
    if (added > 0) toast.success(t.movies.externalUpload.moviesAddedToast(added));
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    try {
      const folders = await readDroppedFolders(e.dataTransfer);
      if (folders.length === 0) {
        toast.error(t.movies.externalUpload.noFoldersToast);
        return;
      }
      await addDroppedFolders(folders);
    } catch {
      toast.error(t.movies.externalUpload.readFoldersFailedToast, {
        description: t.movies.externalUpload.readFoldersFailedDescription(t.movies.externalUpload.addFolder),
      });
    }
  };

  // Stable references — passed straight through to UploadQueueList's memoized
  // job cards, so a new closure here on every render would defeat that
  // memoization for every card, not just the one being edited/published.
  const handleEdit = useCallback((job: MovieUploadJob) => {
    setEditMovie({ id: job.movieId, title: job.title });
  }, []);

  const publishMovie = useCallback(
    async (job: MovieUploadJob) => {
      try {
        await movieService.updateMovie(job.movieId, { status: "PUBLISHED" });
        markPublished(job.movieId);
        toast.success(t.movies.publishedToast, { description: t.movies.publishedDescription(job.title) });
      } catch {
        toast.error(t.movies.publishFailedToast, { description: t.movies.pleaseTryAgain });
      }
    },
    [markPublished, t],
  );

  // Publish asks first while the movie still needs a poster, a description
  // or a category; with nothing needed, or nothing known, it goes straight
  // through as before. What is needed is read from a ref at the press, so
  // the callback stays the same for the cards. The question's words stay
  // while it closes; only `publishQuestionOpen` goes.
  const missingRef = useRef(missingByMovie);
  useEffect(() => {
    missingRef.current = missingByMovie;
  });
  const [publishQuestion, setPublishQuestion] = useState<{
    job: MovieUploadJob;
    words: PublishQuestionWords;
  } | null>(null);
  const [publishQuestionOpen, setPublishQuestionOpen] = useState(false);

  const handlePublish = useCallback(
    (job: MovieUploadJob) => {
      const words = publishQuestionWords(t, "movie", job.title, missingRef.current.get(job.movieId));
      if (!words) {
        void publishMovie(job);
        return;
      }
      setPublishQuestion({ job, words });
      setPublishQuestionOpen(true);
    },
    [publishMovie, t],
  );

  return (
    <RequirePermission
      permission="MOVIES.CREATE"
      title={t.movies.uploadMovie}
      description={t.movies.externalUpload.description}
    >
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t.movies.uploadMovie}
        // The TMDB sentence only while it is true: the server has a key.
        description={lookupsRun ? t.tmdbPages.upload.pageDescription : t.movies.externalUpload.pageDescription}
      />

      {tmdbNotConnected && (
        <p className="rounded-lg border border-border bg-secondary/20 px-4 py-2.5 text-sm text-muted-foreground">
          {t.tmdbPages.notConnected}
        </p>
      )}

      {!isOnline && (
        <div className="flex items-center gap-3 rounded-lg border border-info/25 bg-info/10 px-4 py-3">
          <WifiOff className="size-5 shrink-0 text-info" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-info">{t.movies.externalUpload.waitingForConnection}</p>
            <p className="text-xs text-muted-foreground">
              {t.movies.externalUpload.waitingForConnectionDescription}
            </p>
          </div>
        </div>
      )}

      <Card className="glass-card">
        <CardContent className="flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/10" : "border-input hover:border-primary/50 hover:bg-primary/[0.04]"
            }`}
          >
            <UploadCloud className="size-7 text-muted-foreground" />
            <span className="text-sm font-semibold">{t.movies.externalUpload.dropFoldersHere}</span>
            <span className="text-xs text-muted-foreground">
              {t.movies.externalUpload.folderStructureHint}
            </span>

            <label className="mt-2 cursor-pointer">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary/60">
                <UploadCloud className="size-3.5" />
                {t.movies.externalUpload.addFolder}
              </span>
              <input
                type="file"
                // @ts-expect-error -- webkitdirectory is a real, supported, non-standard attribute for folder selection.
                webkitdirectory=""
                multiple
                className="hidden"
                onChange={(e) => {
                  const folders = e.target.files ? foldersFromFileList(e.target.files) : [];
                  if (folders.length > 0) void addDroppedFolders(folders);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            {t.movies.externalUpload.moviesQueued(jobs.length)}
            {restoring && t.movies.externalUpload.restoringSession}
          </p>
        </CardContent>
      </Card>

      <UploadQueueList
        jobs={jobs}
        restoring={restoring}
        emptyText={t.movies.externalUpload.emptyQueueText}
        onPause={pause}
        onResume={resume}
        onRetry={retry}
        onCancel={cancel}
        onRemove={remove}
        onReorder={moveWaitingToIndex}
        onReattach={reattachFolder}
        canEdit={can("MOVIES.EDIT")}
        canPublish={can("MOVIES.PUBLISH")}
        onEdit={handleEdit}
        onPublish={handlePublish}
        tmdb={queueTmdb}
        missing={missingByMovie}
        missingPending={missingPending}
      />

      {/* "Go back" closes it and nothing happens; "Publish anyway" publishes as the button always did. */}
      <ConfirmDialog
        open={publishQuestionOpen}
        onOpenChange={(o) => !o && setPublishQuestionOpen(false)}
        title={publishQuestion?.words.title ?? ""}
        description={publishQuestion?.words.description ?? ""}
        confirmLabel={publishQuestion?.words.confirmLabel}
        cancelLabel={publishQuestion?.words.cancelLabel}
        onConfirm={() => {
          // The dialog takes a moment to fade: a second press in that
          // moment must not publish twice.
          if (!publishQuestionOpen || !publishQuestion) return;
          setPublishQuestionOpen(false);
          void publishMovie(publishQuestion.job);
        }}
      />

      <TmdbMatchDialog
        open={!!tmdbDialog}
        onOpenChange={(o) => !o && setTmdbDialog(null)}
        target={
          tmdbDialog
            ? tmdbTargetOfMovie(
                { id: tmdbDialog.job.movieId, title: tmdbDialog.job.title },
                tmdb.states.get(tmdbDialog.job.movieId),
              )
            : null
        }
        start={tmdbDialog?.start}
        onApplied={(result) => {
          // The details are written; the dialog stays on its summary.
          if (result.kind === "movie") noteMovie(result.movie);
          refreshTmdb();
          toast.success(t.tmdbPages.readyToPublish.appliedToast);
        }}
        // Refused or broken off: read the movie again, so the card does not
        // say something half-done.
        onApplyFailed={() => {
          refreshTmdb();
          if (tmdbDialog) void readMovie(tmdbDialog.job.movieId);
        }}
      />

      <EditMovieDialog
        movie={editMovie}
        open={!!editMovie}
        onOpenChange={(o) => {
          if (o) return;
          setEditMovie(null);
          // The dialog has its own TMDB strip: a match picked or a lookup
          // started in there shows on the card once it is closed. Asked also
          // while the TMDB lines are hidden because a read failed — this is
          // what brings them back. (Nothing is asked while TMDB is off.)
          refreshTmdb();
          // Details can also arrive in there without the dialog saying so
          // (a lookup ended while the form held unsaved changes, then
          // Cancel), so the card's movie is read once more.
          if (editMovie) void readMovie(editMovie.id);
        }}
        onSaved={(updated) => {
          noteMovie(updated);
          if (updated.status === "PUBLISHED") markPublished(updated.id);
        }}
      />
    </div>
    </RequirePermission>
  );
}
