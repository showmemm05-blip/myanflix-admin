"use client";

import { AlertCircle, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { useUploads, type UploadTask } from "@/lib/context/upload-context";
import { useLanguage } from "@/lib/context/language-context";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { TranslationShape } from "@/lib/i18n/translations";

function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function stageLabel(task: UploadTask, t: TranslationShape): string {
  switch (task.stage) {
    case "uploading-images":
      return t.uploads.stage.uploadingImages;
    case "creating-movie":
      return t.uploads.stage.creatingMovie;
    case "uploading-video":
      return t.uploads.stage.uploadingVideo(task.videoProgress);
    case "processing":
      return t.uploads.stage.processing(formatElapsed(task.processingElapsedSeconds));
    case "published":
      return t.uploads.stage.published;
    case "error":
      return t.uploads.stage.error;
  }
}

function UploadTaskCard({ task }: { task: UploadTask }) {
  const { t } = useLanguage();
  const { retryUpload, dismissTask } = useUploads();

  return (
    <div className="glass-card flex w-80 flex-col gap-2 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {task.stage === "published" ? (
            <CheckCircle2 className="size-4 shrink-0 text-success" />
          ) : task.stage === "error" ? (
            <AlertCircle className="size-4 shrink-0 text-destructive" />
          ) : (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">{stageLabel(task, t)}</p>
            <p className="truncate text-xs text-muted-foreground">{task.title}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismissTask(task.id)}
          aria-label={t.uploads.dismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {task.stage === "uploading-video" && <Progress value={task.videoProgress} className="h-1.5" />}

      {task.stage === "error" && (
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">{task.error}</p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={() => retryUpload(task.id)}
          >
            <RefreshCw className="size-3" />
            {t.common.retry}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Persistent, cross-page publish status — mounted once at the root layout so
 * it survives client-side navigation away from wherever the publish started.
 * The pipeline keeps running either way (an in-flight fetch doesn't stop
 * just because the component that started it unmounts); this is what gives
 * that survival visible feedback wherever you are in the app, all the way
 * through to the movie actually going live.
 */
export function GlobalUploadIndicator() {
  const { tasks } = useUploads();

  if (tasks.length === 0) return null;

  return (
    <div className="fixed right-4 top-20 z-40 flex flex-col gap-2">
      {tasks.map((task) => (
        <UploadTaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
