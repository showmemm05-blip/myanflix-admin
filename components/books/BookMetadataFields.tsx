"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/movies/FileUploadField";
import { BookAuthorPicker } from "@/components/book-authors/BookAuthorPicker";
import { useLanguage } from "@/lib/context/language-context";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { cn } from "@/lib/utils";
import type { BookCategory } from "@/types/book";
import type { BookAuthorRef } from "@/types/bookAuthor";

export interface BookMetadataValues {
  title: string;
  /** The credited author's ref, or null while none is picked yet. */
  author: BookAuthorRef | null;
  description: string;
  categoryIds: string[];
}

interface BookMetadataFieldsProps {
  values: BookMetadataValues;
  onChange: (patch: Partial<BookMetadataValues>) => void;
  /** The books' OWN shelves — never the movie categories. */
  categories: BookCategory[] | null;
  /** The newly picked cover, if the admin chose one this session. */
  coverFile: File | null;
  onCoverChange: (file: File | null) => void;
  /** Already-saved cover, shown until a new file replaces it. */
  existingCoverUrl?: string | null;
  disabled?: boolean;
}

/**
 * The metadata every book has, whichever way it was created — shared by the
 * create flow and the edit dialog so the two can never drift apart. Type,
 * status and the type-specific content (chapters / PDF) live with their own
 * workflows, not here.
 */
export function BookMetadataFields({
  values,
  onChange,
  categories,
  coverFile,
  onCoverChange,
  existingCoverUrl,
  disabled = false,
}: BookMetadataFieldsProps) {
  const { t } = useLanguage();
  const coverPreview = useObjectUrl(coverFile);

  const toggleCategory = (id: string) => {
    onChange({
      categoryIds: values.categoryIds.includes(id)
        ? values.categoryIds.filter((c) => c !== id)
        : [...values.categoryIds, id],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="book-title">{t.books.form.title}</Label>
        <Input
          id="book-title"
          value={values.title}
          disabled={disabled}
          placeholder={t.books.form.titlePlaceholder}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      {/* A managed author, never free text: the picker hands back the row's
          ref and the backend copies its name into the book's display string. */}
      <BookAuthorPicker
        value={values.author}
        onChange={(author) => onChange({ author })}
        disabled={disabled}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="book-description">{t.books.form.description}</Label>
        <Textarea
          id="book-description"
          rows={4}
          value={values.description}
          disabled={disabled}
          placeholder={t.books.form.descriptionPlaceholder}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t.books.form.categories}</Label>
        {categories && categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {/* The same chip as the movie category picker, and deliberately
                NOT a Badge: this admin's `default` and `outline` badges differ
                only by a 2% background step (--secondary 0.265 over the
                dialog's --popover 0.245) and carry the identical border, so a
                picked category was indistinguishable from an unpicked one.
                Selection has to be unmistakable — it is the only thing this
                control says. */}
            {categories.map((c) => {
              const active = values.categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => toggleCategory(c.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary/50",
                  )}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t.books.form.noCategories}
          </p>
        )}
      </div>

      <FileUploadField
        label={t.books.form.cover}
        hint={t.books.form.coverHint}
        accept="image/*"
        variant="image"
        aspect="poster"
        file={coverFile}
        previewUrl={coverPreview ?? existingCoverUrl ?? null}
        disabled={disabled}
        onChange={onCoverChange}
      />
    </div>
  );
}
