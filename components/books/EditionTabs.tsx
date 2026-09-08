"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BOOK_STATUS_TONE, getBookStatusLabel } from "./columns";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { bookService } from "@/services/api/bookService";
import { ApiError } from "@/services/api/apiClient";
import {
  availableLanguages,
  languageFullLabel,
  languageLabel,
} from "@/lib/constants/book-options";
import { cn } from "@/lib/utils";
import type { BookEdition } from "@/types/book";
import { toast } from "sonner";

/**
 * The language switcher for a book's workspace.
 *
 * Books are multi-language and every piece of content belongs to exactly one
 * language, so this is not a filter — it selects which edition the whole
 * screen below is editing. Tabs rather than a dropdown because the set is
 * small and an admin needs to see at a glance which languages exist and
 * which of them are live.
 */
export function EditionTabs({
  bookId,
  editions,
  selectedId,
  onSelect,
  onChanged,
}: {
  bookId: string;
  editions: BookEdition[];
  selectedId: string | null;
  onSelect: (edition: BookEdition) => void;
  /** Called after a language is added or removed, so the page can refetch. */
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const { can } = useRole();
  const canEdit = can("BOOKS.EDIT");
  const canDelete = can("BOOKS.DELETE");

  const [addOpen, setAddOpen] = useState(false);
  const [newLanguage, setNewLanguage] = useState("");
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<BookEdition | null>(null);
  const [removing, setRemoving] = useState(false);

  const remaining = availableLanguages(editions.map((e) => e.language));

  const handleAdd = async () => {
    if (!newLanguage) return;
    setAdding(true);
    try {
      const created = await bookService.addEdition(bookId, newLanguage);
      toast.success(t.books.editions.addedToast);
      setAddOpen(false);
      setNewLanguage("");
      onChanged();
      onSelect(created);
    } catch (err) {
      toast.error(t.books.editions.addFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await bookService.deleteEdition(bookId, removeTarget.id);
      toast.success(t.books.editions.removedToast);
      // Move off the language that no longer exists before the refetch, so
      // the screen never renders against a dead edition id.
      const next = editions.find((e) => e.id !== removeTarget.id);
      if (next && removeTarget.id === selectedId) onSelect(next);
      setRemoveTarget(null);
      onChanged();
    } catch (err) {
      toast.error(t.books.editions.removeFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <p className="text-kicker">{t.books.editions.title}</p>
        <p className="text-xs text-muted-foreground">
          {t.books.editions.countLabel(editions.length)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {editions.map((edition) => {
          const selected = edition.id === selectedId;
          return (
            <button
              key={edition.id}
              type="button"
              onClick={() => onSelect(edition)}
              aria-pressed={selected}
              className={cn(
                "focus-ring flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-sm transition-colors",
                selected
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-white/8 text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <span className="font-medium">
                {languageLabel(edition.language)}
              </span>
              <StatusBadge
                label={getBookStatusLabel(t, edition.status)}
                tone={BOOK_STATUS_TONE[edition.status]}
              />
            </button>
          );
        })}

        {canEdit && remaining.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            className="rounded-xl"
          >
            <Plus className="size-4" />
            {t.books.editions.add}
          </Button>
        )}

        {/* Removing a language is destructive and rare, so it sits apart from
            the tabs rather than as an x on each one — a stray click there
            would take a whole translation with it. */}
        {canDelete && editions.length > 1 && selectedId && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-danger hover:text-danger"
            onClick={() =>
              setRemoveTarget(
                editions.find((e) => e.id === selectedId) ?? null,
              )
            }
          >
            <Trash2 className="size-4" />
            {t.common.delete}
          </Button>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.books.editions.addTitle}</DialogTitle>
            <DialogDescription>
              {t.books.editions.addDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="book-language">{t.books.editions.pick}</Label>
            {/* base-ui's Select can emit null (a clear), so the bare state
                setter is not a valid handler here. */}
            <Select
              value={newLanguage}
              onValueChange={(value) => setNewLanguage(value ?? "")}
            >
              <SelectTrigger id="book-language">
                <SelectValue placeholder={t.books.editions.pick} />
              </SelectTrigger>
              <SelectContent>
                {remaining.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {languageFullLabel(option.code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button disabled={!newLanguage || adding} onClick={handleAdd}>
              {adding && <Loader2 className="size-4 animate-spin" />}
              {t.books.editions.add}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={t.books.editions.removeTitle}
        description={
          removeTarget
            ? t.books.editions.removeDescription(
                languageLabel(removeTarget.language),
              )
            : ""
        }
        confirmLabel={t.common.delete}
        variant="destructive"
        loading={removing}
        onConfirm={handleRemove}
      />
    </div>
  );
}
