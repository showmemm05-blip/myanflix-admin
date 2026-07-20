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
import { FileUploadField } from "@/components/movies/FileUploadField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { movieService } from "@/services/api/movieService";
import { uploadService } from "@/services/api/uploadService";
import {
  videoService,
  type VideoProcessingStatus,
} from "@/services/api/videoService";
import type { UploadStage } from "@/types/movie";
import { toast } from "sonner";

const GENRE_OPTIONS = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Musical",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
];

const LANGUAGES = [
  "English",
  "Burmese",
  "Korean",
  "Japanese",
  "Hindi",
  "Chinese",
  "Spanish",
  "French",
];

const STAGE_ORDER: UploadStage[] = [
  "uploading-images",
  "creating-movie",
  "uploading-video",
  "processing",
  "published",
];
const STAGE_LABEL: Record<UploadStage, string> = {
  idle: "Idle",
  "uploading-images": "Uploading images",
  "creating-movie": "Creating movie",
  "uploading-video": "Uploading video",
  processing: "Processing video",
  published: "Published",
  error: "Error",
};

const CHUNK_POLL_INTERVAL_MS = 2500;
const CHUNK_UPLOAD_CONCURRENCY = 6;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export default function UploadMoviePage() {
  const { data: categories } = useAsyncData(movieService.getCategories, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [language, setLanguage] = useState("English");
  const [releaseYear, setReleaseYear] = useState(
    String(new Date().getFullYear()),
  );
  const [durationMinutes, setDurationMinutes] = useState("120");
  const [price, setPrice] = useState("6990");
  const [isPremium, setIsPremium] = useState(true);

  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const posterPreview = useObjectUrl(posterFile);
  const coverPreview = useObjectUrl(coverFile);

  const [stage, setStage] = useState<UploadStage>("idle");
  const [videoProgress, setVideoProgress] = useState(0);
  const [uploadSpeedBps, setUploadSpeedBps] = useState<number | null>(null);
  const [uploadEtaSeconds, setUploadEtaSeconds] = useState<number | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<
    number | null
  >(null);
  const [processingElapsedSeconds, setProcessingElapsedSeconds] = useState(0);
  const [publishedTitle, setPublishedTitle] = useState("");

  useEffect(() => {
    if (stage !== "processing") return;
    const interval = setInterval(
      () => setProcessingElapsedSeconds((s) => s + 1),
      1000,
    );
    return () => clearInterval(interval);
  }, [stage]);

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
    setPrice("6990");
    setIsPremium(true);
    setPosterFile(null);
    setCoverFile(null);
    setVideoFile(null);
    setStage("idle");
    setVideoProgress(0);
    setUploadSpeedBps(null);
    setUploadEtaSeconds(null);
    setVideoDurationSeconds(null);
    setProcessingElapsedSeconds(0);
  };

  const uploadVideoInChunks = async (movieId: string, file: File) => {
    const { uploadId, chunkSize, totalChunks } = await uploadService.init(
      movieId,
      file.name,
      file.size,
    );

    let nextChunk = 0;
    let completedChunks = 0;
    let uploadedBytes = 0;
    const startedAt = Date.now();

    const worker = async () => {
      for (;;) {
        const chunkNumber = nextChunk++;
        if (chunkNumber >= totalChunks) return;
        const start = chunkNumber * chunkSize;
        const chunk = file.slice(start, start + chunkSize);
        await uploadService.uploadChunk(uploadId, chunkNumber, chunk);
        completedChunks++;
        uploadedBytes += chunk.size;
        setVideoProgress(Math.round((completedChunks / totalChunks) * 100));

        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        if (elapsedSeconds > 0.5) {
          const speed = uploadedBytes / elapsedSeconds;
          setUploadSpeedBps(speed);
          setUploadEtaSeconds(
            speed > 0 ? (file.size - uploadedBytes) / speed : null,
          );
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(CHUNK_UPLOAD_CONCURRENCY, totalChunks) },
        worker,
      ),
    );

    setUploadEtaSeconds(0);
    await uploadService.complete(uploadId);
  };

  const pollProcessingStatus = async (
    movieId: string,
  ): Promise<VideoProcessingStatus> => {
    for (;;) {
      const status = await videoService.getProcessingStatus(movieId);
      if (status.duration) setVideoDurationSeconds(status.duration);
      if (status.status === "READY" || status.status === "FAILED")
        return status.status;
      await sleep(CHUNK_POLL_INTERVAL_MS);
    }
  };

  const handlePublish = async () => {
    if (
      !title.trim() ||
      !description.trim() ||
      !genre ||
      !posterFile ||
      !videoFile
    ) {
      toast.error("Missing required fields", {
        description:
          "Title, description, genre, a poster and a video file are required.",
      });
      return;
    }

    try {
      setStage("uploading-images");
      const posterUrl = (await uploadService.uploadImage(posterFile)).url;
      const coverUrl = coverFile
        ? (await uploadService.uploadImage(coverFile)).url
        : undefined;

      setStage("creating-movie");
      const movie = await movieService.createMovie({
        title,
        description,
        genre,
        categoryIds,
        language,
        releaseYear: Number(releaseYear),
        duration: Number(durationMinutes),
        price: Number(price),
        isPremium,
        posterUrl,
        coverUrl,
      });

      setStage("uploading-video");
      setVideoProgress(0);
      setUploadSpeedBps(null);
      setUploadEtaSeconds(null);
      await uploadVideoInChunks(movie.id, videoFile);

      setStage("processing");
      setProcessingElapsedSeconds(0);
      const result = await pollProcessingStatus(movie.id);

      if (result === "FAILED") {
        setStage("error");
        toast.error("Video processing failed", {
          description:
            "The upload succeeded but transcoding failed. Check the movie's status later.",
        });
        return;
      }

      await movieService.updateMovie(movie.id, { status: "PUBLISHED" });
      setPublishedTitle(title);
      setStage("published");
      toast.success("Movie published", {
        description: `"${title}" is now live on MyanFlix.`,
      });
    } catch (err) {
      setStage("error");
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim() || !genre) {
      toast.error("Title and genre are required to save a draft.");
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
        price: Number(price),
        isPremium,
        posterUrl,
        coverUrl,
      });
      toast.success("Draft saved", {
        description: `"${title}" was saved to Movies as a draft.`,
      });
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    }
  };

  const isBusy = stage !== "idle" && stage !== "published" && stage !== "error";

  const estimatedProcessingSeconds =
    videoDurationSeconds !== null
      ? videoDurationSeconds * PROCESSING_ESTIMATE_MULTIPLIER
      : null;
  const processingProgress =
    estimatedProcessingSeconds && estimatedProcessingSeconds > 0
      ? Math.min(
          95,
          Math.round(
            (processingElapsedSeconds / estimatedProcessingSeconds) * 100,
          ),
        )
      : null;

  if (stage === "published") {
    return (
      <div>
        <PageHeader
          title="Upload Movie"
          description="Add a new title to the MyanFlix catalog."
        />
        <Card className="glass-card mx-auto max-w-md border-white/[0.08]">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
              <PartyPopper className="size-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">
                &ldquo;{publishedTitle}&rdquo; is published
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your movie has finished processing and is now live in the
                catalog.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm}>
                Upload another
              </Button>
              <Button render={<Link href="/movies" />} nativeButton={false}>
                Go to catalog
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
        title="Upload Movie"
        description="Add a new title to the MyanFlix catalog."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="glass-card border-white/[0.08]">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Twilight of the Wolves"
                  value={title}
                  disabled={isBusy}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="A short synopsis for viewers..."
                  value={description}
                  disabled={isBusy}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Genre</Label>
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
                  <Label>Categories</Label>
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
                  <Label>Language</Label>
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
                  <Label htmlFor="year">Release Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={releaseYear}
                    disabled={isBusy}
                    onChange={(e) => setReleaseYear(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="duration">Duration (min)</Label>
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

          <Card className="glass-card border-white/[0.08]">
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-1.5 sm:max-w-40">
                <Label htmlFor="price">Price (Ks)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="1"
                  value={price}
                  disabled={isBusy || !isPremium}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {isPremium ? "Premium" : "Free"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isPremium
                      ? "Requires purchase to watch"
                      : "Available to all users"}
                  </p>
                </div>
                <Switch
                  checked={isPremium}
                  onCheckedChange={setIsPremium}
                  disabled={isBusy}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/[0.08]">
            <CardHeader>
              <CardTitle>Video</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUploadField
                label="Video file"
                hint="MP4, MKV — will be transcoded to HLS at up to 1080p"
                accept="video/*"
                file={videoFile}
                progress={
                  stage === "uploading-video" ? videoProgress : undefined
                }
                onChange={setVideoFile}
                disabled={isBusy}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="glass-card border-white/[0.08]">
            <CardHeader>
              <CardTitle>Poster &amp; Cover</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FileUploadField
                label="Movie poster"
                hint="Portrait, 2:3 ratio"
                accept="image/*"
                variant="image"
                aspect="poster"
                file={posterFile}
                previewUrl={posterPreview}
                onChange={setPosterFile}
                disabled={isBusy}
              />
              <FileUploadField
                label="Cover image"
                hint="Widescreen, 16:9 ratio, optional"
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
            <Card className="glass-card border-white/[0.08]">
              <CardHeader>
                <CardTitle>Upload Status</CardTitle>
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
                          <Circle className="size-4 shrink-0 text-muted-foreground/40" />
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
                  <div className="space-y-2 border-t border-white/[0.08] pt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Video upload progress</span>
                      <span>{videoProgress}%</span>
                    </div>
                    <Progress value={videoProgress} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {uploadSpeedBps !== null
                          ? formatUploadSpeed(uploadSpeedBps)
                          : "Measuring speed…"}
                      </span>
                      <span>
                        {uploadEtaSeconds !== null
                          ? `${formatTimeRemaining(uploadEtaSeconds)} left`
                          : "Estimating time…"}
                      </span>
                    </div>
                  </div>
                )}
                {stage === "processing" && (
                  <div className="space-y-2 border-t border-white/[0.08] pt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Elapsed</span>
                      <span>
                        {formatTimeRemaining(processingElapsedSeconds)}
                      </span>
                    </div>
                    <Progress
                      value={processingProgress ?? 0}
                      className="h-1.5"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Estimated total</span>
                      <span>
                        {estimatedProcessingSeconds !== null
                          ? `~${formatTimeRemaining(estimatedProcessingSeconds)}`
                          : "Calculating…"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">
                      Rough estimate based on the video&rsquo;s length — actual
                      time can vary with machine load.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="glass-panel sticky bottom-4 z-10 mt-6 flex flex-col-reverse items-center justify-end gap-2 rounded-xl border-white/[0.08] p-3 sm:flex-row">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={isBusy}
          className="w-full sm:w-auto"
        >
          Save as Draft
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
          {isBusy ? STAGE_LABEL[stage] + "..." : "Publish Movie"}
        </Button>
      </div>
    </div>
  );
}
