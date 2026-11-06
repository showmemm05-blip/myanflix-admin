"use client";

import { useRef } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import { DreamPicture } from "@/components/lottery/DreamPicture";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/context/language-context";

interface DrawPictureFieldProps {
  /** What the slot shows: a picked file's object URL, the stored picture, or null. */
  preview: string | null;
  disabled?: boolean;
  /** The reason the picture cannot change (tickets sold), shown in place of the buttons. */
  lockedReason?: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}

/**
 * The draw's picture: a wide slot with Upload / Replace / Remove. Shared by
 * the New draw and Edit draw dialogs; the upload itself happens on Save,
 * in the dialog, like the dream and promo forms.
 */
export function DrawPictureField({ preview, disabled = false, lockedReason = null, onPick, onRemove }: DrawPictureFieldProps) {
  const { t } = useLanguage();
  const f = t.lottery.draws.form;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{f.pictureLabel}</Label>
      <div className="flex items-start gap-3">
        <DreamPicture src={preview} alt="" placeholder="icon" className="h-24 w-40 shrink-0" />
        <div className="flex flex-col gap-2">
          {lockedReason ? (
            <p className="text-xs text-muted-foreground">{lockedReason}</p>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onPick(file);
                  // Reset so picking the same file again still fires a change.
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageIcon className="size-3.5" />
                  {preview ? f.replacePicture : f.uploadPicture}
                </Button>
                {preview && (
                  <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
                    <Trash2 className="size-3.5" />
                    {f.removePicture}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{f.pictureHint}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
