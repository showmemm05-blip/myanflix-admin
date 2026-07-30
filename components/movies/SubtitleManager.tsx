"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { subtitleService } from "@/services/api/subtitleService";
import type { Subtitle } from "@/types/subtitle";
import { toast } from "sonner";

/** Managed for an existing Video — subtitles attach to the video, not the movie, so this only renders once a video exists (see EditMovieDialog). */
export function SubtitleManager({ videoId }: { videoId: string }) {
  const { data: subtitles, isLoading, refetch } = useAsyncData(
    () => subtitleService.getForVideo(videoId),
    [videoId],
  );

  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("");
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file || !language.trim() || !label.trim()) {
      toast.error("A subtitle file, language code, and label are all required.");
      return;
    }
    setUploading(true);
    try {
      await subtitleService.upload(videoId, file, language.trim(), label.trim(), isDefault);
      setFile(null);
      setLanguage("");
      setLabel("");
      setIsDefault(false);
      refetch();
      toast.success("Subtitle uploaded");
    } catch (err) {
      toast.error("Couldn't upload subtitle", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const handleSetDefault = async (subtitle: Subtitle) => {
    setBusyId(subtitle.id);
    try {
      await subtitleService.setDefault(subtitle.id);
      refetch();
    } catch {
      toast.error("Couldn't set default subtitle");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (subtitle: Subtitle) => {
    setBusyId(subtitle.id);
    try {
      await subtitleService.remove(subtitle.id);
      refetch();
      toast.success("Subtitle removed");
    } catch {
      toast.error("Couldn't remove subtitle");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/[0.08] p-3">
      <p className="text-sm font-medium">Subtitles</p>

      {isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : subtitles && subtitles.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {subtitles.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary/30 px-2.5 py-1.5 text-sm">
              <span className="truncate">
                {s.label} ({s.language}) · {s.format}
                {s.isDefault && <span className="ml-1.5 text-xs text-primary">default</span>}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {!s.isDefault && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={busyId === s.id}
                    onClick={() => handleSetDefault(s)}
                    title="Set as default"
                  >
                    <Star className="size-3.5" />
                  </Button>
                )}
                {s.isDefault && <CheckCircle2 className="size-3.5 text-primary" />}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={busyId === s.id}
                  onClick={() => handleDelete(s)}
                  title="Delete"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No subtitles uploaded yet.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="file"
          accept=".srt,.vtt,.ass"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="col-span-2"
        />
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Language code</Label>
          <Input placeholder="en" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Label</Label>
          <Input placeholder="English" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Set as default
        </label>
      </div>
      <Button size="sm" variant="outline" onClick={handleUpload} disabled={uploading}>
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        Upload subtitle
      </Button>
    </div>
  );
}
