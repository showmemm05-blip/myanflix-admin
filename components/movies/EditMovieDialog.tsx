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
import { Switch } from "@/components/ui/switch";
import { FileUploadField } from "./FileUploadField";
import { movieService } from "@/services/api/movieService";
import { videoService } from "@/services/api/videoService";
import { uploadService } from "@/services/api/uploadService";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
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
  const [title, setTitle] = useState(movie.title);
  const [description, setDescription] = useState(movie.description);
  const [genre, setGenre] = useState(movie.genre);
  const [categoryIds, setCategoryIds] = useState<string[]>(movie.categories.map((c) => c.id));
  const [releaseYear, setReleaseYear] = useState(String(movie.releaseYear));
  const [price, setPrice] = useState(movie.price.toString());
  const [isPremium, setIsPremium] = useState(movie.isPremium);
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
        price: Number(price) || 0,
        isPremium,
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
      toast.success("Movie updated", { description: `"${title}" has been saved.` });
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save changes", { description: "Please try again." });
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
      toast.success("Movie published", { description: `"${movie.title}" is now live on MyanFlix.` });
    } catch {
      toast.error("Couldn't publish this movie", { description: "Please try again." });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit movie</DialogTitle>
        <DialogDescription>Update details for &ldquo;{movie.title}&rdquo;.</DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-title">Title</Label>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {isEpisode && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/[0.08] bg-secondary/20 p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-season">Season</Label>
              <Input
                id="edit-season"
                type="number"
                min="1"
                value={seasonNumber}
                onChange={(e) => setSeasonNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-episode">Episode</Label>
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
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
            <Label htmlFor="edit-release-year">Release year</Label>
            <Input
              id="edit-release-year"
              type="number"
              value={releaseYear}
              onChange={(e) => setReleaseYear(e.target.value)}
            />
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
                    active ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:bg-secondary"
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
            <Label htmlFor="edit-price">Price (Ks)</Label>
            <Input
              id="edit-price"
              type="number"
              min="0"
              step="1"
              value={price}
              disabled={!isPremium}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as Movie["status"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="READY_TO_PUBLISH">Ready to publish</SelectItem>
                <SelectItem value="UPLOADING">Uploading</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Premium content</p>
            <p className="text-xs text-muted-foreground">Requires purchase to watch</p>
          </div>
          <Switch checked={isPremium} onCheckedChange={setIsPremium} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Images</Label>
          <div className="grid grid-cols-3 gap-4">
            <FileUploadField
              label="Poster"
              accept="image/*"
              variant="image"
              aspect="poster"
              file={posterFile}
              previewUrl={posterPreview ?? movie.posterUrl ?? undefined}
              onChange={setPosterFile}
            />
            <FileUploadField
              label="Banner"
              accept="image/*"
              variant="image"
              aspect="wide"
              file={coverFile}
              previewUrl={coverPreview ?? movie.coverUrl ?? undefined}
              onChange={setCoverFile}
            />
            <FileUploadField
              label="Thumbnail"
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
          <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <div>
              <p className="text-sm font-medium">Ready to publish</p>
              <p className="text-xs text-muted-foreground">This movie is uploaded and validated — it stays hidden from users until you publish it.</p>
            </div>
            <Button size="sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              Publish
            </Button>
          </div>
        )}

        {!videoError && videoStatus && <SubtitleManager videoId={videoStatus.id} />}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save changes
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
