"use client";

import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Captions, Loader2, Plus, RefreshCw, Star, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileUploadField } from "@/components/movies/FileUploadField";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { subtitleService } from "@/services/api/subtitleService";
import type { Subtitle } from "@/types/subtitle";
import { toast } from "sonner";

/** Label suggestions for the codes editors type most; anything else is typed by hand. */
const LABEL_FOR_CODE: Record<string, string> = {
  en: "English",
  my: "Myanmar",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  th: "Thai",
  hi: "Hindi",
  fr: "French",
  es: "Spanish",
  de: "German",
};

/**
 * Managed for an existing Video — subtitles attach to the video, not the
 * movie, so this only renders once a video exists (see EditMovieDialog).
 *
 * The list is the point of this panel: an editor who just uploaded a track
 * has to SEE it. So the tracks come first with a count in the header, a
 * failed request says so instead of masquerading as "no subtitles", and the
 * upload form is a separate, collapsible step underneath.
 */
export function SubtitleManager({ videoId }: { videoId: string }) {
  const { t } = useLanguage();
  const { data: subtitles, isLoading, error, refetch } = useAsyncData(
    () => subtitleService.getForVideo(videoId),
    [videoId],
  );

  const [showForm, setShowForm] = useState(false);
  // Remounts the file field after a successful upload — the native input is
  // uncontrolled, so clearing our own state alone would leave the old file
  // name on screen.
  const [formKey, setFormKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("");
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subtitle | null>(null);

  const count = subtitles?.length ?? 0;
  const canUpload = !!file && !!language.trim() && !!label.trim();

  const handleLanguageChange = (value: string) => {
    const code = value.trim().toLowerCase();
    setLanguage(value);
    // Only fill an EMPTY label — never overwrite something the editor typed.
    if (!label.trim() && LABEL_FOR_CODE[code]) setLabel(LABEL_FOR_CODE[code]);
  };

  const resetForm = () => {
    setFile(null);
    setLanguage("");
    setLabel("");
    setIsDefault(false);
    setFormKey((k) => k + 1);
  };

  const handleUpload = async () => {
    if (!file || !canUpload) {
      toast.error(t.movies.subtitles.missingFieldsToast);
      return;
    }
    setUploading(true);
    try {
      const created = await subtitleService.upload(videoId, file, language.trim(), label.trim(), isDefault);
      resetForm();
      setShowForm(false);
      setJustAddedId(created.id);
      refetch();
      toast.success(t.movies.subtitles.uploadedToast, {
        description: t.movies.subtitles.uploadedDescription(created.label, created.language),
      });
    } catch (err) {
      toast.error(t.movies.subtitles.uploadFailedToast, { description: err instanceof Error ? err.message : undefined });
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
      toast.error(t.movies.subtitles.setDefaultFailedToast);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await subtitleService.remove(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.success(t.movies.subtitles.removedToast);
    } catch {
      toast.error(t.movies.subtitles.removeFailedToast);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
      {/* Header: what this is, how many there are, and the one action. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Captions className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">{t.movies.subtitles.title}</p>
          {!isLoading && !error && (
            <Badge variant="secondary" className="tabular-nums">
              {count}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={showForm ? "secondary" : "outline"}
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
        >
          <Plus className="size-3.5" />
          {t.movies.subtitles.addSubtitle}
        </Button>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{t.movies.subtitles.hint}</p>

      {/* The tracks. Loading, failed, empty and populated are four different truths. */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {t.movies.subtitles.loading}
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>{t.movies.subtitles.loadFailed}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={refetch}>
            <RefreshCw className="size-3.5" />
            {t.movies.subtitles.retry}
          </Button>
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border px-3 py-5 text-center">
          <Captions className="size-5 text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground">{t.movies.subtitles.empty}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5" aria-label={t.movies.subtitles.title}>
          {subtitles!.map((s) => (
            <li
              key={s.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 transition-shadow",
                justAddedId === s.id && "ring-2 ring-primary/40",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="shrink-0 rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
                  {s.language}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-mono">{s.format}</span>
                    {" · "}
                    <span className="font-mono">{format(new Date(s.createdAt), "d MMM yyyy")}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {s.isDefault ? (
                  <StatusBadge label={t.movies.subtitles.default} tone="success" />
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={busyId === s.id}
                    onClick={() => handleSetDefault(s)}
                  >
                    <Star className="size-3.5" />
                    {t.movies.subtitles.setAsDefault}
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={busyId === s.id}
                  onClick={() => setDeleteTarget(s)}
                  aria-label={`${t.common.delete}: ${s.label}`}
                  title={t.common.delete}
                >
                  {busyId === s.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5 text-destructive" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Upload form: a deliberate second step, not permanently in the way. */}
      {showForm && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-background/60 p-3">
          <FileUploadField
            key={formKey}
            label={t.movies.subtitles.fileLabel}
            hint={t.movies.subtitles.fileHint}
            accept=".srt,.vtt,.ass"
            variant="file"
            file={file}
            onChange={setFile}
            disabled={uploading}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subtitle-language" className="text-xs">
                {t.movies.subtitles.languageCodeLabel}
              </Label>
              <Input
                id="subtitle-language"
                placeholder="en"
                autoCapitalize="none"
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                disabled={uploading}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subtitle-label" className="text-xs">
                {t.movies.subtitles.labelField}
              </Label>
              <Input
                id="subtitle-label"
                placeholder="English"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={uploading}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="subtitle-default" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch id="subtitle-default" checked={isDefault} onCheckedChange={setIsDefault} disabled={uploading} />
              {t.movies.subtitles.setAsDefault}
            </label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                disabled={uploading}
              >
                {t.common.cancel}
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={uploading || !canUpload}>
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {t.movies.subtitles.uploadSubtitle}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t.movies.subtitles.deleteTitle}
        description={deleteTarget ? t.movies.subtitles.deleteDescription(deleteTarget.label, deleteTarget.language) : ""}
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={!!deleteTarget && busyId === deleteTarget.id}
        onConfirm={handleDelete}
      />
    </section>
  );
}
