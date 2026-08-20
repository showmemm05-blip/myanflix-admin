"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
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
import { useLanguage } from "@/lib/context/language-context";
import { foldersFromFileList, type DroppedFolder } from "@/lib/upload/read-dropped-folders";
import { formatBytes, formatEta, formatSpeed } from "@/lib/upload/format";
import type { TranslationShape } from "@/lib/i18n/translations";
import { toast } from "sonner";

function getStatusMeta(t: TranslationShape): Record<MovieUploadStatus, { label: string; tone: StatusTone }> {
  return {
    waiting: { label: t.uploads.status.waiting, tone: "neutral" },
    uploading: { label: t.uploads.status.uploading, tone: "info" },
    paused: { label: t.uploads.status.waiting, tone: "warning" },
    offline: { label: t.uploads.status.waiting, tone: "info" },
    failed: { label: t.uploads.status.failed, tone: "danger" },
    completed: { label: t.uploads.status.processing, tone: "info" },
    ready_to_publish: { label: t.uploads.status.completed, tone: "success" },
  };
}
function getFinalizingMeta(t: TranslationShape) {
  return { label: t.uploads.status.finalizing, tone: "info" as StatusTone };
}

/** True once every chunk of the job's still-in-flight asset(s) has reached the backend, which is now merging them and pushing the result to storage — distinct from "uploading" so the UI doesn't just look stuck at 100%. */
function isFinalizing(job: MovieUploadJob) {
  if (job.status !== "uploading") return false;
  const active = job.assets.filter((a) => a.status !== "done" && a.status !== "error");
  return active.length > 0 && active.every((a) => a.status === "finalizing");
}

interface UploadJobCardProps {
  job: MovieUploadJob;
  position: number | undefined;
  isDraggable: boolean;
  isDragging: boolean;
  onDragStart: (key: string) => void;
  onDrop: (key: string, position: number | undefined) => void;
  onDragEnd: () => void;
  onPause: (key: string) => void;
  onResume: (key: string) => void;
  onRetry: (key: string) => void;
  onCancel: (key: string) => void;
  onRemove: (key: string) => void;
  onEdit: (job: MovieUploadJob) => void;
  onPublish: (job: MovieUploadJob) => void;
  /** MOVIES.EDIT — the per-job "Details" dialog writes to the movie. */
  canEdit: boolean;
  /** MOVIES.PUBLISH — the inline publish button on a finished job. */
  canPublish: boolean;
  onAttachClick: (key: string) => void;
}

/**
 * One queue card, memoized so a progress tick on the active upload doesn't
 * re-render every other (e.g. "Waiting") card in the list. Relies on the
 * caller passing a stable `job` reference for untouched jobs and stable
 * callback props — both already true of `bulk-upload-context.tsx`.
 */
const UploadJobCard = memo(function UploadJobCard({
  job,
  position,
  isDraggable,
  isDragging,
  onDragStart,
  onDrop,
  onDragEnd,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onRemove,
  onEdit,
  onPublish,
  canEdit,
  canPublish,
  onAttachClick,
}: UploadJobCardProps) {
  const { t } = useLanguage();
  const finalizing = isFinalizing(job);
  const meta = finalizing ? getFinalizingMeta(t) : getStatusMeta(t)[job.status];
  const isActive = job.status === "uploading" || job.status === "completed";
  const showProgress = isActive || job.status === "paused" || job.status === "offline";
  const total = totalBytes(job);
  const uploaded = uploadedBytes(job);
  const percent = total > 0 ? Math.round((uploaded / total) * 100) : 0;
  const subtitle = job.subtitle;

  return (
    <Card
      draggable={isDraggable}
      onDragStart={() => isDraggable && onDragStart(job.key)}
      onDragOver={(e) => {
        if (isDraggable) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (isDraggable) onDrop(job.key, position);
      }}
      onDragEnd={onDragEnd}
      className={`glass-card transition-colors ${
        job.status === "uploading" ? "border-info/25 bg-info/10" : ""
      } ${isDragging ? "opacity-50" : ""}`}
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
              {t.uploads.filesCount(job.assets.length)} · {formatBytes(total)}
              {position && t.uploads.queuePosition(position)}
            </p>
          </div>
          <StatusBadge label={meta.label} tone={meta.tone} />
        </div>

        {showProgress && (
          <div className="flex flex-col gap-1.5">
            <Progress value={job.status === "completed" ? 100 : percent} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {finalizing
                  ? t.uploads.finalizingUpload
                  : job.status === "completed"
                    ? t.uploads.validatingBundle
                    : job.status === "offline"
                      ? t.movies.externalUpload.waitingForConnection
                      : job.status === "paused"
                        ? t.uploads.pausedAt(percent)
                        : formatSpeed(job.speedBps)}
              </span>
              <span className="tabular-nums">
                {job.status === "uploading" && !finalizing ? formatEta(job.etaSeconds) : `${percent}%`}
              </span>
            </div>
          </div>
        )}

        {job.status === "failed" && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0 translate-y-0.5" />
            <span>{job.error ?? t.uploads.uploadFailedFallback}</span>
          </div>
        )}

        {job.needsReattach && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-info/25 bg-info/10 p-2.5 text-xs">
            <span className="text-info">
              {t.uploads.needsReattachText}
            </span>
            <Button size="sm" variant="outline" onClick={() => onAttachClick(job.key)}>
              {t.uploads.attachFolder}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {canPublish && job.status === "ready_to_publish" && (
            <Button size="sm" onClick={() => onPublish(job)}>
              <Rocket className="size-3.5" />
              {t.movies.publish}
            </Button>
          )}
          {job.status === "uploading" && (
            <Button variant="outline" size="sm" onClick={() => onPause(job.key)}>
              <Pause className="size-3.5" />
              {t.uploads.pause}
            </Button>
          )}
          {job.status === "paused" && (
            <Button variant="outline" size="sm" onClick={() => onResume(job.key)}>
              <Play className="size-3.5" />
              {t.uploads.resume}
            </Button>
          )}
          {job.status === "failed" && (
            <Button variant="outline" size="sm" onClick={() => onRetry(job.key)}>
              <RotateCcw className="size-3.5" />
              {t.common.retry}
            </Button>
          )}
          {(job.status === "uploading" ||
            job.status === "waiting" ||
            job.status === "paused" ||
            job.status === "offline") && (
            <Button variant="outline" size="sm" onClick={() => onCancel(job.key)}>
              <X className="size-3.5" />
              {t.common.cancel}
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(job)}>
              <Pencil className="size-3.5" />
              {t.uploads.details}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(job.key)}
          >
            {t.uploads.remove}
          </Button>
          {job.status === "completed" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {job.status === "ready_to_publish" && <CheckCircle2 className="size-4 text-success" />}
        </div>
      </CardContent>
    </Card>
  );
});

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
  canEdit: boolean;
  canPublish: boolean;
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
  canEdit,
  canPublish,
}: UploadQueueListProps) {
  const { t } = useLanguage();
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

  // Stable across renders (only change when drag state itself changes, not
  // on every progress tick) — this is what actually lets UploadJobCard's
  // React.memo take effect during an upload.
  const handleDragStart = useCallback((key: string) => setDraggingKey(key), []);
  const handleDragEnd = useCallback(() => setDraggingKey(null), []);
  const handleDrop = useCallback(
    (targetKey: string, targetPosition: number | undefined) => {
      if (draggingKey && draggingKey !== targetKey) onReorder(draggingKey, (targetPosition ?? 1) - 1);
      setDraggingKey(null);
    },
    [draggingKey, onReorder],
  );
  const handleAttachClick = useCallback((key: string) => {
    setReattachTarget(key);
    reattachInputRef.current?.click();
  }, []);

  const handleReattachChange = (fileList: FileList | null) => {
    if (!fileList || !reattachTarget) return;
    const [folder] = foldersFromFileList(fileList);
    if (folder) {
      onReattach(reattachTarget, folder);
      toast.success(t.uploads.reattachedToast);
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

      {sortedJobs.map((job) => (
        <UploadJobCard
          key={job.key}
          job={job}
          position={waitingPosition.get(job.key)}
          isDraggable={job.status === "waiting"}
          isDragging={draggingKey === job.key}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onPause={onPause}
          onResume={onResume}
          onRetry={onRetry}
          onCancel={onCancel}
          onRemove={onRemove}
          onEdit={onEdit}
          onPublish={onPublish}
          canEdit={canEdit}
          canPublish={canPublish}
          onAttachClick={handleAttachClick}
        />
      ))}
    </div>
  );
}
