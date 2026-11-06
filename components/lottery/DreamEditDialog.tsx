"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { DreamPicture } from "@/components/lottery/DreamPicture";
import { dreamErrorMessage } from "@/components/lottery/dreamFormat";
import { useLanguage } from "@/lib/context/language-context";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { lotteryService } from "@/services/api/lotteryService";
import { uploadService } from "@/services/api/uploadService";
import { LOTTERY_DREAM_LIMITS, type LotteryDream, type UpdateLotteryDreamInput } from "@/types/lottery";

interface DreamEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dream: LotteryDream;
  onSaved: (dream: LotteryDream) => void;
}

const orNull = (value: string) => {
  const text = value.trim();
  return text === "" ? null : text;
};

/**
 * Edit one dream: both names, the picture, on/off. The number is fixed (one
 * row per number, created up front). The parent mounts it with a `key` per
 * dream, so the form state is seeded once from props.
 */
export function DreamEditDialog({ open, onOpenChange, dream, onSaved }: DreamEditDialogProps) {
  const { t } = useLanguage();
  const d = t.lottery.dreams;
  const f = d.form;

  const [nameEn, setNameEn] = useState(dream.nameEn ?? "");
  const [nameMy, setNameMy] = useState(dream.nameMy ?? "");
  const [isActive, setIsActive] = useState(dream.isActive);
  /** The picture already stored (or null after Remove). */
  const [pictureUrl, setPictureUrl] = useState(dream.pictureUrl);
  /** A picked file, uploaded on Save. */
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrl = useObjectUrl(pictureFile);
  const preview = objectUrl ?? pictureUrl;

  const handleSave = async () => {
    setSaving(true);
    try {
      let nextPictureUrl = pictureUrl;
      const file = pictureFile;
      if (file) {
        nextPictureUrl = (await uploadService.uploadImage(file, "lottery")).url;
        // Keep the uploaded copy as the dream's picture right away: if the
        // save below is refused, the next Save reuses it instead of uploading
        // the same picture again.
        setPictureUrl(nextPictureUrl);
        setPictureFile((prev) => (prev === file ? null : prev));
      }

      // PATCH semantics — only what differs from the stored row is sent.
      const changed: UpdateLotteryDreamInput = {};
      const nextNameEn = orNull(nameEn);
      const nextNameMy = orNull(nameMy);
      if (nextNameEn !== dream.nameEn) changed.nameEn = nextNameEn;
      if (nextNameMy !== dream.nameMy) changed.nameMy = nextNameMy;
      if (nextPictureUrl !== dream.pictureUrl) changed.pictureUrl = nextPictureUrl;
      if (isActive !== dream.isActive) changed.isActive = isActive;

      const saved =
        Object.keys(changed).length > 0 ? await lotteryService.updateDream(dream.id, changed) : dream;
      toast.success(d.savedToast);
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(d.saveFailedToast, { description: dreamErrorMessage(err, t) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.title}</DialogTitle>
          <DialogDescription>
            {d.books[dream.book]} · <span className="font-mono tabular-nums">{dream.number}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dream-number">{f.numberLabel}</Label>
            <Input id="dream-number" value={dream.number} readOnly disabled className="font-mono tabular-nums" />
            <p className="text-xs text-muted-foreground">{f.numberHint}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dream-name-en">{f.nameEnLabel}</Label>
            <Input
              id="dream-name-en"
              value={nameEn}
              disabled={saving}
              maxLength={LOTTERY_DREAM_LIMITS.name}
              placeholder={f.nameEnPlaceholder}
              onChange={(e) => setNameEn(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dream-name-my">{f.nameMyLabel}</Label>
            <Input
              id="dream-name-my"
              value={nameMy}
              disabled={saving}
              maxLength={LOTTERY_DREAM_LIMITS.name}
              placeholder={f.nameMyPlaceholder}
              onChange={(e) => setNameMy(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{f.nameHint}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{f.pictureLabel}</Label>
            <div className="flex items-start gap-3">
              <DreamPicture src={preview} alt={dream.number} placeholder="icon" className="size-24 shrink-0" />
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPictureFile(file);
                    // Reset so picking the same file again still fires a change.
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImageIcon className="size-3.5" />
                    {preview ? f.replacePicture : f.uploadPicture}
                  </Button>
                  {preview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => {
                        setPictureFile(null);
                        setPictureUrl(null);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      {f.removePicture}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{f.pictureHint}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-strong)] p-3">
            <div>
              <Label htmlFor="dream-active">{f.activeLabel}</Label>
              <p className="text-xs text-muted-foreground">{f.activeHint}</p>
            </div>
            <Switch
              id="dream-active"
              checked={isActive}
              disabled={saving}
              onCheckedChange={(checked) => setIsActive(checked)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving && pictureFile ? f.uploadingPicture : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
