"use client";

import { useRef } from "react";
import { Clapperboard, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { useLanguage } from "@/lib/context/language-context";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { formatBytes } from "@/lib/upload/format";
import { cn } from "@/lib/utils";
import { formatAdDuration } from "@/components/ads/adForm";

/** Where the save is with the picked file: sending bytes, or waiting for the server to check them. */
export interface AdVideoUploadState {
  percent: number;
  phase: "uploading" | "attaching";
}

interface AdVideoFieldProps {
  /** The video already on the ad (editing), or null. */
  current: { url: string | null; durationSeconds: number | null; bytes: number | null } | null;
  /** The file picked now, uploaded on save. */
  file: File | null;
  /** The picked file's length as the browser read it; null while probing or when it could not. */
  fileDurationSeconds: number | null;
  probing: boolean;
  onPick: (file: File) => void;
  /** Drops the picked file (the stored video, if any, stays). */
  onClear: () => void;
  upload: AdVideoUploadState | null;
  /**
   * Shows a "Stop upload" button beside the progress bar. The wizard leaves
   * it out — its footer holds the one Stop button, wherever the admin is.
   */
  onCancelUpload?: () => void;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * The ad's video (the `Wiz2Video` board): a small player over the file
 * picked now (a local object URL) or the stored one (a signed URL), what it
 * is ("New video — it uploads when you save" · its name · "0:30 long ·
 * 12 MB"), the pick / replace / remove buttons, and the progress while the
 * save uploads. There is no "remove the stored video": an ad keeps its
 * video until another replaces it, and switching the ad off is how it
 * stops playing.
 */
export function AdVideoField({
  current,
  file,
  fileDurationSeconds,
  probing,
  onPick,
  onClear,
  upload,
  onCancelUpload,
  disabled = false,
  invalid = false,
}: AdVideoFieldProps) {
  const { t } = useLanguage();
  const v = t.adsUi.wizard.video;
  const progress = t.adsUi.wizard.footer;
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrl = useObjectUrl(file);
  const src = objectUrl ?? current?.url ?? null;
  const uploading = upload !== null;
  const hasVideo = !!file || !!current?.url;

  const metaLine = file
    ? probing
      ? `${v.measuring} · ${formatBytes(file.size)}`
      : fileDurationSeconds === null
        ? `${v.lengthUnknown} · ${formatBytes(file.size)}`
        : v.meta(formatAdDuration(fileDurationSeconds), formatBytes(file.size))
    : current?.url
      ? v.meta(formatAdDuration(current.durationSeconds), current.bytes === null ? "—" : formatBytes(current.bytes))
      : null;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{v.label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,.mp4"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onPick(picked);
          // Reset so picking the same file again (after clearing it) still
          // fires a change event — a file input ignores a repeat selection.
          e.target.value = "";
        }}
      />

      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center",
          invalid ? "border-destructive/60" : "border-[var(--border-strong)]",
        )}
      >
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-black sm:w-56">
          {src ? (
            // The stored URL is signed per read and the picked file is local,
            // so neither has a caption track to offer — the ad is a short clip
            // the admin checks by eye, not content for viewers to read.
            // Keyed on the source: a new src on the same element would keep
            // playing the old one until load() is called.
            <video key={src} src={src} controls preload="metadata" playsInline className="size-full" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Clapperboard className="size-8" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {hasVideo ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">{file ? v.picked : v.current}</span>
              <span className="text-xs break-all text-muted-foreground">
                {file && <>{file.name} · </>}
                {metaLine}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{v.empty}</span>
          )}

          {uploading ? (
            <div className="flex items-center gap-3">
              <Progress value={upload.percent} className="flex-1">
                <ProgressLabel className="text-xs">
                  {upload.phase === "attaching" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" />
                      {progress.checkingVideo}
                    </span>
                  ) : (
                    progress.uploadingVideo(upload.percent)
                  )}
                </ProgressLabel>
                {upload.phase === "uploading" && <ProgressValue className="text-xs" />}
              </Progress>
              {onCancelUpload && upload.phase === "uploading" && (
                <Button type="button" variant="outline" size="sm" onClick={onCancelUpload}>
                  <X className="size-3.5" />
                  {progress.stopUpload}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <UploadCloud className="size-3.5" />
                {hasVideo ? v.replace : v.choose}
              </Button>
              {file && (
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClear}>
                  <Trash2 className="size-3.5" />
                  {v.remove}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{v.hint}</p>
    </div>
  );
}
