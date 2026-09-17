"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  BOOK_STATUS_TONE,
  getBookStatusLabel,
  getBookTypeLabel,
} from "@/components/books/columns";
import {
  BookMetadataFields,
  type BookMetadataValues,
} from "@/components/books/BookMetadataFields";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { languageLabel } from "@/lib/constants/book-options";
import { bookService } from "@/services/api/bookService";
import { bookCategoryService } from "@/services/api/bookCategoryService";
import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import type { Book } from "@/types/book";
import { toast } from "sonner";

function EditBookForm({
  book,
  onOpenChange,
  onSaved,
}: {
  book: Book;
  onOpenChange: (open: boolean) => void;
  onSaved: (book: Book) => void;
}) {
  const { t } = useLanguage();

  const [values, setValues] = useState<BookMetadataValues>({
    title: book.title,
    author: book.authorRef,
    description: book.description,
    categoryIds: book.categories.map((c) => c.id),
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // The books' own taxonomy — the movie categories are a different shelf.
  const { data: categories } = useAsyncData(
    bookCategoryService.getCategories,
    [],
  );

  const handleSave = async () => {
    if (!values.title.trim() || !values.author || !values.description.trim()) {
      toast.error(t.books.form.missingFieldsToast);
      return;
    }
    setSaving(true);
    try {
      const coverUrl = coverFile
        ? await uploadService.uploadImage(coverFile, "book").then((r) => r.url)
        : book.coverUrl ?? undefined;

      const updated = await bookService.updateBook(book.id, {
        title: values.title,
        authorId: values.author.id,
        description: values.description,
        categoryIds: values.categoryIds,
        coverUrl,
      });
      onSaved(updated);
      toast.success(t.books.manage.savedToast);
      onOpenChange(false);
    } catch (err) {
      toast.error(t.books.manage.saveFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Title, author, cover and categories are the WORK — they are shared by
   * every language, which is why they are edited here and nowhere else.
   *
   * Publishing is deliberately absent: a book has no single status any more,
   * so going live is always about one language and belongs where the
   * languages are visible — the tabs in a book's workspace, or the publish
   * queue. This dialog has no language context to publish from.
   */
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.books.actions.edit}</DialogTitle>
        <DialogDescription>{book.title}</DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-2">
          {book.editions.map((edition) => (
            <StatusBadge
              key={edition.id}
              label={`${languageLabel(edition.language)} · ${getBookStatusLabel(t, edition.status)}`}
              tone={BOOK_STATUS_TONE[edition.status]}
            />
          ))}
          <span className="text-xs text-muted-foreground">
            {getBookTypeLabel(t, book.type)}
          </span>
        </div>

        <BookMetadataFields
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          categories={categories}
          coverFile={coverFile}
          onCoverChange={setCoverFile}
          existingCoverUrl={book.coverUrl}
          disabled={saving}
        />
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t.common.cancel}
        </Button>
        <Button disabled={saving} onClick={handleSave}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.books.manage.save}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditBookDialog({
  book,
  open,
  onOpenChange,
  onSaved,
}: {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (book: Book) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {book && (
          <EditBookForm
            key={book.id}
            book={book}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
