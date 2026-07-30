"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FolderInput,
  Loader2,
  Rocket,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { FileUploadField } from "@/components/movies/FileUploadField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useExternalUpload } from "@/lib/context/external-upload-context";
import { movieService } from "@/services/api/movieService";
import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import { toast } from "sonner";

const GENRE_OPTIONS = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
  "Drama", "Family", "Fantasy", "History", "Horror", "Musical",
  "Mystery", "Romance", "Sci-Fi", "Thriller",
];
const LANGUAGES = ["English", "Burmese", "Korean", "Japanese", "Hindi", "Chinese", "Spanish", "French"];

// The fixed folder-structure contract for the movie folder the other PC
// hands off — must match backend UploadsService.parseBundleStructure().
const KNOWN_RENDITIONS = ["240p", "360p", "480p", "720p", "1080p"];

// One accent color per step so the wizard is easy to scan at a glance —
// literal class strings throughout (not composed from a variable) so
// Tailwind's static scanner can actually find and generate them.
const STEPS = [
  {
    id: 1 as const,
    label: "Movie folder",
    hint: "Upload the prepared bundle",
    icon: FolderInput,
    text: "text-sky-400",
    bg: "bg-sky-400/15",
    border: "border-sky-400/30",
    ring: "ring-sky-400/30",
    dropzone: "border-sky-400/30 bg-sky-400/[0.06] hover:border-sky-400/50 hover:bg-sky-400/10",
  },
  {
    id: 2 as const,
    label: "Movie info",
    hint: "Title, images, and details",
    icon: ClipboardList,
    text: "text-amber-400",
    bg: "bg-amber-400/15",
    border: "border-amber-400/30",
    ring: "ring-amber-400/30",
    dropzone: "border-amber-400/30 bg-amber-400/[0.06] hover:border-amber-400/50 hover:bg-amber-400/10",
  },
  {
    id: 3 as const,
    label: "Validate & publish",
    hint: "Confirm and go live",
    icon: Rocket,
    text: "text-emerald-400",
    bg: "bg-emerald-400/15",
    border: "border-emerald-400/30",
    ring: "ring-emerald-400/30",
    dropzone: "border-emerald-400/30 bg-emerald-400/[0.06] hover:border-emerald-400/50 hover:bg-emerald-400/10",
  },
];
type StepId = (typeof STEPS)[number]["id"];

/** Maps a path relative to the selected movie-folder root onto the storage relativePath the backend expects (see StorageService's hls/ key convention). */
function mapLocalPathToRelativePath(localPath: string): string {
  if (localPath === "original.mp4") return "original.mp4";
  if (localPath === "master.m3u8") return "hls/master.m3u8";
  if (localPath.startsWith("subtitles/")) return localPath;
  return `hls/${localPath}`;
}

/** Groups a storage relativePath back into a human-readable bucket for the upload checklist. */
function groupLabelForRelativePath(relativePath: string): string {
  if (relativePath === "original.mp4") return "original.mp4";
  if (relativePath === "hls/master.m3u8") return "master.m3u8";
  if (relativePath.startsWith("subtitles/")) return "subtitles/";
  const match = /^hls\/([^/]+)\//.exec(relativePath);
  return match ? `${match[1]}/` : relativePath;
}

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

/** A folder selected via webkitdirectory keeps its own root folder name as the first path segment — irrelevant to storage, only the structure beneath it matters. */
function stripDirectoryRoot(relativePath: string): string {
  const parts = relativePath.split("/");
  return parts.slice(1).join("/");
}

export default function UploadExternalVideoPage() {
  const { data: categories } = useAsyncData(movieService.getCategories, []);
  const bundle = useExternalUpload();

  const [movieId, setMovieId] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(true);
  const [activeStep, setActiveStep] = useState<StepId>(1);

  // Step 1: the technical bundle — one root folder, opaque output from the
  // other machine, recursively uploaded exactly as it was handed off.

  // Step 2: curatorial metadata + promotional images — a normal picker, same as the classic upload page.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [language, setLanguage] = useState("English");
  const [releaseYear, setReleaseYear] = useState(String(new Date().getFullYear()));
  const [durationMinutes, setDurationMinutes] = useState("120");
  const [price, setPrice] = useState("6990");
  const [isPremium, setIsPremium] = useState(true);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const posterPreview = useObjectUrl(posterFile);
  const coverPreview = useObjectUrl(coverFile);
  const thumbnailPreview = useObjectUrl(thumbnailFile);

  const [validation, setValidation] = useState<{ missing: string[]; structureErrors: string[]; checked: boolean }>({
    missing: [],
    structureErrors: [],
    checked: false,
  });
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // A draft Movie exists before any file is picked — initUpload() needs a
  // real movieId to attach sessions to, and this satisfies the requested
  // "upload files first" order without inventing upload-without-a-movie.
  useEffect(() => {
    let cancelled = false;
    movieService
      .createMovie({
        title: "Untitled Draft",
        description: "Draft — pending details",
        genre: "Unknown",
        categoryIds: [],
        language: "English",
        releaseYear: new Date().getFullYear(),
        duration: 1,
        price: 0,
        isPremium: false,
      })
      .then((movie) => {
        if (!cancelled) {
          setMovieId(movie.id);
          setTitle(movie.title);
        }
      })
      .catch(() => toast.error("Couldn't start a new upload — please refresh and try again."))
      .finally(() => {
        if (!cancelled) setCreatingDraft(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFolderChange = (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    const assets = files.map((file) => {
      const localPath = stripDirectoryRoot((file as File & { webkitRelativePath: string }).webkitRelativePath);
      return { relativePath: mapLocalPathToRelativePath(localPath), file };
    });
    bundle.setAssetList(assets);
    setValidation({ missing: [], structureErrors: [], checked: false });
  };

  const bundleGroups = useMemo(() => {
    const groups = new Map<string, { total: number; done: number }>();
    for (const asset of bundle.assets) {
      const label = groupLabelForRelativePath(asset.relativePath);
      const entry = groups.get(label) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (asset.status === "done") entry.done += 1;
      groups.set(label, entry);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [bundle.assets]);

  const canUploadBundle = bundle.assets.length > 0;

  const handleUploadBundle = async () => {
    if (!movieId || !canUploadBundle) return;
    try {
      await bundle.uploadAll(movieId);
      toast.success("Bundle uploaded", { description: "All files uploaded — validate before publishing." });
      setActiveStep(2);
    } catch (err) {
      toast.error("Some files failed to upload", {
        description: err instanceof Error ? err.message : "Check the checklist below and try again.",
      });
    }
  };

  const handleUploadImages = async () => {
    if (!posterFile || !coverFile || !thumbnailFile) {
      toast.error("Poster, banner, and thumbnail images are all required.");
      return;
    }
    setUploadingImages(true);
    try {
      const [poster, cover, thumb] = await Promise.all([
        uploadService.uploadImage(posterFile),
        uploadService.uploadImage(coverFile),
        uploadService.uploadImage(thumbnailFile),
      ]);
      setPosterUrl(poster.url);
      setCoverUrl(cover.url);
      setThumbnailUrl(thumb.url);
      toast.success("Images uploaded");
    } catch (err) {
      toast.error("Couldn't upload images", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!movieId) return;
    if (!title.trim() || !description.trim() || !genre) {
      toast.error("Title, description, and genre are required.");
      return;
    }
    try {
      await movieService.updateMovie(movieId, {
        title,
        description,
        genre,
        categoryIds,
        language,
        releaseYear: Number(releaseYear),
        duration: Number(durationMinutes),
        price: Number(price),
        isPremium,
        posterUrl: posterUrl ?? undefined,
        coverUrl: coverUrl ?? undefined,
        thumbnailUrl: thumbnailUrl ?? undefined,
      });
      toast.success("Movie information saved");
      setActiveStep(3);
    } catch (err) {
      toast.error("Couldn't save movie information", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleValidate = async () => {
    if (!movieId) return;
    setValidating(true);
    try {
      const relativePaths = bundle.assets.map((a) => a.relativePath);
      const result = await uploadService.validateExternalBundle(movieId, relativePaths);
      setValidation({ missing: result.missing, structureErrors: result.structureErrors, checked: true });
      if (result.valid) {
        toast.success("Bundle validated — ready to publish.");
      } else if (result.structureErrors.length > 0) {
        toast.error("Folder structure is incomplete", { description: result.structureErrors.join("; ") });
      } else {
        toast.error(`${result.missing.length} file(s) missing`, {
          description: "Every uploaded file must be confirmed by the server before publishing.",
        });
      }
    } catch (err) {
      toast.error("Validation failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setValidating(false);
    }
  };

  const imagesReady = Boolean(posterUrl && coverUrl && thumbnailUrl);
  const readyToPublish =
    validation.checked &&
    validation.missing.length === 0 &&
    validation.structureErrors.length === 0 &&
    imagesReady &&
    title.trim().length > 0;

  const stepDone: Record<StepId, boolean> = {
    1: bundle.assets.length > 0 && bundle.allDone,
    2: imagesReady && title.trim().length > 0 && description.trim().length > 0 && Boolean(genre),
    3: readyToPublish,
  };
  const step = STEPS.find((s) => s.id === activeStep)!;

  const handlePublish = async () => {
    if (!movieId || !readyToPublish) return;
    setPublishing(true);
    try {
      const relativePaths = bundle.assets.map((a) => a.relativePath);
      await uploadService.publishExternalVideo(movieId, relativePaths);
      toast.success("Movie published", { description: `"${title}" is now live on MyanFlix.` });
      window.location.href = "/movies";
    } catch (err) {
      toast.error("Couldn't publish", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setPublishing(false);
    }
  };

  if (creatingDraft) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Upload Pre-Transcoded Movie"
        description="For videos already transcoded on another machine — this system only stores and validates the prepared files, it never runs ffmpeg for this flow."
      />

      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-secondary/10 p-2.5">
        {STEPS.map((s, idx) => {
          const isActive = s.id === activeStep;
          const isDone = stepDone[s.id];
          const Icon = s.icon;
          return (
            <div key={s.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveStep(s.id)}
                className={`flex flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? `${s.border} ${s.bg} ring-1 ${s.ring}`
                    : isDone
                      ? "border-success/30 bg-success/10 hover:bg-success/15"
                      : "border-transparent bg-transparent hover:bg-secondary/30"
                }`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    isDone ? "bg-success/20 text-success" : isActive ? `${s.bg} ${s.text}` : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className="hidden flex-col sm:flex">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Step {s.id}
                  </span>
                  <span className={`text-sm font-semibold ${isActive ? s.text : "text-foreground"}`}>{s.label}</span>
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={`h-px w-3 shrink-0 sm:w-6 ${isDone ? "bg-success/40" : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>

      {activeStep === 1 && (
        <Card className={`glass-card border ${step.border}`}>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${step.bg} ${step.text}`}>
              <FolderInput className="size-4.5" />
            </span>
            <div>
              <CardTitle>Movie folder</CardTitle>
              <p className="text-xs text-muted-foreground">One folder, uploaded recursively — nothing else to pick.</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${step.dropzone}`}
            >
              <UploadCloud className={`size-7 ${step.text}`} />
              <span className="text-sm font-semibold">
                {bundle.assets.length > 0 ? `${bundle.assets.length} files selected` : "Click to select the movie folder"}
              </span>
              <span className="text-xs text-muted-foreground">
                original.mp4 · master.m3u8 · 240p–1080p · subtitles/
              </span>
              <input
                type="file"
                // @ts-expect-error -- webkitdirectory is a real, supported, non-standard attribute for folder selection.
                webkitdirectory=""
                multiple
                className="hidden"
                onChange={(e) => handleFolderChange(e.target.files)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Select the root folder containing <code>original.mp4</code>, <code>master.m3u8</code>, every
              rendition folder (240p/360p/480p/720p/1080p), and an optional <code>subtitles/</code> folder.
            </p>

            {bundleGroups.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-secondary/20 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{bundle.assets.length} files total</span>
                  <span className={step.text}>{bundle.overallProgress}%</span>
                </div>
                <Progress value={bundle.overallProgress} className="h-1.5" />
                <div className="flex flex-col gap-1 text-xs">
                  {bundleGroups.map(([label, { total, done }]) => (
                    <div key={label} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="truncate text-muted-foreground">{label}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="tabular-nums text-muted-foreground">
                          {done}/{total}
                        </span>
                        {done === total ? (
                          <CheckCircle2 className="size-3.5 text-success" />
                        ) : bundle.assets.some((a) => groupLabelForRelativePath(a.relativePath) === label && a.status === "error") ? (
                          <XCircle className="size-3.5 text-destructive" />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <Button onClick={handleUploadBundle} disabled={!canUploadBundle || bundle.isUploading} className="flex-1">
                {bundle.isUploading && <Loader2 className="size-4 animate-spin" />}
                {bundle.allDone ? "Re-upload remaining files" : "Upload bundle"}
              </Button>
              <Button variant="outline" onClick={() => setActiveStep(2)} disabled={!stepDone[1]}>
                Next <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeStep === 2 && (
        <Card className={`glass-card border ${step.border}`}>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${step.bg} ${step.text}`}>
              <ClipboardList className="size-4.5" />
            </span>
            <div>
              <CardTitle>Movie information</CardTitle>
              <p className="text-xs text-muted-foreground">Title, description, categories, and promotional images.</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Genre</Label>
                <Select value={genre} onValueChange={(v) => v && setGenre(v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select genre" /></SelectTrigger>
                  <SelectContent>
                    {GENRE_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Language</Label>
                <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="releaseYear">Release year</Label>
                <Input id="releaseYear" type="number" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="duration">Duration (min)</Label>
                <Input id="duration" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price">Price (Ks)</Label>
                <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2">
                {categories?.map((c) => {
                  const active = categoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setCategoryIds((prev) => (active ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                      }
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        active ? `${step.border} ${step.bg} ${step.text}` : "border-white/10 text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/[0.08] px-3 py-2.5">
              <Label htmlFor="isPremium">Premium (requires purchase)</Label>
              <Switch id="isPremium" checked={isPremium} onCheckedChange={setIsPremium} />
            </div>

            <div className={`flex flex-col gap-3 rounded-xl border ${step.border} ${step.bg} p-3`}>
              <p className={`text-xs font-semibold ${step.text}`}>Promotional images</p>
              <div className="grid grid-cols-3 gap-4">
                <FileUploadField label="Poster" accept="image/*" variant="image" aspect="poster" file={posterFile} previewUrl={posterPreview} onChange={setPosterFile} />
                <FileUploadField label="Banner" accept="image/*" variant="image" aspect="wide" file={coverFile} previewUrl={coverPreview} onChange={setCoverFile} />
                <FileUploadField label="Thumbnail" accept="image/*" variant="image" aspect="wide" file={thumbnailFile} previewUrl={thumbnailPreview} onChange={setThumbnailFile} />
              </div>
              <Button variant="outline" onClick={handleUploadImages} disabled={uploadingImages}>
                {uploadingImages && <Loader2 className="size-4 animate-spin" />}
                Upload images
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setActiveStep(1)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button onClick={handleSaveInfo} className="flex-1">
                Save movie information
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeStep === 3 && (
        <Card className={`glass-card border ${step.border}`}>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${step.bg} ${step.text}`}>
              <Rocket className="size-4.5" />
            </span>
            <div>
              <CardTitle>Validate &amp; publish</CardTitle>
              <p className="text-xs text-muted-foreground">Confirm every file made it, then go live.</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button variant="outline" onClick={handleValidate} disabled={validating || bundle.assets.length === 0}>
              {validating && <Loader2 className="size-4 animate-spin" />}
              Validate uploaded files
            </Button>

            {validation.checked && validation.structureErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Folder structure incomplete: {validation.structureErrors.join("; ")}
              </div>
            )}
            {validation.checked && validation.missing.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Missing: {validation.missing.join(", ")}
              </div>
            )}
            {validation.checked && validation.missing.length === 0 && validation.structureErrors.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="size-4" /> All bundle files confirmed present.
              </div>
            )}
            {!imagesReady && (
              <p className="text-xs text-muted-foreground">Upload all three images in step 2 before publishing.</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setActiveStep(2)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button onClick={handlePublish} disabled={!readyToPublish || publishing} className="flex-1">
                {publishing && <Loader2 className="size-4 animate-spin" />}
                Publish movie
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
