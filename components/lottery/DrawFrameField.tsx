"use client";

import { useRef } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/context/language-context";
import { BUILT_IN_FRAME_SRC, TICKET_FRAME } from "@/lib/ticket-template";
import { FRAME_UPLOAD_MAX_BYTES } from "@/services/api/uploadService";

interface DrawFrameFieldProps {
  /** The frame the draw will print with: a picked file's object URL, a stored URL, or null for the built-in frame. */
  preview: string | null;
  /** Where the frame comes from, in words ("From Settings", "Built-in frame", "<file> — uploaded on Save"). */
  source: string;
  disabled?: boolean;
  /** The reason the frame cannot change (tickets sold), shown in place of the buttons. */
  lockedReason?: string | null;
  onPick: (file: File) => void;
  /** The way back from a picked or own frame, or null when there is nothing to go back to. */
  reset: { label: string; onReset: () => void } | null;
}

/**
 * The draw's ticket frame, as one line in the New draw and Edit draw
 * dialogs: a thumbnail, where the frame comes from, "Use a different frame"
 * and the way back. The frame is normally the setting's copy; this is the
 * exception for one draw. The upload itself happens on Save, in the dialog,
 * like the picture (purpose "lottery_frame").
 */
export function DrawFrameField({ preview, source, disabled = false, lockedReason = null, onPick, reset }: DrawFrameFieldProps) {
  const { t } = useLanguage();
  const f = t.lottery.draws.form.frame;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{f.label}</Label>
      <div className="flex items-start gap-3">
        <div
          className="relative h-12 shrink-0 overflow-hidden rounded-md bg-[#FBF7EE] ring-1 ring-[var(--border-strong)]"
          style={{ aspectRatio: `${TICKET_FRAME.width} / ${TICKET_FRAME.height}` }}
        >
          <Image
            key={preview ?? BUILT_IN_FRAME_SRC}
            src={preview ?? BUILT_IN_FRAME_SRC}
            alt=""
            fill
            sizes="96px"
            unoptimized
            draggable={false}
            className="object-contain"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="truncate text-sm">{source}</p>
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
                  // Over the backend's frame cap: say so now, before Save
                  // would send the whole file only to get a 413 back.
                  if (file && file.size > FRAME_UPLOAD_MAX_BYTES) toast.error(f.tooLargeToast);
                  else if (file) onPick(file);
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
                  {f.useDifferent}
                </Button>
                {reset && (
                  <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={reset.onReset}>
                    {reset.label}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
