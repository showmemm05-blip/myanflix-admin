"use client";

import { useRef } from "react";
import Image from "next/image";
import { AlertTriangle, ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/context/language-context";
import { formatBytes } from "@/lib/upload/format";
import { cn } from "@/lib/utils";
import { isGifFile, type AdImageSize } from "@/components/ads/adForm";
import { AD_IMAGE_GIF_WARN_BYTES, AD_IMAGE_MIME_TYPES } from "@/types/ad";

/** A checkerboard behind the thumbnail, so a transparent PNG reads as transparent. */
const CHECKERBOARD = {
  backgroundImage: "repeating-conic-gradient(rgba(255,255,255,0.08) 0% 25%, transparent 0% 50%)",
  backgroundSize: "12px 12px",
} as const;

const ACCEPT = AD_IMAGE_MIME_TYPES.join(",");

interface AdImageFieldProps {
  /** What the thumbnail shows: the picked file's object URL, else the stored picture, else null. */
  src: string | null;
  /** The file picked now, uploaded on save. */
  file: File | null;
  /** The picked file's size as the browser read it; null while reading, "unreadable" when it could not. */
  fileSize: AdImageSize | "unreadable" | null;
  /** The picture already on the ad (editing), or null. */
  current: { bytes: number | null; width: number | null; height: number | null } | null;
  onPick: (file: File) => void;
  /** Drops the picked file (the stored picture, if any, stays). */
  onClear: () => void;
  /** The picked file decoded (its size) or failed to (null) — read off the thumbnail itself, no second decode. */
  onMeasured: (file: File, size: AdImageSize | null) => void;
  uploading: boolean;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * A corner ad's picture (the `Corner2` board): a thumbnail of the file
 * picked now (a local object URL) or of the stored one, what it is ("New
 * picture — it uploads when you save" · its name · "480 × 160 · 0.4 MB ·
 * moving"), the pick / replace / remove buttons, and a warning for a heavy
 * GIF. How it sits on the player is CornerPreview, on the timing step. Like
 * the video, a stored picture is never removed — another one replaces it,
 * and switching the ad off is how it stops showing.
 */
export function AdImageField({
  src,
  file,
  fileSize,
  current,
  onPick,
  onClear,
  onMeasured,
  uploading,
  disabled = false,
  invalid = false,
}: AdImageFieldProps) {
  const { t } = useLanguage();
  const p = t.adsUi.wizard.picture;
  const inputRef = useRef<HTMLInputElement>(null);
  const hasCurrent = !!current && !!src && !file;

  const sizeText = (width: number, height: number, bytes: number | null) =>
    `${p.size(width, height)} · ${bytes === null ? "—" : formatBytes(bytes)}`;
  const metaLine = file
    ? fileSize === null
      ? `${p.reading} · ${formatBytes(file.size)}`
      : fileSize === "unreadable"
        ? `${p.unreadable} · ${formatBytes(file.size)}`
        : sizeText(fileSize.width, fileSize.height, file.size)
    : current && hasCurrent && current.width !== null && current.height !== null
      ? sizeText(current.width, current.height, current.bytes)
      : null;
  const gif = !!file && isGifFile(file);
  const heavyGif = gif && file.size > AD_IMAGE_GIF_WARN_BYTES;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{p.label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onPick(picked);
          // Reset so picking the same file again (after clearing it) still
          // fires a change event — a file input ignores a repeat selection.
          e.target.value = "";
        }}
      />

      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center",
          invalid ? "border-destructive/60" : "border-[var(--border-strong)]",
        )}
      >
        <div
          className="relative flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-strong)] sm:w-44"
          style={CHECKERBOARD}
        >
          {src ? (
            <Image
              // Keyed on the source: each pick is its own element, so the
              // load below always belongs to the file it reports on.
              key={src}
              src={src}
              alt=""
              fill
              sizes="176px"
              unoptimized
              className="object-contain"
              onLoad={(e) => {
                if (file) onMeasured(file, { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
              }}
              onError={() => {
                if (file) onMeasured(file, null);
              }}
            />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {file || hasCurrent ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">{file ? p.picked : p.current}</span>
              <span className="text-xs break-all text-muted-foreground">
                {file && <>{file.name} · </>}
                {metaLine}
                {gif && <> · {p.moving}</>}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{p.empty}</span>
          )}
          {uploading ? (
            <p className="inline-flex items-center gap-1.5 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              {t.adsUi.wizard.footer.uploadingPicture}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <UploadCloud className="size-3.5" />
                {file || hasCurrent ? p.replace : p.choose}
              </Button>
              {file && (
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClear}>
                  <Trash2 className="size-3.5" />
                  {p.remove}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {heavyGif && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {p.gifHeavy}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{p.hint}</p>
    </div>
  );
}
