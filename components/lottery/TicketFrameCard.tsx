"use client";

import { useRef, useState } from "react";
import { Download, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketPreview, type TicketPreviewDraw } from "@/components/lottery/TicketPreview";
import { saveBlob } from "@/components/lottery/dreamFormat";
import { useLanguage } from "@/lib/context/language-context";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { GUIDE_FILE_NAME, buildLayoutGuide } from "@/lib/ticket-guide";
import { FRAME_UPLOAD_MAX_BYTES } from "@/services/api/uploadService";

interface TicketFrameCardProps {
  /** The frame as the form holds it: the stored URL, an uploaded one, or null for the built-in frame. */
  frameUrl: string | null;
  /** A picked file waiting for Save; its object URL is what the card shows. */
  pickedFile: File | null;
  /** The draw the sample ticket prints — the price follows the form, so the sample is live. */
  sampleDraw: TicketPreviewDraw;
  disabled?: boolean;
  canManage: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}

/**
 * Lottery → Settings' "Ticket frame" card: which frame is in use, Upload /
 * Replace / Remove (back to the built-in frame), the layout guide PNG, and
 * the live sample ticket on that frame. The upload itself happens on the
 * page's Save (purpose "lottery_frame"), like the dialogs' pictures.
 */
export function TicketFrameCard({
  frameUrl,
  pickedFile,
  sampleDraw,
  disabled = false,
  canManage,
  onPick,
  onRemove,
}: TicketFrameCardProps) {
  const { t } = useLanguage();
  const s = t.lottery.settings.frame;
  const fileRef = useRef<HTMLInputElement>(null);
  const [building, setBuilding] = useState(false);
  const objectUrl = useObjectUrl(pickedFile);
  const preview = objectUrl ?? frameUrl;

  const status = pickedFile ? s.picked(pickedFile.name) : frameUrl ? s.uploaded : s.builtIn;

  const handleGuide = async () => {
    setBuilding(true);
    try {
      saveBlob(await buildLayoutGuide(), GUIDE_FILE_NAME);
    } catch {
      toast.error(s.guideFailedToast);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{s.title}</CardTitle>
        <CardDescription>{s.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm">{status}</p>
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
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
                    if (file && file.size > FRAME_UPLOAD_MAX_BYTES) toast.error(s.tooLargeToast);
                    else if (file) onPick(file);
                    // Reset so picking the same file again still fires a change.
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => fileRef.current?.click()}>
                  <ImageIcon className="size-3.5" />
                  {preview ? s.replace : s.upload}
                </Button>
                {preview && (
                  <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
                    <Trash2 className="size-3.5" />
                    {s.remove}
                  </Button>
                )}
              </>
            )}
            <Button type="button" variant="outline" size="sm" disabled={building} onClick={handleGuide}>
              {building ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              {s.downloadGuide}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{s.hint}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.sampleTitle}</p>
          <TicketPreview frameUrl={preview} pictureUrl={null} draw={sampleDraw} label={s.previewLabel} className="max-w-2xl" />
          <p className="text-xs text-muted-foreground">{s.sampleHint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
