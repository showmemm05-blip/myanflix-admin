"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { movieService } from "@/services/api/movieService";
import { videoService } from "@/services/api/videoService";
import { useAsyncData } from "@/lib/hooks/use-async-data";
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
  const [price, setPrice] = useState(movie.price.toString());
  const [isPremium, setIsPremium] = useState(movie.isPremium);
  const [status, setStatus] = useState<Movie["status"]>(movie.status);
  const [saving, setSaving] = useState(false);

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
      const updated = await movieService.updateMovie(movie.id, {
        title,
        description,
        price: Number(price) || 0,
        isPremium,
        status,
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

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit movie</DialogTitle>
        <DialogDescription>Update details for &ldquo;{movie.title}&rdquo;.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-title">Title</Label>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
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
                <SelectItem value="PROCESSING">Processing</SelectItem>
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
