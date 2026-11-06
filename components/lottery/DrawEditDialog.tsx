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
import { drawFieldLocks, isTicketPrice, lotteryErrorMessage, type DrawLockReason } from "@/components/lottery/drawFormat";
import { useLanguage } from "@/lib/context/language-context";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { formatMmt, fromMmtInputValue, thaiDrawAtIso, toMmtInputValue } from "@/lib/myanmar-time";
import { lotteryService } from "@/services/api/lotteryService";
import { uploadService } from "@/services/api/uploadService";
import { LOTTERY_LIMITS, type LotteryAdminDraw, type UpdateLotteryDrawInput } from "@/types/lottery";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface DrawEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draw: LotteryAdminDraw;
  onSaved: (draw: LotteryAdminDraw) => void;
}

/**
 * Edit one draw. Each field is greyed out with its reason as soon as the
 * backend would refuse it (see drawFieldLocks): the date, price and limit
 * once a ticket is sold or the draw is published, the picture and the frame
 * once a ticket is sold, the closing time once sales are closed. Save sends
 * only what changed. The parent mounts it with a `key` per opening, so the
 * form state is seeded once from the draw.
 */
export function DrawEditDialog({ open, onOpenChange, draw, onSaved }: DrawEditDialogProps) {
  const { t } = useLanguage();
  const d = t.lottery.draws;
  const f = d.form;
  const locks = drawFieldLocks(draw);
  const reason = (lock: DrawLockReason | null) => (lock ? f.locked[lock] : null);

  const [thaiDrawDate, setThaiDrawDate] = useState(draw.thaiDrawDate);
  /** The closing time as a Myanmar-time input value. */
  const [salesClose, setSalesClose] = useState(() => toMmtInputValue(draw.salesCloseAt));
  const [ticketPrice, setTicketPrice] = useState(String(draw.ticketPrice));
  const [maxPerNumber, setMaxPerNumber] = useState(String(draw.maxPerNumber));
  /** The picture already stored (or null after Remove). */
  const [pictureUrl, setPictureUrl] = useState(draw.pictureUrl);
  /** A picked file, uploaded on Save. */
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  /** The frame already stored (or null for the built-in, also after "Use the built-in frame"). */
  const [frameUrl, setFrameUrl] = useState(draw.frameUrl);
  /** A picked frame file, uploaded on Save. */
  const [frameFile, setFrameFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const objectUrl = useObjectUrl(pictureFile);
  const frameObjectUrl = useObjectUrl(frameFile);

  const frameSource = frameFile ? f.frame.picked(frameFile.name) : frameUrl ? f.frame.own : f.frame.builtIn;
  // The way back: a picked file → keep what is stored; a stored frame → the built-in one.
  const frameReset = frameFile
    ? { label: f.frame.keepCurrent, onReset: () => setFrameFile(null) }
    : frameUrl
      ? { label: f.frame.useBuiltIn, onReset: () => setFrameUrl(null) }
      : null;

  // The draw's moment follows the date in the form, so moving the date also
  // re-checks the closing time against it.
  const drawAtMs = DATE_PATTERN.test(thaiDrawDate) ? new Date(thaiDrawAtIso(thaiDrawDate)).getTime() : NaN;
  const dateValid = !Number.isNaN(drawAtMs);
  const salesCloseIso = fromMmtInputValue(salesClose);
  const priceNumber = Number(ticketPrice);
  const maxNumber = Number(maxPerNumber);
  const { min: maxMin, max: maxMax } = LOTTERY_LIMITS.maxPerNumber;

  const problems = {
    date: !locks.thaiDrawDate && !dateValid,
    close:
      !locks.salesCloseAt && (!salesCloseIso || !dateValid || new Date(salesCloseIso).getTime() >= drawAtMs),
    price: !locks.ticketPrice && !isTicketPrice(ticketPrice),
    max: !locks.maxPerNumber && !(Number.isInteger(maxNumber) && maxNumber >= maxMin && maxNumber <= maxMax),
  };
  const hasProblem = problems.date || problems.close || problems.price || problems.max;

  const handleSave = async () => {
    if (hasProblem) {
      setShowProblems(true);
      return;
    }
    setSaving(true);
    try {
      let nextPictureUrl = pictureUrl;
      const file = pictureFile;
      if (file && !locks.pictureUrl) {
        nextPictureUrl = (await uploadService.uploadImage(file, "lottery")).url;
        // Keep the uploaded copy: if the save below is refused, the next
        // Save reuses it instead of uploading the same picture again.
        setPictureUrl(nextPictureUrl);
        setPictureFile((prev) => (prev === file ? null : prev));
      }
      let nextFrameUrl = frameUrl;
      const frame = frameFile;
      if (frame && !locks.frameUrl) {
        nextFrameUrl = (await uploadService.uploadImage(frame, "lottery_frame")).url;
        setFrameUrl(nextFrameUrl);
        setFrameFile((prev) => (prev === frame ? null : prev));
      }

      // PATCH semantics — only what differs from the stored draw is sent,
      // and never a locked field. The closing time also goes along whenever
      // the date moves: left out, the backend would shift it to keep its
      // gap to the draw, and the form showed the admin a different time.
      const changed: UpdateLotteryDrawInput = {};
      if (!locks.thaiDrawDate && thaiDrawDate !== draw.thaiDrawDate) changed.thaiDrawDate = thaiDrawDate;
      if (
        !locks.salesCloseAt &&
        salesCloseIso &&
        (salesCloseIso !== draw.salesCloseAt || changed.thaiDrawDate !== undefined)
      ) {
        changed.salesCloseAt = salesCloseIso;
      }
      if (!locks.ticketPrice && priceNumber !== draw.ticketPrice) changed.ticketPrice = priceNumber;
      if (!locks.maxPerNumber && maxNumber !== draw.maxPerNumber) changed.maxPerNumber = maxNumber;
      if (!locks.pictureUrl && nextPictureUrl !== draw.pictureUrl) changed.pictureUrl = nextPictureUrl;
      if (!locks.frameUrl && nextFrameUrl !== draw.frameUrl) changed.frameUrl = nextFrameUrl;

      const saved =
        Object.keys(changed).length > 0 ? await lotteryService.updateDraw(draw.id, changed) : draw;
      toast.success(f.updatedToast);
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(f.saveFailedToast, { description: lotteryErrorMessage(err, t) });
    } finally {
      setSaving(false);
    }
  };

  /** The line under a field: the lock reason, the problem, or the hint. */
  const note = (lock: DrawLockReason | null, problem: boolean, problemText: string, hint?: string) => {
    const locked = reason(lock);
    if (locked) return <p className="text-xs text-muted-foreground">{locked}</p>;
    if (showProblems && problem) return <p className="text-xs text-destructive">{problemText}</p>;
    return hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null;
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.editTitle}</DialogTitle>
          <DialogDescription>
            {d.drawLabel(draw.drawNo)} · {d.statuses[draw.status]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-draw-date">{f.thaiDrawDateLabel}</Label>
            <Input
              id="edit-draw-date"
              type="date"
              value={thaiDrawDate}
              disabled={saving || !!locks.thaiDrawDate}
              aria-invalid={showProblems && problems.date}
              className="tabular-nums"
              onChange={(e) => setThaiDrawDate(e.target.value)}
            />
            {note(locks.thaiDrawDate, problems.date, f.dateInvalid, f.thaiDrawDateHint)}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-draw-close">{f.salesCloseLabel}</Label>
            <Input
              id="edit-draw-close"
              type="datetime-local"
              value={salesClose}
              disabled={saving || !!locks.salesCloseAt}
              aria-invalid={showProblems && problems.close}
              className="tabular-nums"
              onChange={(e) => setSalesClose(e.target.value)}
            />
            {note(
              locks.salesCloseAt,
              problems.close,
              f.salesCloseInvalid,
              dateValid ? `${d.detail.drawAt}: ${formatMmt(thaiDrawAtIso(thaiDrawDate))} ${d.mmt}` : undefined,
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-draw-price">{f.ticketPriceLabel}</Label>
              <Input
                id="edit-draw-price"
                type="number"
                min={1}
                step={100}
                value={ticketPrice}
                disabled={saving || !!locks.ticketPrice}
                aria-invalid={showProblems && problems.price}
                className="tabular-nums"
                onChange={(e) => setTicketPrice(e.target.value)}
              />
              {note(locks.ticketPrice, problems.price, f.priceInvalid)}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-draw-max">{f.maxPerNumberLabel}</Label>
              <Input
                id="edit-draw-max"
                type="number"
                min={maxMin}
                max={maxMax}
                step={1}
                value={maxPerNumber}
                disabled={saving || !!locks.maxPerNumber}
                aria-invalid={showProblems && problems.max}
                className="tabular-nums"
                onChange={(e) => setMaxPerNumber(e.target.value)}
              />
              {note(locks.maxPerNumber, problems.max, f.maxPerNumberInvalid(maxMin, maxMax))}
            </div>
          </div>

          <DrawPictureField
            preview={objectUrl ?? pictureUrl}
            disabled={saving}
            lockedReason={reason(locks.pictureUrl)}
            onPick={setPictureFile}
            onRemove={() => {
              setPictureFile(null);
              setPictureUrl(null);
            }}
          />

          <DrawFrameField
            preview={frameObjectUrl ?? frameUrl}
            source={frameSource}
            disabled={saving}
            lockedReason={reason(locks.frameUrl)}
            onPick={setFrameFile}
            reset={frameReset}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving && pictureFile ? f.uploadingPicture : saving && frameFile ? f.frame.uploading : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
