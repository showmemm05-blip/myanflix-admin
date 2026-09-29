"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Film,
  Loader2,
  RefreshCw,
  Stethoscope,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uploadBundleDirect, type AssetPatch, type BundleUploadAsset } from "@/lib/upload/bundle-upload";
import { formatBytes, formatEta, formatSpeed } from "@/lib/upload/format";
import {
  foldersFromFileList,
  mapLocalPathToRelativePath,
  readDroppedFolders,
  type DroppedFolder,
} from "@/lib/upload/read-dropped-folders";
import { ApiError } from "@/services/api/apiClient";
import { RESOURCE_TYPE_MOVIE_REPLACE, uploadService } from "@/services/api/uploadService";
import { videoService, type VideoDiagnosis, type VideoStatusInfo } from "@/services/api/videoService";
import type { Movie, MovieStatus } from "@/types/movie";
import type { TranslationShape } from "@/lib/i18n/translations";
import { toast } from "sonner";

/** Mirrors the backend's REPLACEABLE_MOVIE_STATUSES: UPLOADING/PROCESSING are mid-flight in another flow, DRAFT/ARCHIVED are out by the owner's decision. */
const REPLACEABLE_STATUSES: readonly MovieStatus[] = ["PUBLISHED", "READY_TO_PUBLISH", "FAILED"];
/** The rendition folders parseBundleStructure() recognises on the backend — the client pre-check only needs to find one. */
const KNOWN_RENDITIONS = ["240p", "360p", "480p", "720p", "1080p"];

type ReplacePhase = "idle" | "beginning" | "uploading" | "finalizing" | "done" | "failed";

interface SelectedBundle {
  folderName: string;
  files: DroppedFolder["files"];
  relativePaths: string[];
  totalBytes: number;
}

const STATUS_TONE: Record<VideoStatusInfo["status"], StatusTone> = {
  READY: "success",
  PROCESSING: "info",
  UPLOADING: "info",
  FAILED: "danger",
};

/**
 * Turns a diagnosis check's stable machine name into the operator-facing
 * label. Two names carry a suffix (`rendition:720p`, `subtitle_source:English`)
 * and go through the function labels; an unknown name (a newer backend)
 * renders raw rather than blank.
 */
function checkLabel(t: TranslationShape, name: string): string {
  const labels = t.movies.video.checks;
  if (name.startsWith("rendition:")) return labels.rendition(name.slice("rendition:".length));
  if (name.startsWith("subtitle_source:")) return labels.subtitle_source(name.slice("subtitle_source:".length));
  const fixed = labels[name as keyof typeof labels];
  return typeof fixed === "string" ? fixed : name;
}

/**
 * Mirrors the backend's parseBundleStructure() so a wrong folder is
 * refused before any byte is uploaded: exactly one `original.<ext>` at the
 * root, the master playlist, and at least one known rendition playlist.
 * Returns the i18n reason key of the first thing missing, or null when the
 * bundle looks usable (the backend still does the real validation).
 */
function findBundleProblem(relativePaths: string[]): "original" | "master" | "rendition" | null {
  const originals = relativePaths.filter((p) => /^original\.[^/]+$/.test(p));
  if (originals.length !== 1) return "original";
  if (!relativePaths.includes("hls/master.m3u8")) return "master";
  const hasRendition = KNOWN_RENDITIONS.some((r) => relativePaths.includes(`hls/${r}/index.m3u8`));
  if (!hasRendition) return "rendition";
  return null;
}

function toBundle(folder: DroppedFolder): SelectedBundle {
  // Same mapping as the bulk queue (addFolders) so the two flows agree on
  // what a bundle's storage-relative paths are — including the pre-existing
  // quirk that only `original.mp4` is recognised as the original.
  const relativePaths = folder.files.map((f) => mapLocalPathToRelativePath(f.relativePath));
  return {
    folderName: folder.folderName,
    files: folder.files,
    relativePaths,
    totalBytes: folder.files.reduce((sum, f) => sum + f.file.size, 0),
  };
}

function freshAssets(bundle: SelectedBundle): BundleUploadAsset[] {
  return bundle.files.map((f, i) => ({
    relativePath: bundle.relativePaths[i],
    file: f.file,
    size: f.file.size,
    status: "pending",
    uploadedBytes: 0,
  }));
}

interface VideoSectionProps {
  movie: Movie;
  /** From GET /videos/status/:movieId — null while loading or when the 404 says no video exists yet. */
  videoStatus: VideoStatusInfo | null;
  videoError: Error | null;
  /** Refetches the video status (the dialog owns that request) — called after a re-process or a replace lands. */
  onVideoChanged: () => void;
  /** True while a replace is in flight so the dialog can lock its Save/Cancel footer. */
  onReplacingChange: (replacing: boolean) => void;
}

/**
 * The "Video" block of the Edit Movie dialog, for the case an owner hears
 * "this title no longer plays": an on-demand playback diagnosis, a
 * re-process button when the archived original can rescue it, and a
 * drop zone to replace the whole transcoder bundle for THIS movie id.
 *
 * The check is read-only and available to every dialog user (MOVIES.EDIT);
 * the two mutating controls need MEDIA.UPLOAD like every other media write.
 * Nothing here runs on mount: the diagnosis costs storage round-trips and
 * is only worth paying when somebody asks.
 */
export function VideoSection({ movie, videoStatus, videoError, onVideoChanged, onReplacingChange }: VideoSectionProps) {
  const { t } = useLanguage();
  const { can } = useRole();
  const canUploadMedia = can("MEDIA.UPLOAD");
  const strings = t.movies.video;

  // --- Check playback ---
  const [diagnosis, setDiagnosis] = useState<VideoDiagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  // --- Re-process ---
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  // --- Replace ---
  const [isDragging, setIsDragging] = useState(false);
  const [bundle, setBundle] = useState<SelectedBundle | null>(null);
  const [bundleProblem, setBundleProblem] = useState<"original" | "master" | "rendition" | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [phase, setPhase] = useState<ReplacePhase>("idle");
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [assets, setAssets] = useState<BundleUploadAsset[]>([]);
  const [speedBps, setSpeedBps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const speedSampleRef = useRef<{ time: number; bytes: number } | null>(null);
  const bytesRef = useRef<{ total: number; uploadedByPath: Map<string, number>; speedBps: number }>({
    total: 0,
    uploadedByPath: new Map(),
    speedBps: 0,
  });
  // Multipart sessions opened by this attempt — aborted on Cancel/unmount
  // exactly like the bulk queue does, since a live MinIO UploadId is real
  // server-side state that replace-cancel's prefix delete cannot reach.
  const sessionIdsRef = useRef<Set<string>>(new Set());

  const replaceable = REPLACEABLE_STATUSES.includes(movie.status);
  const replacing = phase === "beginning" || phase === "uploading" || phase === "finalizing";

  const transition = useCallback(
    (next: ReplacePhase) => {
      setPhase(next);
      onReplacingChange(next === "beginning" || next === "uploading" || next === "finalizing");
    },
    [onReplacingChange],
  );

  /** Best-effort server-side cleanup for an attempt that will not finish: abort the multipart sessions, then drop the staging prefix. */
  const abandonServerSide = useCallback((movieId: string) => {
    for (const sessionId of sessionIdsRef.current) uploadService.multipartAbort(sessionId).catch(() => {});
    sessionIdsRef.current.clear();
    uploadService.replaceCancel(movieId).catch(() => {});
  }, []);

  // Closing the dialog mid-upload must not leave a half-staged bundle (and
  // an open multipart session) behind: abort the browser side and tell the
  // backend to clear the staging prefix now rather than at the nightly sweep.
  useEffect(() => {
    const movieId = movie.id;
    return () => {
      const controller = controllerRef.current;
      if (controller && !controller.signal.aborted) {
        controller.abort();
        abandonServerSide(movieId);
      }
    };
  }, [movie.id, abandonServerSide]);

  const runCheck = async () => {
    setDiagnosing(true);
    try {
      setDiagnosis(await videoService.diagnose(movie.id));
    } catch (err) {
      toast.error(strings.checkFailedToast, { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDiagnosing(false);
    }
  };

  const originalPresent = diagnosis?.checks.find((c) => c.name === "original_object")?.ok === true;
  const showReprocess = canUploadMedia && originalPresent && diagnosis?.suggestedAction === "reprocess";

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      await uploadService.reprocess(movie.id);
      setReprocessOpen(false);
      toast.success(t.movies.page.reprocessStartedToast, {
        description: t.movies.page.reprocessStartedDescription(movie.title),
      });
      // The last diagnosis described the video before this action; a stale
      // "master missing" list next to a fresh PROCESSING badge would mislead.
      setDiagnosis(null);
      onVideoChanged();
    } catch (err) {
      toast.error(t.movies.page.reprocessFailedToast, {
        description: err instanceof ApiError ? err.message : t.movies.page.reprocessFailedFallback,
      });
    } finally {
      setReprocessing(false);
    }
  };

  const selectFolders = (folders: DroppedFolder[]) => {
    const withFiles = folders.filter((f) => f.files.length > 0);
    if (withFiles.length !== 1) {
      toast.error(strings.replace.oneFolderOnly);
      return;
    }
    const next = toBundle(withFiles[0]);
    setBundle(next);
    setBundleProblem(findBundleProblem(next.relativePaths));
    setAssets([]);
    setReplaceError(null);
    if (phase === "done" || phase === "failed") transition("idle");
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (replacing) return;
    try {
      const folders = await readDroppedFolders(e.dataTransfer);
      if (folders.length === 0) {
        toast.error(t.movies.externalUpload.noFoldersToast);
        return;
      }
      selectFolders(folders);
    } catch {
      toast.error(t.movies.externalUpload.readFoldersFailedToast, {
        description: t.movies.externalUpload.readFoldersFailedDescription(strings.replace.addFolder),
      });
    }
  };

  const removeBundle = () => {
    setBundle(null);
    setBundleProblem(null);
    setAssets([]);
    setReplaceError(null);
    if (phase === "done" || phase === "failed") transition("idle");
  };

  /** Same aggregate the bulk queue's bumpAsset() keeps per job: the patched asset list plus a smoothed speed / ETA derived from it. */
  const onPatch = useCallback((relativePath: string, patch: AssetPatch) => {
    if (patch.sessionId) sessionIdsRef.current.add(patch.sessionId);
    setAssets((prev) => prev.map((a) => (a.relativePath === relativePath ? { ...a, ...patch } : a)));
    if (patch.uploadedBytes === undefined) return;
    // The byte tally lives in a ref (not derived from the state updater
    // above, which must stay pure) so the speed sample can be taken here,
    // once per patch, from the latest known total.
    const tally = bytesRef.current;
    tally.uploadedByPath.set(relativePath, patch.uploadedBytes);
    let uploaded = 0;
    for (const bytes of tally.uploadedByPath.values()) uploaded += bytes;
    const now = Date.now();
    const sample = speedSampleRef.current;
    if (!sample) {
      speedSampleRef.current = { time: now, bytes: uploaded };
      return;
    }
    const dt = (now - sample.time) / 1000;
    if (dt < 0.2) return;
    const instant = Math.max(0, (uploaded - sample.bytes) / dt);
    speedSampleRef.current = { time: now, bytes: uploaded };
    tally.speedBps = tally.speedBps === 0 ? instant : tally.speedBps * 0.7 + instant * 0.3;
    setSpeedBps(tally.speedBps);
    setEtaSeconds(tally.speedBps > 1 ? Math.max(0, Math.round((tally.total - uploaded) / tally.speedBps)) : null);
  }, []);

  const runReplace = async () => {
    if (!bundle || bundleProblem) return;
    setReplaceOpen(false);
    const controller = new AbortController();
    controllerRef.current = controller;
    sessionIdsRef.current.clear();
    speedSampleRef.current = null;
    setSpeedBps(0);
    setEtaSeconds(null);
    setReplaceError(null);
    // A retry always starts over from a clean staging prefix (replace-begin
    // clears it) — one bundle, no resume, the simplest behaviour that is
    // guaranteed correct. Files are still attached because a failure never
    // unmounts this section.
    const attempt = freshAssets(bundle);
    bytesRef.current = { total: bundle.totalBytes, uploadedByPath: new Map(), speedBps: 0 };
    setAssets(attempt);
    transition("beginning");
    try {
      await uploadService.replaceBegin(movie.id);
      transition("uploading");
      await uploadBundleDirect({
        resourceType: RESOURCE_TYPE_MOVIE_REPLACE,
        resourceId: movie.id,
        assets: attempt,
        signal: controller.signal,
        onPatch,
      });
      transition("finalizing");
      const result = await uploadService.finalizeReplace(movie.id, bundle.relativePaths);
      transition("done");
      toast.success(strings.replace.doneToast, {
        description: `${strings.replace.doneDescription(result.renditions.length, result.subtitles)} ${strings.replace.cacheNotice}`,
      });
      setBundle(null);
      setAssets([]);
      setDiagnosis(null);
      onVideoChanged();
    } catch (err) {
      if (controller.signal.aborted) {
        // Cancel already reported itself and cleaned up server-side.
        transition("idle");
        return;
      }
      const message = err instanceof Error ? err.message : t.uploads.uploadFailedFallback;
      setReplaceError(message);
      transition("failed");
      toast.error(strings.replace.failedToast, { description: message });
    } finally {
      controllerRef.current = null;
    }
  };

  const cancelReplace = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.abort();
    abandonServerSide(movie.id);
    toast.info(strings.replace.cancelledToast);
  };

  // --- Derived progress for the card (same arithmetic as UploadJobCard) ---
  const total = assets.reduce((sum, a) => sum + a.size, 0);
  const uploaded = assets.reduce((sum, a) => sum + a.uploadedBytes, 0);
  const percent = phase === "finalizing" || phase === "done" ? 100 : total > 0 ? Math.round((uploaded / total) * 100) : 0;
  const doneCount = assets.filter((a) => a.status === "done").length;
  const activeAssets = assets.filter((a) => a.status !== "done" && a.status !== "error");
  const uploadFinalizing = phase === "uploading" && activeAssets.length > 0 && activeAssets.every((a) => a.status === "finalizing");
  const progressLabel =
    phase === "beginning"
      ? strings.replace.beginning
      : phase === "finalizing"
        ? strings.replace.finalizing
        : uploadFinalizing
          ? t.uploads.finalizingUpload
          : formatSpeed(speedBps);

  const hasVideo = !videoError && !!videoStatus;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
      {/* Header: what the title currently has. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Film className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm font-medium">{strings.title}</p>
          {hasVideo ? (
            <StatusBadge label={strings.status[videoStatus.status]} tone={STATUS_TONE[videoStatus.status]} />
          ) : (
            <span className="text-xs text-muted-foreground">{strings.noVideo}</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={runCheck} disabled={diagnosing || replacing}>
          {diagnosing ? <Loader2 className="size-3.5 animate-spin" /> : <Stethoscope className="size-3.5" />}
          {diagnosing ? strings.checking : strings.runCheck}
        </Button>
      </div>
      {hasVideo && (videoStatus.failureReason || videoStatus.duration || videoStatus.resolution) && (
        <div className="-mt-1 flex flex-col gap-0.5">
          {(videoStatus.duration || videoStatus.resolution) && (
            <p className="text-xs text-muted-foreground">
              {[
                videoStatus.duration ? strings.runtime(formatDuration(videoStatus.duration / 60) ?? "—") : null,
                videoStatus.resolution,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {videoStatus.failureReason && (
            <p className="break-all font-mono text-xs text-destructive">{videoStatus.failureReason}</p>
          )}
        </div>
      )}

      {/* Diagnosis: one line per check, then the verdict and the suggested action. */}
      {diagnosis && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-background/60 p-3">
          <ul className="flex flex-col gap-1.5">
            {/* name+index: a check name repeats when two subtitle tracks share a label. */}
            {diagnosis.checks.map((check, index) => (
              <li key={`${check.name}-${index}`} className="flex items-start gap-2">
                {check.ok ? (
                  <CheckCircle2 className="size-3.5 shrink-0 translate-y-0.5 text-success" />
                ) : (
                  <AlertCircle className="size-3.5 shrink-0 translate-y-0.5 text-destructive" />
                )}
                <div className="min-w-0">
                  <p className={cn("text-xs font-medium", !check.ok && "text-destructive")}>{checkLabel(t, check.name)}</p>
                  {check.detail && (
                    <p className="break-all font-mono text-xs text-muted-foreground">{check.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div
            className={cn(
              "flex flex-col gap-2 rounded-md border px-3 py-2 text-xs",
              diagnosis.ok
                ? "border-success/25 bg-success/10 text-success"
                : "border-destructive/25 bg-destructive/10 text-destructive",
            )}
          >
            <p className="font-medium">{diagnosis.ok ? strings.allGood : strings.problemsFound}</p>
            {!diagnosis.ok && <p>{strings.suggested[diagnosis.suggestedAction]}</p>}
            {showReprocess && (
              <div>
                <Button size="sm" variant="outline" onClick={() => setReprocessOpen(true)} disabled={reprocessing || replacing}>
                  <RefreshCw className="size-3.5" />
                  {strings.reprocess.button}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Replace: only a media uploader sees it, and only for a title whose status allows a swap. */}
      {canUploadMedia &&
        (!replaceable ? (
          <p className="text-xs text-muted-foreground">{strings.replace.notReplaceable}</p>
        ) : !bundle ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!replacing) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/10" : "border-input hover:border-primary/50 hover:bg-primary/[0.04]"
            }`}
          >
            <UploadCloud className="size-6 text-muted-foreground" />
            <span className="text-sm font-semibold">{strings.replace.dropHere}</span>
            <span className="text-xs text-muted-foreground">{strings.replace.hint}</span>
            <label className="mt-1 cursor-pointer">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary/60">
                <UploadCloud className="size-3.5" />
                {strings.replace.addFolder}
              </span>
              <input
                type="file"
                // @ts-expect-error -- webkitdirectory is a real, supported, non-standard attribute for folder selection.
                webkitdirectory=""
                multiple
                className="hidden"
                disabled={replacing}
                onChange={(e) => {
                  const folders = e.target.files ? foldersFromFileList(e.target.files) : [];
                  if (folders.length > 0) selectFolders(folders);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-lg border p-3 transition-colors",
              replacing ? "border-info/25 bg-info/10" : "border-border bg-background/60",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{bundle.folderName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.uploads.filesCount(bundle.files.length)} · {formatBytes(bundle.totalBytes)}
                </p>
              </div>
              {!replacing && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={removeBundle}
                  aria-label={strings.replace.removeFolder}
                  title={strings.replace.removeFolder}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>

            {bundleProblem && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0 translate-y-0.5" />
                <span>{strings.replace.invalidBundle(strings.replace.invalid[bundleProblem])}</span>
              </div>
            )}

            {replacing && (
              <div className="flex flex-col gap-1.5">
                <Progress value={percent} className="h-1.5" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{progressLabel}</span>
                  <span className="tabular-nums">
                    {phase === "uploading" && !uploadFinalizing ? formatEta(etaSeconds) : `${percent}%`}
                  </span>
                </div>
              </div>
            )}

            {(replacing || phase === "failed") && assets.length > 0 && (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setShowFiles((v) => !v)}
                  className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
                  aria-expanded={showFiles}
                >
                  {showFiles ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  {strings.replace.filesSummary(doneCount, assets.length)}
                </button>
                {showFiles && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-secondary/20 p-2">
                    {assets.map((a) => (
                      <li key={a.relativePath} className="flex items-center gap-2 py-0.5 text-xs">
                        {a.status === "done" ? (
                          <CheckCircle2 className="size-3 shrink-0 text-success" />
                        ) : a.status === "error" ? (
                          <AlertCircle className="size-3 shrink-0 text-destructive" />
                        ) : a.status === "pending" ? (
                          <Circle className="size-3 shrink-0 text-muted-foreground/50" />
                        ) : (
                          <Loader2 className="size-3 shrink-0 animate-spin text-info" />
                        )}
                        <span className="truncate font-mono text-muted-foreground">{a.relativePath}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {phase === "failed" && replaceError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0 translate-y-0.5" />
                <span className="break-all">{replaceError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {replacing ? (
                <Button size="sm" variant="outline" onClick={cancelReplace} disabled={phase === "finalizing"}>
                  <X className="size-3.5" />
                  {strings.replace.cancel}
                </Button>
              ) : phase === "failed" ? (
                <Button size="sm" variant="outline" onClick={() => setReplaceOpen(true)} disabled={!!bundleProblem}>
                  <RefreshCw className="size-3.5" />
                  {strings.replace.retry}
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => setReplaceOpen(true)} disabled={!!bundleProblem}>
                  <UploadCloud className="size-3.5" />
                  {strings.replace.button}
                </Button>
              )}
            </div>
          </div>
        ))}

      <ConfirmDialog
        open={reprocessOpen}
        onOpenChange={setReprocessOpen}
        title={strings.reprocess.confirmTitle}
        description={strings.reprocess.confirmDescription}
        confirmLabel={strings.reprocess.button}
        loading={reprocessing}
        onConfirm={handleReprocess}
      />
      <ConfirmDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        title={strings.replace.confirmTitle(movie.title)}
        description={strings.replace.confirmDescription}
        confirmLabel={strings.replace.button}
        variant="destructive"
        onConfirm={runReplace}
      />
    </section>
  );
}
