"use client";

import { AdImageField } from "@/components/ads/AdImageField";
import { AdVideoField } from "@/components/ads/AdVideoField";
import type { AdImageSize } from "@/components/ads/adForm";
import { markedAny, type StepProps } from "@/components/ads/wizard/stepProps";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/context/language-context";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { AD_LIMITS } from "@/types/ad";

export interface MediaStepProps extends StepProps {
  /** The browser is reading the picked video's length. */
  probing: boolean;
  /** The picture is on its way up (the video's progress sits in the wizard's footer). */
  imageUploading: boolean;
  onPickVideo: (file: File) => void;
  onPickImage: (file: File) => void;
  onMeasureImage: (file: File, size: AdImageSize | null) => void;
}

/** "12/120" under a box with a limit. */
function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className="shrink-0 tabular-nums">
      {length}/{max}
    </span>
  );
}

/**
 * Step 2 (the `Wiz2Video` and `Corner2` boards): the ad's name, its video
 * or picture, a corner picture's web page, and the private note. A video
 * ad's name is shown to viewers above it; a corner picture's is only for
 * the list (and screen readers) — the hint under the box says which.
 */
export function MediaStep({
  state,
  setState,
  set,
  existing,
  disabled,
  marked,
  probing,
  imageUploading,
  onPickVideo,
  onPickImage,
  onMeasureImage,
}: MediaStepProps) {
  const { t } = useLanguage();
  const m = t.adsUi.wizard.media;
  const corner = state.format === "CORNER";
  const format = state.format;
  const imageObjectUrl = useObjectUrl(corner ? state.imageFile : null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ad-title">{m.nameLabel}</Label>
        <Input
          id="ad-title"
          value={state.title}
          maxLength={AD_LIMITS.title}
          disabled={disabled}
          aria-invalid={markedAny(marked, "TITLE_REQUIRED", "TITLE_TOO_LONG") || undefined}
          onChange={(e) => set("title", e.target.value)}
        />
        <div className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>{m.nameHints[format]}</span>
          <Counter length={state.title.length} max={AD_LIMITS.title} />
        </div>
      </div>

      {corner ? (
        <>
          <AdImageField
            src={imageObjectUrl ?? existing?.imageUrl ?? null}
            file={state.imageFile}
            fileSize={state.imageFileSize}
            current={
              existing?.imageUrl
                ? { bytes: existing.imageBytes, width: existing.imageWidth, height: existing.imageHeight }
                : null
            }
            onPick={onPickImage}
            onClear={() => setState((prev) => ({ ...prev, imageFile: null, imageFileSize: null }))}
            onMeasured={onMeasureImage}
            uploading={imageUploading}
            disabled={disabled}
            invalid={markedAny(marked, "PICTURE_TYPE", "PICTURE_TOO_LARGE", "PICTURE_UNREADABLE", "PICTURE_SHAPE")}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ad-linkUrl">
              {m.linkLabel}
              <span className="font-normal text-muted-foreground"> · {t.adsUi.shared.optional}</span>
            </Label>
            <Input
              id="ad-linkUrl"
              type="url"
              inputMode="url"
              placeholder={m.linkPlaceholder}
              value={state.linkUrl}
              maxLength={AD_LIMITS.linkUrl}
              disabled={disabled}
              aria-invalid={markedAny(marked, "LINK_INVALID", "LINK_TOO_LONG") || undefined}
              onChange={(e) => set("linkUrl", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{m.linkHint}</p>
          </div>
        </>
      ) : (
        <AdVideoField
          current={
            existing?.videoUrl
              ? { url: existing.videoUrl, durationSeconds: existing.durationSeconds, bytes: existing.videoBytes }
              : null
          }
          file={state.videoFile}
          fileDurationSeconds={state.videoFileDurationSeconds}
          probing={probing}
          onPick={onPickVideo}
          onClear={() => setState((prev) => ({ ...prev, videoFile: null, videoFileDurationSeconds: null }))}
          // The footer shows the upload and holds the one "Stop upload", on every step.
          upload={null}
          disabled={disabled}
          invalid={markedAny(marked, "VIDEO_NOT_MP4", "VIDEO_TOO_LARGE", "VIDEO_DURATION")}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ad-description">
          {m.noteLabel}
          <span className="font-normal text-muted-foreground"> · {t.adsUi.shared.optional}</span>
        </Label>
        <Textarea
          id="ad-description"
          rows={2}
          value={state.description}
          maxLength={AD_LIMITS.description}
          placeholder={m.notePlaceholders[format]}
          disabled={disabled}
          aria-invalid={marked.has("DESCRIPTION_TOO_LONG") || undefined}
          onChange={(e) => set("description", e.target.value)}
        />
        <div className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>{m.noteHint}</span>
          <Counter length={state.description.length} max={AD_LIMITS.description} />
        </div>
      </div>
    </div>
  );
}
