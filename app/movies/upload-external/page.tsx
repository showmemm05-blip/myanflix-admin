"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  GripVertical,
  Loader2,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  UploadCloud,
  WifiOff,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { EditMovieDialog } from "@/components/movies/EditMovieDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useBulkExternalUpload,
  MAX_BULK_MOVIES,
  totalBytes,
  uploadedBytes,
  type MovieUploadJob,
  type MovieUploadStatus,
} from "@/lib/context/bulk-upload-context";
import { readDroppedFolders, foldersFromFileList, type DroppedFolder } from "@/lib/upload/read-dropped-folders";
import { movieService } from "@/services/api/movieService";
import type { Movie } from "@/types/movie";
import { toast } from "sonner";

const STATUS_META: Record<MovieUploadStatus, { label: string; tone: StatusTone }> = {
  waiting: { label: "Waiting", tone: "neutral" },
  uploading: { label: "Uploading", tone: "info" },
  paused: { label: "Paused", tone: "warning" },
  offline: { label: "Waiting for internet connection", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
  completed: { label: "Completed", tone: "info" },
  ready_to_publish: { label: "Ready to publish", tone: "warning" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex++;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : "—";
}

function formatEta(seconds: number | null): string {
  if (seconds === null) return "Estimating...";
  if (seconds < 60) return `${Math.round(seconds)}s remaining`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s remaining`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m remaining`;
}

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
  } = useBulkExternalUpload();

  const [isDragging, setIsDragging] = useState(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [editMovie, setEditMovie] = useState<Movie | null>(null);
  const [reattachTarget, setReattachTarget] = useState<string | null>(null);
  const reattachInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = MAX_BULK_MOVIES - jobs.length;
  const canAddMore = remainingSlots > 0;

  const waitingPosition = useMemo(() => {
    const waiting = jobs.filter((j) => j.status === "waiting").sort((a, b) => a.queueOrder - b.queueOrder);
    return new Map(waiting.map((j, i) => [j.key, i + 1]));
  }, [jobs]);

  const sortedJobs = useMemo(() => {
    const rank = (j: MovieUploadJob) => (j.status === "uploading" ? 0 : j.status === "waiting" ? 1 : 2);
    return [...jobs].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      if (a.status === "waiting" && b.status === "waiting") return a.queueOrder - b.queueOrder;
      return a.addedAt - b.addedAt;
    });
  }, [jobs]);

  const addDroppedFolders = async (folders: DroppedFolder[]) => {
    const toAdd = folders.filter((f) => f.files.length > 0).slice(0, remainingSlots);
    if (toAdd.length === 0) {
      toast.error(canAddMore ? "That folder appears to be empty." : `You can only queue up to ${MAX_BULK_MOVIES} movies at once.`);
      return;
    }
    if (folders.length > toAdd.length) {
      toast.error(`Only added ${toAdd.length} of ${folders.length} folders — the ${MAX_BULK_MOVIES}-movie limit was reached.`);
    }
    const added = await addFolders(toAdd);
    if (added > 0) toast.success(`${added} movie${added === 1 ? "" : "s"} added to the queue`);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canAddMore) {
      toast.error(`You can only queue up to ${MAX_BULK_MOVIES} movies at once.`);
      return;
    }
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

  const handlePickFolder = async (fileList: FileList | null) => {
    if (!fileList) return;
    const folders = foldersFromFileList(fileList);
    if (folders.length === 0) return;
    await addDroppedFolders(folders);
  };

  const handleReattachClick = (key: string) => {
    setReattachTarget(key);
    reattachInputRef.current?.click();
  };

  const handleReattachChange = (fileList: FileList | null) => {
    if (!fileList || !reattachTarget) return;
    const [folder] = foldersFromFileList(fileList);
    if (folder) {
      reattachFolder(reattachTarget, folder);
      toast.success("Folder re-attached — it'll resume shortly.");
    }
    setReattachTarget(null);
  };

  const handleEdit = async (job: MovieUploadJob) => {
    try {
      const movie = await movieService.getMovieById(job.movieId);
      setEditMovie(movie);
    } catch {
      toast.error("Couldn't load this movie's details");
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Bulk Upload (Pre-Transcoded)"
        description="Drop up to 10 movie folders — they upload one at a time in order, the rest wait in queue. This system never runs ffmpeg for this flow, and never publishes a movie automatically."
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
              if (canAddMore) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/10"
                : canAddMore
                  ? "border-white/15 hover:border-primary/40 hover:bg-secondary/20"
                  : "border-white/10 opacity-60"
            }`}
          >
            <UploadCloud className="size-7 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {canAddMore ? "Drop up to 10 movie folders here" : `Limit reached (${MAX_BULK_MOVIES}/${MAX_BULK_MOVIES})`}
            </span>
            <span className="text-xs text-muted-foreground">
              Each folder: original.mp4 · master.m3u8 · 240p–1080p · subtitles/
            </span>

            <label className={`mt-2 ${canAddMore ? "cursor-pointer" : "pointer-events-none opacity-50"}`}>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary/60">
                <UploadCloud className="size-3.5" />
                Add folder
              </span>
              <input
                type="file"
                // @ts-expect-error -- webkitdirectory is a real, supported, non-standard attribute for folder selection.
                webkitdirectory=""
                multiple
                disabled={!canAddMore}
                className="hidden"
                onChange={(e) => {
                  void handlePickFolder(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            {jobs.length}/{MAX_BULK_MOVIES} movies queued
            {restoring && " · restoring your last session..."}
          </p>
        </CardContent>
      </Card>

      {/* Shared hidden picker for re-attaching a folder after a refresh — one input, retargeted per row via reattachTarget. */}
      <input
        ref={reattachInputRef}
        type="file"
        // @ts-expect-error -- webkitdirectory is a real, supported, non-standard attribute for folder selection.
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={(e) => {
          handleReattachChange(e.target.files);
          e.target.value = "";
        }}
      />

      {!restoring && jobs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No movies queued yet — drop or add a folder above to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedJobs.map((job) => {
            const meta = STATUS_META[job.status];
            const isActive = job.status === "uploading" || job.status === "completed";
            const showProgress = isActive || job.status === "paused" || job.status === "offline";
            const total = totalBytes(job);
            const uploaded = uploadedBytes(job);
            const percent = total > 0 ? Math.round((uploaded / total) * 100) : 0;
            const position = waitingPosition.get(job.key);
            const isDraggable = job.status === "waiting";

            return (
              <Card
                key={job.key}
                draggable={isDraggable}
                onDragStart={() => isDraggable && setDraggingKey(job.key)}
                onDragOver={(e) => {
                  if (isDraggable) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggingKey || draggingKey === job.key || !isDraggable) return;
                  moveWaitingToIndex(draggingKey, (position ?? 1) - 1);
                  setDraggingKey(null);
                }}
                onDragEnd={() => setDraggingKey(null)}
                className={`glass-card border-white/[0.08] transition-colors ${
                  job.status === "uploading" ? "border-sky-500/30 bg-sky-500/[0.03]" : ""
                } ${draggingKey === job.key ? "opacity-50" : ""}`}
              >
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    {isDraggable && (
                      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{job.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {job.assets.length} files · {formatBytes(total)}
                        {position && ` · Queue position #${position}`}
                      </p>
                    </div>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </div>

                  {showProgress && (
                    <div className="flex flex-col gap-1.5">
                      <Progress value={job.status === "completed" ? 100 : percent} className="h-1.5" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {job.status === "completed"
                            ? "Validating bundle..."
                            : job.status === "offline"
                              ? "Waiting for internet connection..."
                              : job.status === "paused"
                                ? `Paused at ${percent}%`
                                : formatSpeed(job.speedBps)}
                        </span>
                        <span className="tabular-nums">
                          {job.status === "uploading" ? formatEta(job.etaSeconds) : `${percent}%`}
                        </span>
                      </div>
                    </div>
                  )}

                  {job.status === "failed" && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                      <AlertCircle className="size-3.5 shrink-0 translate-y-0.5" />
                      <span>{job.error ?? "Upload failed."}</span>
                    </div>
                  )}

                  {job.needsReattach && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs">
                      <span className="text-sky-300">
                        This queue was restored after a refresh — re-select this movie&rsquo;s folder to resume.
                      </span>
                      <Button size="sm" variant="outline" onClick={() => handleReattachClick(job.key)}>
                        Attach folder
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    {job.status === "uploading" && (
                      <Button variant="outline" size="sm" onClick={() => pause(job.key)}>
                        <Pause className="size-3.5" />
                        Pause
                      </Button>
                    )}
                    {job.status === "paused" && (
                      <Button variant="outline" size="sm" onClick={() => resume(job.key)}>
                        <Play className="size-3.5" />
                        Resume
                      </Button>
                    )}
                    {job.status === "failed" && (
                      <Button variant="outline" size="sm" onClick={() => retry(job.key)}>
                        <RotateCcw className="size-3.5" />
                        Retry
                      </Button>
                    )}
                    {(job.status === "uploading" ||
                      job.status === "waiting" ||
                      job.status === "paused" ||
                      job.status === "offline") && (
                      <Button variant="outline" size="sm" onClick={() => cancel(job.key)}>
                        <X className="size-3.5" />
                        Cancel
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEdit(job)}>
                      <Pencil className="size-3.5" />
                      Details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(job.key)}
                    >
                      Remove
                    </Button>
                    {job.status === "completed" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
  );
}
