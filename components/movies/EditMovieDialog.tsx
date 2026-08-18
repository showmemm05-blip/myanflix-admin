"use client";

import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "./FileUploadField";
import { movieService } from "@/services/api/movieService";
import { videoService } from "@/services/api/videoService";
import { uploadService } from "@/services/api/uploadService";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { useLanguage } from "@/lib/context/language-context";
import { GENRE_OPTIONS } from "@/lib/constants/movie-options";
import { SubtitleManager } from "./SubtitleManager";
import type { Movie } from "@/types/movie";
import { toast } from "sonner";

function EditMovieForm({
  movie,
  onOpenChange,
  onSaved,
}: {
  movie: Movie;
  onOpenChange: (open: boolean) => void;
  onSaved: (movie: Movie) => void;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(movie.title);
  const [description, setDescription] = useState(movie.description);
  const [genre, setGenre] = useState(movie.genre);
  const [categoryIds, setCategoryIds] = useState<string[]>(movie.categories.map((c) => c.id));
  const [releaseYear, setReleaseYear] = useState(String(movie.releaseYear));
  const [accessType, setAccessType] = useState<Movie["accessType"]>(movie.accessType);
  const [status, setStatus] = useState<Movie["status"]>(movie.status);
  const isEpisode = movie.seriesId !== null;
  const [seasonNumber, setSeasonNumber] = useState(String(movie.seasonNumber ?? 1));
  const [episodeNumber, setEpisodeNumber] = useState(String(movie.episodeNumber ?? 1));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const posterPreview = useObjectUrl(posterFile);
  const coverPreview = useObjectUrl(coverFile);
  const thumbnailPreview = useObjectUrl(thumbnailFile);

  const { data: categories } = useAsyncData(movieService.getCategories, []);

  // A video only exists once something has actually been uploaded for this
  // movie — getProcessingStatus() 404s otherwise, which useAsyncData already
  // turns into a normal `error` we can just check for instead of throwing.
  const { data: videoStatus, error: videoError } = useAsyncData(
    () => videoService.getProcessingStatus(movie.id),
    [movie.id],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const [posterUrl, coverUrl, thumbnailUrl] = await Promise.all([
        posterFile ? uploadService.uploadImage(posterFile).then((r) => r.url) : movie.posterUrl ?? undefined,
        coverFile ? uploadService.uploadImage(coverFile).then((r) => r.url) : movie.coverUrl ?? undefined,
        thumbnailFile ? uploadService.uploadImage(thumbnailFile).then((r) => r.url) : movie.thumbnailUrl ?? undefined,
      ]);

      const updated = await movieService.updateMovie(movie.id, {
        title,
        description,
        genre,
        categoryIds,
        releaseYear: Number(releaseYear) || movie.releaseYear,
        accessType,
        status,
        posterUrl,
        coverUrl,
        thumbnailUrl,
        ...(isEpisode
          ? {
              seasonNumber: Math.max(1, Number(seasonNumber) || 1),
              episodeNumber: Math.max(1, Number(episodeNumber) || 1),
            }
          : {}),
      });
      onSaved(updated);
      toast.success(t.movies.editDialog.updatedToast, { description: t.movies.editDialog.updatedDescription(title) });
      onOpenChange(false);
    } catch {
      toast.error(t.movies.editDialog.saveFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const updated = await movieService.updateMovie(movie.id, { status: "PUBLISHED" });
      setStatus("PUBLISHED");
      onSaved(updated);
      toast.success(t.movies.publishedToast, { description: t.movies.publishedDescription(movie.title) });
    } catch {
      toast.error(t.movies.publishFailedToast, { description: t.movies.pleaseTryAgain });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.movies.editDialog.title}</DialogTitle>
        <DialogDescription>{t.movies.editDialog.descriptionFor(movie.title)}</DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-title">{t.movies.editDialog.titleLabel}</Label>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {isEpisode && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-season">{t.movies.editDialog.seasonLabel}</Label>
              <Input
                id="edit-season"
                type="number"
                min="1"
                value={seasonNumber}
                onChange={(e) => setSeasonNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-episode">{t.movies.editDialog.episodeLabel}</Label>
              <Input
                id="edit-episode"
                type="number"
                min="1"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
              />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-description">{t.movies.editDialog.descriptionLabel}</Label>
          <Textarea
            id="edit-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t.movies.editDialog.genreLabel}</Label>
            <Select value={genre} onValueChange={(v) => v && setGenre(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t.movies.editDialog.genrePlaceholder} /></SelectTrigger>
              <SelectContent>
                {GENRE_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-release-year">{t.movies.editDialog.releaseYearLabel}</Label>
            <Input
              id="edit-release-year"
              type="number"
              value={releaseYear}
              onChange={(e) => setReleaseYear(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t.movies.editDialog.categoriesLabel}</Label>
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
                    active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t.movies.editDialog.accessTypeLabel}</Label>
            <Select value={accessType} onValueChange={(v) => v && setAccessType(v as Movie["accessType"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">{t.movies.accessType.free}</SelectItem>
                <SelectItem value="SUBSCRIPTION">{t.movies.accessType.subscription}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t.movies.editDialog.statusLabel}</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as Movie["status"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLISHED">{t.movies.status.published}</SelectItem>
                <SelectItem value="READY_TO_PUBLISH">{t.movies.status.readyToPublish}</SelectItem>
                <SelectItem value="UPLOADING">{t.movies.status.uploading}</SelectItem>
                <SelectItem value="PROCESSING">{t.movies.status.processing}</SelectItem>
                <SelectItem value="FAILED">{t.movies.status.failed}</SelectItem>
                <SelectItem value="DRAFT">{t.movies.status.draft}</SelectItem>
                <SelectItem value="ARCHIVED">{t.movies.status.archived}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t.movies.editDialog.imagesLabel}</Label>
          <div className="grid grid-cols-3 gap-4">
            <FileUploadField
              label={t.movies.editDialog.posterLabel}
              accept="image/*"
              variant="image"
              aspect="poster"
              file={posterFile}
              previewUrl={posterPreview ?? movie.posterUrl ?? undefined}
              onChange={setPosterFile}
            />
            <FileUploadField
              label={t.movies.editDialog.bannerLabel}
              accept="image/*"
              variant="image"
              aspect="wide"
              file={coverFile}
              previewUrl={coverPreview ?? movie.coverUrl ?? undefined}
              onChange={setCoverFile}
            />
            <FileUploadField
              label={t.movies.editDialog.thumbnailLabel}
              accept="image/*"
              variant="image"
              aspect="wide"
              file={thumbnailFile}
              previewUrl={thumbnailPreview ?? movie.thumbnailUrl ?? undefined}
              onChange={setThumbnailFile}
            />
          </div>
        </div>

        {movie.status === "READY_TO_PUBLISH" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/25 bg-warning/10 p-3">
            <div>
              <p className="text-sm font-medium">{t.movies.editDialog.readyToPublishTitle}</p>
              <p className="text-xs text-muted-foreground">{t.movies.editDialog.readyToPublishDescription}</p>
            </div>
            <Button size="sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              {t.movies.publish}
            </Button>
          </div>
        )}

        {!videoError && videoStatus && <SubtitleManager videoId={videoStatus.id} />}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.movies.editDialog.saveChanges}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditMovieDialog({
  movie,
  open,
  onOpenChange,
  onSaved,
}: {
  movie: Movie | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (movie: Movie) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {movie && (
          <EditMovieForm key={movie.id} movie={movie} onOpenChange={onOpenChange} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}
