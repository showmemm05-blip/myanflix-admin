"use client";

import { useState } from "react";
import { UploadCloud, WifiOff } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequireRole } from "@/components/shared/RequireRole";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
import { UploadQueueList } from "@/components/uploads/UploadQueueList";
import { Card, CardContent } from "@/components/ui/card";
import { useBulkUploadQueue, type MovieUploadJob } from "@/lib/context/bulk-upload-context";
import { readDroppedFolders, foldersFromFileList, type DroppedFolder } from "@/lib/upload/read-dropped-folders";
import { movieService } from "@/services/api/movieService";
import type { Movie } from "@/types/movie";
import { toast } from "sonner";

export default function BulkUploadExternalPage() {
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
      toast.error("That folder appears to be empty.");
      return;
    }
    const added = await addFolders(toAdd);
    if (added > 0) toast.success(`${added} movie${added === 1 ? "" : "s"} added to the queue`);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    try {
      const folders = await readDroppedFolders(e.dataTransfer);
      if (folders.length === 0) {
        toast.error("Drop one or more movie folders — individual files aren't supported here.");
        return;
      }
      await addDroppedFolders(folders);
    } catch {
      toast.error("Couldn't read the dropped folders", { description: "Try again, or use “Add folder” instead." });
    }
  };

  const handleEdit = async (job: MovieUploadJob) => {
    try {
      const movie = await movieService.getMovieById(job.movieId);
      setEditMovie(movie);
    } catch {
      toast.error("Couldn't load this movie's details");
    }
  };

  const handlePublish = async (job: MovieUploadJob) => {
    try {
      await movieService.updateMovie(job.movieId, { status: "PUBLISHED" });
      markPublished(job.movieId);
      toast.success("Movie published", { description: `"${job.title}" is now live on MyanFlix.` });
    } catch {
      toast.error("Couldn't publish this movie", { description: "Please try again." });
    }
  };

  return (
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN", "CONTENT_UPLOADER"]}
      title="Upload Movie"
      description="Drop movie folders — they upload one at a time in order, the rest wait in queue."
    >
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Upload Movie"
        description="Drop movie folders — they upload one at a time in order, the rest wait in queue. This system never runs ffmpeg for this flow, and never publishes a movie automatically."
      />

      {!isOnline && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
          <WifiOff className="size-5 shrink-0 text-sky-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sky-300">Waiting for internet connection...</p>
            <p className="text-xs text-muted-foreground">
              Uploads are paused and will resume automatically from where they left off — nothing is lost.
            </p>
          </div>
        </div>
      )}

      <Card className="glass-card border-white/[0.08]">
        <CardContent className="flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/10" : "border-white/15 hover:border-primary/40 hover:bg-secondary/20"
            }`}
          >
            <UploadCloud className="size-7 text-muted-foreground" />
            <span className="text-sm font-semibold">Drop movie folders here</span>
            <span className="text-xs text-muted-foreground">
              Each folder: original.mp4 · master.m3u8 · 240p–1080p · subtitles/
            </span>

            <label className="mt-2 cursor-pointer">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary/60">
                <UploadCloud className="size-3.5" />
                Add folder
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
            {jobs.length} movie{jobs.length === 1 ? "" : "s"} queued
            {restoring && " · restoring your last session..."}
          </p>
        </CardContent>
      </Card>

      <UploadQueueList
        jobs={jobs}
        restoring={restoring}
        emptyText="No movies queued yet — drop or add a folder above to get started."
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
