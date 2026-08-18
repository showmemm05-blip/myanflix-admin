"use client";

import { useCallback, useState } from "react";
import { UploadCloud, WifiOff } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequireRole } from "@/components/shared/RequireRole";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
import { UploadQueueList } from "@/components/uploads/UploadQueueList";
import { Card, CardContent } from "@/components/ui/card";
import { useBulkUploadQueue, type MovieUploadJob } from "@/lib/context/bulk-upload-context";
import { useLanguage } from "@/lib/context/language-context";
import { readDroppedFolders, foldersFromFileList, type DroppedFolder } from "@/lib/upload/read-dropped-folders";
import { movieService } from "@/services/api/movieService";
import type { Movie } from "@/types/movie";
import { toast } from "sonner";

export default function BulkUploadExternalPage() {
  const { t } = useLanguage();
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
  const [editMovie, setEditMovie] = useState<Movie | null>(null);

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
  const handleEdit = useCallback(async (job: MovieUploadJob) => {
    try {
      const movie = await movieService.getMovieById(job.movieId);
      setEditMovie(movie);
    } catch {
      toast.error(t.movies.externalUpload.loadMovieFailedToast);
    }
  }, [t]);

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
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN", "CONTENT_UPLOADER"]}
      title={t.movies.uploadMovie}
      description={t.movies.externalUpload.description}
    >
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t.movies.uploadMovie}
        description={t.movies.externalUpload.pageDescription}
      />

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
        onEdit={handleEdit}
        onPublish={handlePublish}
      />

      <EditMovieDialog
        movie={editMovie}
        open={!!editMovie}
        onOpenChange={(o) => !o && setEditMovie(null)}
        onSaved={(updated) => {
          patchJobTitle(updated.id, updated.title);
          if (updated.status === "PUBLISHED") markPublished(updated.id);
          setEditMovie(updated);
        }}
      />
    </div>
    </RequireRole>
  );
}
