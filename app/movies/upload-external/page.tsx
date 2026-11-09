"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, WifiOff } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { EditMovieDialog, type EditMovieTarget } from "@/components/movies/EditMovieDialog";
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
import { toast } from "sonner";

/**
 * Upload Movie: one transcoded folder = one movie. Since 2026-11-06
 * (docs/movie-details-tmdb-2026-11-06) the server looks each movie up on
 * TMDB when its upload finishes, so a finished card gains one line — what
 * TMDB found, and the button for when a person has to choose. The upload
 * itself never waits for TMDB and never fails because of it; while TMDB is
 * not connected the cards are exactly as before, under one quiet line.
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
    // name, so its card does too.
    onSettled: (state) => {
      if (state.status !== "MATCHED") return;
      movieService.getMovieById(state.movieId).then(
        (movie) => patchJobTitle(movie.id, movie.title),
        () => {},
      );
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
      } finally {
        setLookupBusyId(null);
      }
    },
    [markPending, refreshTmdb, t],
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

  const handlePublish = useCallback(
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
          if (result.kind === "movie") patchJobTitle(result.movie.id, result.movie.title);
          refreshTmdb();
          toast.success(t.tmdbPages.readyToPublish.appliedToast);
        }}
        onApplyFailed={refreshTmdb}
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
        }}
        onSaved={(updated) => {
          patchJobTitle(updated.id, updated.title);
          if (updated.status === "PUBLISHED") markPublished(updated.id);
        }}
      />
    </div>
    </RequirePermission>
  );
}
