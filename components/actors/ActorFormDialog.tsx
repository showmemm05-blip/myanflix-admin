"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUploadField } from "@/components/movies/FileUploadField";
import { actorService } from "@/services/api/actorService";
import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { useLanguage } from "@/lib/context/language-context";
import type { Actor } from "@/types/actor";
import { toast } from "sonner";

interface ActorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent (or null) when creating. */
  actor?: Actor | null;
  onSaved: (actor: Actor) => void;
}

function ActorForm({ actor, onOpenChange, onSaved }: Omit<ActorFormDialogProps, "open">) {
  const { t } = useLanguage();
  const [name, setName] = useState(actor?.name ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const photoPreview = useObjectUrl(photoFile);

  const trimmedName = name.trim();

  const handleSave = async () => {
    if (!trimmedName) {
      toast.error(t.actors.form.nameRequired);
      return;
    }
    setSaving(true);
    try {
      // The photo is uploaded only when the admin actually picked a new file —
      // an untouched edit keeps the URL the actor already has rather than
      // re-uploading the same bytes under a new key.
      const imageUrl = photoFile
        ? (await uploadService.uploadImage(photoFile, "actor")).url
        : actor?.imageUrl ?? undefined;

      const saved = actor
        ? await actorService.updateActor(actor.id, { name: trimmedName, imageUrl })
        : await actorService.createActor({ name: trimmedName, imageUrl });

      onSaved(saved);
      toast.success(actor ? t.actors.form.updatedToast : t.actors.form.createdToast);
      onOpenChange(false);
    } catch (err) {
      // A duplicate name comes back as a 409 whose message names the clash.
      // Showing that instead of a generic failure is the difference between
      // "try again" and "this person is already in the catalog".
      toast.error(t.actors.form.saveFailedToast, {
        description: err instanceof ApiError ? err.message : t.movies.pleaseTryAgain,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{actor ? t.actors.form.editTitle : t.actors.form.createTitle}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="actor-name">{t.actors.form.name}</Label>
          <Input
            id="actor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.actors.form.namePlaceholder}
          />
        </div>

        {/* A newly picked file previews from its object URL; with none picked,
            an existing actor still shows the headshot already on file. */}
        <FileUploadField
          label={t.actors.form.photo}
          hint={t.actors.form.photoHint}
          accept="image/*"
          variant="image"
          aspect="poster"
          file={photoFile}
          previewUrl={photoPreview ?? actor?.imageUrl ?? undefined}
          onChange={setPhotoFile}
          disabled={saving}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleSave} disabled={saving || !trimmedName}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {actor ? t.common.save : t.common.add}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * One dialog for both create and edit — `actor` decides which. Remounted per
 * target via `key`, so the fields always start from the row being opened
 * instead of whatever the previous open left behind.
 */
export function ActorFormDialog({ open, onOpenChange, actor, onSaved }: ActorFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <ActorForm
            key={actor?.id ?? "new"}
            actor={actor}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
