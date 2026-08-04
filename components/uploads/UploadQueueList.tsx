"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  GripVertical,
  Loader2,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Rocket,
  X,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  totalBytes,
  uploadedBytes,
  type MovieUploadJob,
  type MovieUploadStatus,
} from "@/lib/context/bulk-upload-context";
import { foldersFromFileList, type DroppedFolder } from "@/lib/upload/read-dropped-folders";
import { formatBytes, formatEta, formatSpeed } from "@/lib/upload/format";
import { toast } from "sonner";

const STATUS_META: Record<MovieUploadStatus, { label: string; tone: StatusTone }> = {
  waiting: { label: "Waiting", tone: "neutral" },
  uploading: { label: "Uploading", tone: "info" },
  paused: { label: "Waiting", tone: "warning" },
  offline: { label: "Waiting", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
  completed: { label: "Processing", tone: "info" },
  ready_to_publish: { label: "Completed", tone: "success" },
};

interface UploadQueueListProps {
  jobs: MovieUploadJob[];
  restoring: boolean;
  emptyText: string;
  onPause: (key: string) => void;
  onResume: (key: string) => void;
  onRetry: (key: string) => void;
  onCancel: (key: string) => void;
  onRemove: (key: string) => void;
  onReorder: (key: string, targetIndex: number) => void;
  onReattach: (key: string, folder: DroppedFolder) => void;
  onEdit: (job: MovieUploadJob) => void;
  onPublish: (job: MovieUploadJob) => void;
}

/**
 * The shared card list for both bulk-upload flows (movies and episodes):
 * active upload pinned to the top, drag-to-reorder among waiting items,
 * per-card progress/speed/ETA/size/position, the full action row, and the
 * re-attach-folder affordance for queues restored after a refresh.
 */
export function UploadQueueList({
  jobs,
  restoring,
  emptyText,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onRemove,
  onReorder,
  onReattach,
  onEdit,
  onPublish,
}: UploadQueueListProps) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [reattachTarget, setReattachTarget] = useState<string | null>(null);
  const reattachInputRef = useRef<HTMLInputElement>(null);

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

  const handleReattachChange = (fileList: FileList | null) => {
    if (!fileList || !reattachTarget) return;
    const [folder] = foldersFromFileList(fileList);
    if (folder) {
      onReattach(reattachTarget, folder);
      toast.success("Folder re-attached — it'll resume shortly.");
    }
    setReattachTarget(null);
  };

  if (!restoring && jobs.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
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

      {sortedJobs.map((job) => {
        const meta = STATUS_META[job.status];
        const isActive = job.status === "uploading" || job.status === "completed";
        const showProgress = isActive || job.status === "paused" || job.status === "offline";
        const total = totalBytes(job);
        const uploaded = uploadedBytes(job);
        const percent = total > 0 ? Math.round((uploaded / total) * 100) : 0;
        const position = waitingPosition.get(job.key);
        const isDraggable = job.status === "waiting";
        const subtitle = job.subtitle;

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
              onReorder(draggingKey, (position ?? 1) - 1);
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
                    {subtitle ? `${subtitle} · ` : ""}
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
                    This queue was restored after a refresh — re-select this folder to resume.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReattachTarget(job.key);
                      reattachInputRef.current?.click();
                    }}
                  >
                    Attach folder
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                {job.status === "ready_to_publish" && (
                  <Button size="sm" onClick={() => onPublish(job)}>
                    <Rocket className="size-3.5" />
                    Publish
                  </Button>
                )}
                {job.status === "uploading" && (
                  <Button variant="outline" size="sm" onClick={() => onPause(job.key)}>
                    <Pause className="size-3.5" />
                    Pause
                  </Button>
                )}
                {job.status === "paused" && (
                  <Button variant="outline" size="sm" onClick={() => onResume(job.key)}>
                    <Play className="size-3.5" />
                    Resume
                  </Button>
                )}
                {job.status === "failed" && (
                  <Button variant="outline" size="sm" onClick={() => onRetry(job.key)}>
                    <RotateCcw className="size-3.5" />
                    Retry
                  </Button>
                )}
                {(job.status === "uploading" ||
                  job.status === "waiting" ||
                  job.status === "paused" ||
                  job.status === "offline") && (
                  <Button variant="outline" size="sm" onClick={() => onCancel(job.key)}>
                    <X className="size-3.5" />
                    Cancel
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => onEdit(job)}>
                  <Pencil className="size-3.5" />
                  Details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(job.key)}
                >
                  Remove
                </Button>
                {job.status === "completed" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                {job.status === "ready_to_publish" && <CheckCircle2 className="size-4 text-success" />}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
