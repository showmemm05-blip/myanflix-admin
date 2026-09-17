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
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/movies/FileUploadField";
import { bookAuthorService } from "@/services/api/bookAuthorService";
import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { useLanguage } from "@/lib/context/language-context";
import type { BookAuthor } from "@/types/bookAuthor";
import { toast } from "sonner";

/** Matches CreateBookAuthorDto's @MaxLength(1000) on the backend. */
const BIO_MAX_LENGTH = 1000;

interface BookAuthorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent (or null) when creating. */
  author?: BookAuthor | null;
  onSaved: (author: BookAuthor) => void;
}

function BookAuthorForm({
  author,
  onOpenChange,
  onSaved,
}: Omit<BookAuthorFormDialogProps, "open">) {
  const { t } = useLanguage();
  const [name, setName] = useState(author?.name ?? "");
  const [bio, setBio] = useState(author?.bio ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const photoPreview = useObjectUrl(photoFile);

  const trimmedName = name.trim();

  const handleSave = async () => {
    if (!trimmedName) {
      toast.error(t.bookAuthors.form.nameRequired);
      return;
    }
    setSaving(true);
    try {
      // The photo is uploaded only when the admin actually picked a new file —
      // an untouched edit keeps the URL the author already has rather than
      // re-uploading the same bytes under a new key.
      const imageUrl = photoFile
        ? (await uploadService.uploadImage(photoFile, "bookauthor")).url
        : author?.imageUrl ?? undefined;

      const values = {
        name: trimmedName,
        imageUrl,
        bio: bio.trim() || null, // null clears an existing bio; undefined would keep it
      };

      const saved = author
        ? await bookAuthorService.updateAuthor(author.id, values)
        : await bookAuthorService.createAuthor(values);

      onSaved(saved);
      toast.success(author ? t.bookAuthors.form.updatedToast : t.bookAuthors.form.createdToast);
      onOpenChange(false);
    } catch (err) {
      // A duplicate name comes back as a 409 whose message names the clash.
      // Showing that instead of a generic failure is the difference between
      // "try again" and "this person is already in the library".
      toast.error(t.bookAuthors.form.saveFailedToast, {
        description: err instanceof ApiError ? err.message : t.movies.pleaseTryAgain,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {author ? t.bookAuthors.form.editTitle : t.bookAuthors.form.createTitle}
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="book-author-name">{t.bookAuthors.form.name}</Label>
          <Input
            id="book-author-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.bookAuthors.form.namePlaceholder}
          />
        </div>

        {/* A newly picked file previews from its object URL; with none picked,
            an existing author still shows the portrait already on file. */}
        <FileUploadField
          label={t.bookAuthors.form.photo}
          hint={t.bookAuthors.form.photoHint}
          accept="image/*"
          variant="image"
          aspect="poster"
          file={photoFile}
          previewUrl={photoPreview ?? author?.imageUrl ?? undefined}
          onChange={setPhotoFile}
          disabled={saving}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="book-author-bio">{t.bookAuthors.form.bio}</Label>
          <Textarea
            id="book-author-bio"
            rows={4}
            maxLength={BIO_MAX_LENGTH}
            value={bio}
            disabled={saving}
            placeholder={t.bookAuthors.form.bioPlaceholder}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleSave} disabled={saving || !trimmedName}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {author ? t.common.save : t.common.add}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * One dialog for both create and edit — `author` decides which. Remounted per
 * target via `key`, so the fields always start from the row being opened
 * instead of whatever the previous open left behind.
 */
export function BookAuthorFormDialog({
  open,
  onOpenChange,
  author,
  onSaved,
}: BookAuthorFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <BookAuthorForm
            key={author?.id ?? "new"}
            author={author}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
