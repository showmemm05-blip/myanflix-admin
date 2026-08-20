"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Loader2,
  PartyPopper,
  UploadCloud,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { FileUploadField } from "@/components/movies/FileUploadField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useUploads, type PublishInput } from "@/lib/context/upload-context";
import { useLanguage } from "@/lib/context/language-context";
import { movieService } from "@/services/api/movieService";
import { uploadService } from "@/services/api/uploadService";
import { GENRE_OPTIONS, LANGUAGES } from "@/lib/constants/movie-options";
import type { UploadStage } from "@/types/movie";
import { toast } from "sonner";

const STAGE_ORDER: UploadStage[] = [
  "uploading-images",
  "creating-movie",
  "uploading-video",
  "processing",
  "published",
];

/** Rough multiplier of the source video's own length — sequential multi-tier HLS transcoding on typical dev hardware. */
const PROCESSING_ESTIMATE_MULTIPLIER = 1;

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

function formatUploadSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024)
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytesPerSecond >= 1024)
    return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
  return `${Math.round(bytesPerSecond)} B/s`;
}

function formatTimeRemaining(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function UploadMovieForm() {
  const { t } = useLanguage();
  const { data: categories } = useAsyncData(movieService.getCategories, []);
  const { tasks, startPublish } = useUploads();

  const STAGE_LABEL: Record<UploadStage, string> = {
    idle: t.movies.upload.stage.idle,
    "uploading-images": t.movies.upload.stage.uploadingImages,
    "creating-movie": t.movies.upload.stage.creatingMovie,
    "uploading-video": t.movies.upload.stage.uploadingVideo,
    processing: t.movies.upload.stage.processing,
    published: t.movies.upload.stage.published,
    error: t.movies.upload.stage.error,
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [language, setLanguage] = useState("English");
  const [releaseYear, setReleaseYear] = useState(
    String(new Date().getFullYear()),
  );
  const [durationMinutes, setDurationMinutes] = useState("120");
  const [accessType, setAccessType] = useState<"FREE" | "SUBSCRIPTION">("SUBSCRIPTION");

  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const posterPreview = useObjectUrl(posterFile);
  const coverPreview = useObjectUrl(coverFile);

  // The whole publish pipeline (images, movie creation, chunked video
  // upload, transcode polling, publishing) runs inside UploadProvider
  // (mounted at the root layout) so it — and its progress — survive
  // navigating away from this page entirely; this page just looks its own
  // task back up by id to render the same detail it always has while
  // you're still on it.
  const [taskId, setTaskId] = useState<string | null>(null);
  const activeTask = tasks.find((t) => t.id === taskId) ?? null;
  const stage: UploadStage = activeTask?.stage ?? "idle";

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setGenre(null);
    setCategoryIds([]);
    setLanguage("English");
    setReleaseYear(String(new Date().getFullYear()));
    setDurationMinutes("120");
    setAccessType("SUBSCRIPTION");
    setPosterFile(null);
    setCoverFile(null);
    setVideoFile(null);
    setTaskId(null);
  };

  const handlePublish = () => {
    if (
      !title.trim() ||
      !description.trim() ||
      !genre ||
      !posterFile ||
      !videoFile
    ) {
      toast.error(t.movies.upload.missingFieldsToast, {
        description: t.movies.upload.missingFieldsDescription,
      });
      return;
    }

    const input: PublishInput = {
      title,
      description,
      genre,
      categoryIds,
      language,
      releaseYear: Number(releaseYear),
      duration: Number(durationMinutes),
      accessType,
      posterFile,
      coverFile,
      videoFile,
    };

    const { id, done } = startPublish(input);
    setTaskId(id);
    done
      .then(() => {
        toast.success(t.movies.publishedToast, {
          description: t.movies.publishedDescription(title),
        });
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : t.movies.upload.publishFailedFallback);
      });
  };

  const handleSaveDraft = async () => {
    if (!title.trim() || !genre) {
      toast.error(t.movies.upload.draftMissingFields);
      return;
    }
    try {
      const posterUrl = posterFile
        ? (await uploadService.uploadImage(posterFile)).url
        : undefined;
      const coverUrl = coverFile
        ? (await uploadService.uploadImage(coverFile)).url
        : undefined;
      await movieService.createMovie({
        title,
        description,
        genre,
        categoryIds,
        language,
        releaseYear: Number(releaseYear),
        duration: Number(durationMinutes),
        accessType,
        posterUrl,
        coverUrl,
      });
      toast.success(t.movies.upload.draftSavedToast, {
        description: t.movies.upload.draftSavedDescription(title),
      });
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.movies.upload.failedToSaveDraft);
    }
  };

  const isBusy = stage !== "idle" && stage !== "published" && stage !== "error";

  const estimatedProcessingSeconds =
    activeTask?.videoDurationSeconds != null
      ? activeTask.videoDurationSeconds * PROCESSING_ESTIMATE_MULTIPLIER
      : null;
  const processingProgress =
    estimatedProcessingSeconds && estimatedProcessingSeconds > 0
      ? Math.min(
          95,
          Math.round(
            ((activeTask?.processingElapsedSeconds ?? 0) / estimatedProcessingSeconds) * 100,
          ),
        )
      : null;

  if (stage === "published") {
    return (
      <div>
        <PageHeader
          title={t.movies.uploadMovie}
          description={t.movies.upload.description}
        />
        <Card className="glass-card mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-success/12 text-success">
              <PartyPopper className="size-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">
                {t.movies.upload.publishedTitle(activeTask?.title ?? "")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.movies.upload.publishedDescription}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm}>
                {t.movies.upload.uploadAnother}
              </Button>
              <Button render={<Link href="/movies" />} nativeButton={false}>
                {t.movies.upload.goToCatalog}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t.movies.uploadMovie}
        description={t.movies.upload.description}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t.movies.upload.detailsCard}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">{t.movies.upload.titleLabel}</Label>
                <Input
                  id="title"
                  placeholder={t.movies.upload.titlePlaceholder}
                  value={title}
                  disabled={isBusy}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">{t.movies.upload.descriptionLabel}</Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder={t.movies.upload.descriptionPlaceholder}
                  value={description}
                  disabled={isBusy}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t.movies.upload.genreLabel}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GENRE_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      disabled={isBusy}
                      onClick={() => setGenre(g)}
                      className="disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Badge
                        variant={genre === g ? "default" : "outline"}
                        className="cursor-pointer font-normal"
                      >
                        {g}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
              {categories && categories.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>{t.movies.upload.categoriesLabel}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={isBusy}
                        onClick={() => toggleCategory(c.id)}
                        className="disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Badge
                          variant={
                            categoryIds.includes(c.id) ? "default" : "outline"
                          }
                          className="cursor-pointer font-normal"
                        >
                          {c.name}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label>{t.movies.upload.languageLabel}</Label>
                  <Select
                    value={language}
                    onValueChange={(v) => v && setLanguage(v)}
                    disabled={isBusy}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="year">{t.movies.upload.releaseYearLabel}</Label>
                  <Input
                    id="year"
                    type="number"
                    value={releaseYear}
                    disabled={isBusy}
                    onChange={(e) => setReleaseYear(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="duration">{t.movies.upload.durationLabel}</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={durationMinutes}
                    disabled={isBusy}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t.movies.upload.accessCard}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-1.5 sm:max-w-52">
                <Label>{t.movies.upload.accessTypeLabel}</Label>
                <Select
                  value={accessType}
                  onValueChange={(v) => v && setAccessType(v as "FREE" | "SUBSCRIPTION")}
                >
                  <SelectTrigger className="w-full" disabled={isBusy}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">{t.movies.accessType.free}</SelectItem>
                    <SelectItem value="SUBSCRIPTION">{t.movies.accessType.subscription}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {accessType === "SUBSCRIPTION" ? t.movies.accessType.subscription : t.movies.accessType.free}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {accessType === "SUBSCRIPTION"
                      ? t.movies.upload.subscriptionRequires
                      : t.movies.upload.freeAvailable}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t.movies.upload.videoCard}</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUploadField
                label={t.movies.upload.videoFileLabel}
                hint={t.movies.upload.videoFileHint}
                accept="video/*"
                file={videoFile}
                progress={
                  stage === "uploading-video" ? (activeTask?.videoProgress ?? 0) : undefined
                }
                onChange={setVideoFile}
                disabled={isBusy}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t.movies.upload.posterAndCoverCard}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FileUploadField
                label={t.movies.upload.moviePosterLabel}
                hint={t.movies.upload.moviePosterHint}
                accept="image/*"
                variant="image"
                aspect="poster"
                file={posterFile}
                previewUrl={posterPreview}
                onChange={setPosterFile}
                disabled={isBusy}
              />
              <FileUploadField
                label={t.movies.upload.coverImageLabel}
                hint={t.movies.upload.coverImageHint}
                accept="image/*"
                variant="image"
                aspect="wide"
                file={coverFile}
                previewUrl={coverPreview}
                onChange={setCoverFile}
                disabled={isBusy}
              />
            </CardContent>
          </Card>

          {stage !== "idle" && stage !== "error" && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{t.movies.upload.uploadStatusCard}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-3">
                  {STAGE_ORDER.map((s) => {
                    const currentIndex = STAGE_ORDER.indexOf(stage);
                    const stepIndex = STAGE_ORDER.indexOf(s);
                    const done = stepIndex < currentIndex;
                    const active = stepIndex === currentIndex;
                    return (
                      <li key={s} className="flex items-center gap-2.5 text-sm">
                        {done ? (
                          <CheckCircle2 className="size-4 shrink-0 text-success" />
                        ) : active ? (
                          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-muted-foreground/60" />
                        )}
                        <span
                          className={
                            active
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {STAGE_LABEL[s]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {stage === "uploading-video" && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t.movies.upload.videoUploadProgress}</span>
                      <span className="tabular-nums">{activeTask?.videoProgress ?? 0}%</span>
                    </div>
                    <Progress value={activeTask?.videoProgress ?? 0} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {activeTask?.speedBps != null
                          ? formatUploadSpeed(activeTask.speedBps)
                          : t.movies.upload.measuringSpeed}
                      </span>
                      <span className="tabular-nums">
                        {activeTask?.etaSeconds != null
                          ? t.movies.upload.timeLeft(formatTimeRemaining(activeTask.etaSeconds))
                          : t.movies.upload.estimatingTime}
                      </span>
                    </div>
                  </div>
                )}
                {stage === "processing" && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t.movies.upload.elapsedLabel}</span>
                      <span className="tabular-nums">
                        {formatTimeRemaining(activeTask?.processingElapsedSeconds ?? 0)}
                      </span>
                    </div>
                    <Progress
                      value={processingProgress ?? 0}
                      className="h-1.5"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t.movies.upload.estimatedTotalLabel}</span>
                      <span className="tabular-nums">
                        {estimatedProcessingSeconds !== null
                          ? t.movies.upload.estimatedApprox(formatTimeRemaining(estimatedProcessingSeconds))
                          : t.movies.upload.calculating}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">
                      {t.movies.upload.estimateNote}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="glass-panel sticky bottom-4 z-10 mt-6 flex flex-col-reverse items-center justify-end gap-2 rounded-xl p-3 sm:flex-row">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={isBusy}
          className="w-full sm:w-auto"
        >
          {t.movies.upload.saveAsDraft}
        </Button>
        <Button
          onClick={handlePublish}
          disabled={isBusy}
          className="w-full sm:w-auto"
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UploadCloud className="size-4" />
          )}
          {isBusy ? t.movies.upload.busyEllipsis(STAGE_LABEL[stage]) : t.movies.upload.publishMovie}
        </Button>
      </div>
    </div>
  );
}

export default function UploadMoviePage() {
  const { t } = useLanguage();
  return (
    <RequirePermission
      permission="MOVIES.CREATE"
      title={t.movies.uploadMovie}
      description={t.movies.upload.description}
    >
      <UploadMovieForm />
    </RequirePermission>
  );
}
