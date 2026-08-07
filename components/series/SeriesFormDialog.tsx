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
import { seriesService } from "@/services/api/seriesService";
import { GENRE_OPTIONS, LANGUAGES } from "@/lib/constants/movie-options";
import type { Series } from "@/types/series";
import { toast } from "sonner";

interface SeriesFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  series?: Series | null;
  onSaved: (series: Series) => void;
}

function SeriesForm({ series, onOpenChange, onSaved }: Omit<SeriesFormDialogProps, "open">) {
  const [title, setTitle] = useState(series?.title ?? "");
  const [description, setDescription] = useState(series?.description ?? "");
  const [genre, setGenre] = useState(series?.genre ?? "");
  const [language, setLanguage] = useState(series?.language ?? "English");
  const [releaseYear, setReleaseYear] = useState(String(series?.releaseYear ?? new Date().getFullYear()));
  const [accessType, setAccessType] = useState<Series["accessType"]>(series?.accessType ?? "SUBSCRIPTION");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !description.trim() || !genre) {
      toast.error("Title, description, and genre are required.");
      return;
    }
    setSaving(true);
    try {
      const values = {
        title: title.trim(),
        description: description.trim(),
        genre,
        language,
        releaseYear: Number(releaseYear) || new Date().getFullYear(),
        accessType,
      };
      const saved = series
        ? await seriesService.updateSeries(series.id, values)
        : await seriesService.createSeries(values);
      onSaved(saved);
      toast.success(series ? "Series updated" : "Series created", { description: `"${saved.title}" has been saved.` });
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the series", { description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{series ? "Edit series" : "Create series"}</DialogTitle>
        <DialogDescription>
          {series ? `Update details for “${series.title}”.` : "Show-level details — episodes are added via Bulk Upload Episodes."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="series-title">Title</Label>
          <Input id="series-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="series-description">Description</Label>
          <Textarea id="series-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Genre</Label>
            <Select value={genre} onValueChange={(v) => v && setGenre(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="series-year">Release year</Label>
            <Input id="series-year" type="number" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Access type</Label>
          <Select value={accessType} onValueChange={(v) => v && setAccessType(v as Series["accessType"])}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FREE">Free</SelectItem>
              <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Governs every season and episode, including ones added later.</p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {series ? "Save changes" : "Create series"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function SeriesFormDialog({ open, onOpenChange, series, onSaved }: SeriesFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <SeriesForm key={series?.id ?? "new"} series={series} onOpenChange={onOpenChange} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}
