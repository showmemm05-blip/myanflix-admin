"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { DrawFrameField } from "@/components/lottery/DrawFrameField";
import { DrawPictureField } from "@/components/lottery/DrawPictureField";
import { lotteryErrorMessage } from "@/components/lottery/drawFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { formatKyat } from "@/lib/currency";
import {
  defaultSalesCloseIso,
  formatMmt,
  fromMmtInputValue,
  nextThaiDrawDate,
  thaiDrawAtIso,
  toMmtInputValue,
} from "@/lib/myanmar-time";
import { lotteryService } from "@/services/api/lotteryService";
import { uploadService } from "@/services/api/uploadService";
import type { LotteryAdminDraw } from "@/types/lottery";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The closing offset the override field starts from when the settings could
 * not be loaded — the backend's own default. The backend still decides the
 * real default when no override is sent.
 */
const FALLBACK_CLOSE_MINUTES = 60;

interface NewDrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (draw: LotteryAdminDraw) => void;
}

/**
 * Create one draw. The draw number is prefilled with the next one, the Thai
 * draw date with the next 1st or 16th, and the closing time is previewed
 * from the settings unless the admin sets one of the draw's own. Price and
 * per-number limit are not asked for: the backend copies them from the
 * settings, and the note says so. The ticket frame is copied the same way,
 * unless the admin picks a different one for this draw. The parent mounts
 * it with a `key` per opening, so the form state is seeded once.
 */
export function NewDrawDialog({ open, onOpenChange, onCreated }: NewDrawDialogProps) {
  const { t } = useLanguage();
  const d = t.lottery.draws;
  const f = d.form;

  // The settings (for the note and the closing preview) and the newest draw
  // number (for the prefill). Each may fail on its own without blocking the
  // form — the backend fills in whatever is left out.
  const { data: prefill, isLoading } = useAsyncData(async () => {
    const [settings, latest] = await Promise.all([
      lotteryService.getSettings().catch(() => null),
      lotteryService.listDraws({ page: 1, pageSize: 1 }).catch(() => null),
    ]);
    return { settings, nextDrawNo: (latest?.items[0]?.drawNo ?? 0) + 1 };
  }, []);

  // Overrides start out unset (null) so the input shows the prefill once it
  // has loaded; once the admin types, the override takes over.
  const [drawNoOverride, setDrawNoOverride] = useState<string | null>(null);
  const [thaiDrawDate, setThaiDrawDate] = useState(() => nextThaiDrawDate());
  /** A closing time of the draw's own, as a Myanmar-time input value; null = the setting's. */
  const [closeOverride, setCloseOverride] = useState<string | null>(null);
  /** A picked file, uploaded on Save; the URL once uploaded. */
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  /** A frame of this draw's own: a picked file, uploaded on Save; the URL once uploaded. Null = the setting's copy. */
  const [frameFile, setFrameFile] = useState<File | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const objectUrl = useObjectUrl(pictureFile);
  const frameObjectUrl = useObjectUrl(frameFile);

  const settings = prefill?.settings ?? null;
  const ownFrame = !!(frameFile || frameUrl);
  // Where the frame comes from, in words: the picked file, else the setting's
  // (also when the settings could not be read — the backend copies it), else the built-in.
  const frameSource = frameFile
    ? f.frame.picked(frameFile.name)
    : frameUrl
      ? f.frame.own
      : settings === null || settings.frameUrl
        ? f.frame.fromSettings
        : f.frame.builtIn;
  const drawNo = drawNoOverride ?? (prefill ? String(prefill.nextDrawNo) : "");
  const drawNoNumber = Number(drawNo);
  const closeMinutes = settings?.salesCloseMinutesBefore ?? FALLBACK_CLOSE_MINUTES;

  const drawAtMs = DATE_PATTERN.test(thaiDrawDate) ? new Date(thaiDrawAtIso(thaiDrawDate)).getTime() : NaN;
  const dateValid = !Number.isNaN(drawAtMs);
  const defaultCloseIso = dateValid ? defaultSalesCloseIso(thaiDrawDate, closeMinutes) : null;
  const overrideIso = closeOverride === null ? null : fromMmtInputValue(closeOverride);

  const problems = {
    drawNo: !(Number.isInteger(drawNoNumber) && drawNoNumber >= 1),
    date: !dateValid,
    close: closeOverride !== null && (!overrideIso || new Date(overrideIso).getTime() >= drawAtMs),
  };
  const hasProblem = problems.drawNo || problems.date || problems.close;

  const handleSave = async () => {
    if (hasProblem) {
      setShowProblems(true);
      return;
    }
    setSaving(true);
    try {
      let nextPictureUrl = pictureUrl;
      const file = pictureFile;
      if (file) {
        nextPictureUrl = (await uploadService.uploadImage(file, "lottery")).url;
        // Keep the uploaded copy: if the create below is refused, the next
        // Save reuses it instead of uploading the same picture again.
        setPictureUrl(nextPictureUrl);
        setPictureFile((prev) => (prev === file ? null : prev));
      }
      let nextFrameUrl = frameUrl;
      const frame = frameFile;
      if (frame) {
        nextFrameUrl = (await uploadService.uploadImage(frame, "lottery_frame")).url;
        setFrameUrl(nextFrameUrl);
        setFrameFile((prev) => (prev === frame ? null : prev));
      }
      const draw = await lotteryService.createDraw({
        drawNo: drawNoNumber,
        thaiDrawDate,
        salesCloseAt: overrideIso ?? undefined,
        pictureUrl: nextPictureUrl ?? undefined,
        frameUrl: nextFrameUrl ?? undefined,
      });
      toast.success(f.createdToast);
      onCreated(draw);
      onOpenChange(false);
    } catch (err) {
      toast.error(f.saveFailedToast, { description: lotteryErrorMessage(err, t) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.createTitle}</DialogTitle>
          <DialogDescription>{f.createDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draw-no">{f.drawNoLabel}</Label>
              <Input
                id="draw-no"
                type="number"
                min={1}
                step={1}
                value={drawNo}
                disabled={saving || isLoading}
                aria-invalid={showProblems && problems.drawNo}
                className="font-mono tabular-nums"
                onChange={(e) => setDrawNoOverride(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {showProblems && problems.drawNo ? (
                  <span className="text-destructive">{f.drawNoInvalid}</span>
                ) : (
                  f.drawNoHint
                )}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draw-date">{f.thaiDrawDateLabel}</Label>
              <Input
                id="draw-date"
                type="date"
                value={thaiDrawDate}
                disabled={saving}
                aria-invalid={showProblems && problems.date}
                className="tabular-nums"
                onChange={(e) => setThaiDrawDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {showProblems && problems.date ? (
                  <span className="text-destructive">{f.dateInvalid}</span>
                ) : (
                  f.thaiDrawDateHint
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draw-close">{f.salesCloseLabel}</Label>
            {closeOverride === null ? (
              <>
                <p className="text-sm tabular-nums">
                  {defaultCloseIso ? f.salesClosePreview(formatMmt(defaultCloseIso), closeMinutes) : "—"}
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto self-start p-0"
                  disabled={saving || !dateValid}
                  onClick={() => setCloseOverride(toMmtInputValue(defaultCloseIso ?? thaiDrawAtIso(thaiDrawDate)))}
                >
                  {f.overrideSalesClose}
                </Button>
              </>
            ) : (
              <>
                <Input
                  id="draw-close"
                  type="datetime-local"
                  value={closeOverride}
                  disabled={saving}
                  aria-invalid={showProblems && problems.close}
                  className="tabular-nums"
                  onChange={(e) => setCloseOverride(e.target.value)}
                />
                {showProblems && problems.close && <p className="text-xs text-destructive">{f.salesCloseInvalid}</p>}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto self-start p-0"
                  disabled={saving}
                  onClick={() => setCloseOverride(null)}
                >
                  {f.useDefaultSalesClose}
                </Button>
              </>
            )}
          </div>

          <DrawPictureField
            preview={objectUrl ?? pictureUrl}
            disabled={saving}
            onPick={setPictureFile}
            onRemove={() => {
              setPictureFile(null);
              setPictureUrl(null);
            }}
          />

          <DrawFrameField
            preview={frameObjectUrl ?? frameUrl ?? settings?.frameUrl ?? null}
            source={frameSource}
            disabled={saving || isLoading}
            onPick={setFrameFile}
            reset={
              ownFrame
                ? {
                    label: f.frame.useSettings,
                    onReset: () => {
                      setFrameFile(null);
                      setFrameUrl(null);
                    },
                  }
                : null
            }
          />

          {!isLoading && (
            <p className="rounded-lg border border-[var(--border-strong)] bg-secondary/20 p-3 text-xs text-muted-foreground">
              {settings
                ? f.copiedNote(formatKyat(settings.ticketPrice), settings.maxPerNumber)
                : f.settingsUnavailable}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving && pictureFile ? f.uploadingPicture : saving && frameFile ? f.frame.uploading : d.newDraw}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
