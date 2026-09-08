"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  FileText,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookMetadataFields,
  type BookMetadataValues,
} from "@/components/books/BookMetadataFields";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { bookService } from "@/services/api/bookService";
import { bookCategoryService } from "@/services/api/bookCategoryService";
import { uploadService } from "@/services/api/uploadService";
import { ApiError } from "@/services/api/apiClient";
import {
  BOOK_LANGUAGES,
  languageFullLabel,
} from "@/lib/constants/book-options";
import { cn } from "@/lib/utils";
import type { BookType } from "@/types/book";
import { toast } from "sonner";

/**
 * The choice card. Deliberately visual and side-by-side rather than a
 * dropdown: the two workflows diverge completely after this point and the
 * type can never be changed afterwards, so the decision deserves to look
 * like a decision.
 */
function TypeCard({
  icon: Icon,
  title,
  description,
  bullets,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: readonly string[];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="text-left">
      <Card
        className={cn(
          "h-full gap-4 p-6 transition-colors",
          selected
            ? "border-primary bg-primary/5"
            : "hover:border-muted-foreground/30",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex size-11 items-center justify-center rounded-lg",
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
          </div>
          {selected && (
            <div className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3.5" />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ul className="space-y-1.5">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {bullet}
            </li>
          ))}
        </ul>
      </Card>
    </button>
  );
}

export default function NewBookPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [type, setType] = useState<BookType | null>(null);
  const [values, setValues] = useState<BookMetadataValues>({
    title: "",
    author: null,
    description: "",
    categoryIds: [],
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  // Every book is born in exactly one language; the rest are added later
  // from its workspace. Burmese is the platform's primary language and so
  // the default, but a translation-first upload is a legitimate start too.
  const [language, setLanguage] = useState("my");
  const [creating, setCreating] = useState(false);

  // The books' own taxonomy — the movie categories are a different shelf.
  const { data: categories } = useAsyncData(
    bookCategoryService.getCategories,
    [],
  );

  const handleCreate = async () => {
    if (!type) return;
    if (!values.title.trim() || !values.author || !values.description.trim()) {
      toast.error(t.books.form.missingFieldsToast);
      return;
    }

    setCreating(true);
    try {
      const coverUrl = coverFile
        ? await uploadService.uploadImage(coverFile).then((r) => r.url)
        : undefined;

      const book = await bookService.createBook({
        title: values.title,
        authorId: values.author.id,
        description: values.description,
        categoryIds: values.categoryIds,
        coverUrl,
        type,
        language,
      });

      toast.success(t.books.createdToast);
      // Straight into the workspace both types now share: the chapter list is
      // where you write chapters AND where you upload each chapter's PDF.
      router.push(`/books/${book.id}/chapters`);
    } catch (err) {
      toast.error(t.books.createFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
      setCreating(false);
    }
  };

  return (
    <RequirePermission
      permission="BOOKS.CREATE"
      title={t.books.createBook}
      description={t.books.chooseType.description}
    >
      <div>
        <PageHeader
          title={t.books.createBook}
          description={t.books.chooseType.description}
          actions={
            <Button
              variant="ghost"
              render={<Link href="/books" />}
              nativeButton={false}
            >
              <ArrowLeft className="size-4" />
              {t.books.manage.backToBooks}
            </Button>
          }
        />

        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-medium">{t.books.chooseType.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TypeCard
                icon={BookOpen}
                title={t.books.chooseType.editorTitle}
                description={t.books.chooseType.editorDescription}
                bullets={t.books.chooseType.editorBullets}
                selected={type === "EDITOR"}
                onSelect={() => setType("EDITOR")}
              />
              <TypeCard
                icon={FileText}
                title={t.books.chooseType.pdfTitle}
                description={t.books.chooseType.pdfDescription}
                bullets={t.books.chooseType.pdfBullets}
                selected={type === "PDF"}
                onSelect={() => setType("PDF")}
              />
            </div>
          </div>

          {type && (
            <Card className="max-w-2xl gap-0 p-6">
              <BookMetadataFields
                values={values}
                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
                categories={categories}
                coverFile={coverFile}
                onCoverChange={setCoverFile}
                disabled={creating}
              />

              {/* Not metadata but the first edition: the chapters written or
                  the PDF uploaded next all belong to this language, and
                  publishing happens per language from here on. */}
              <div className="mt-4 flex flex-col gap-1.5">
                <Label htmlFor="book-language">{t.books.editions.pick}</Label>
                <Select
                  value={language}
                  onValueChange={(v) => {
                    // A book must be created in some language — the picker
                    // never clears back to nothing.
                    if (!v) return;
                    setLanguage(v);
                  }}
                >
                  <SelectTrigger id="book-language" className="w-full">
                    <SelectValue placeholder={t.books.editions.pick} />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOK_LANGUAGES.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {languageFullLabel(option.code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t.books.editions.description}
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <Button disabled={creating} onClick={handleCreate}>
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  {t.books.chooseType.choose}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </RequirePermission>
  );
}
