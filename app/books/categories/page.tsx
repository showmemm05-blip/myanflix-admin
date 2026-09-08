"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { bookCategoryService } from "@/services/api/bookCategoryService";
import { ApiError } from "@/services/api/apiClient";
import type { BookCategory } from "@/types/book";
import { toast } from "sonner";

/**
 * The books' OWN shelves. Structurally the twin of the movie categories
 * screen, but deliberately a separate page against a separate taxonomy: a
 * genre invented for a manga has no business showing up in the movie picker.
 */
export default function BookCategoriesPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canCreate = can("BOOKS.CREATE");
  const canEdit = can("BOOKS.EDIT");
  const canDelete = can("BOOKS.DELETE");

  const { data, isLoading, error, refetch } = useAsyncData(
    bookCategoryService.getCategories,
    [],
  );
  const categories = data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BookCategory | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setNameInput("");
    setDescriptionInput("");
    setFormOpen(true);
  };

  const openEdit = (category: BookCategory) => {
    setEditing(category);
    setNameInput(category.name);
    setDescriptionInput(category.description ?? "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      const values = {
        name: nameInput.trim(),
        description: descriptionInput.trim() || undefined,
      };
      if (editing) {
        await bookCategoryService.updateCategory(editing.id, values);
        toast.success(t.books.categories.updatedToast);
      } else {
        await bookCategoryService.createCategory(values);
        toast.success(t.books.categories.createdToast);
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(t.books.categories.saveFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await bookCategoryService.deleteCategory(deleteTarget.id);
      toast.success(t.books.categories.deletedToast);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(t.books.categories.deleteFailedToast, {
        description:
          err instanceof ApiError ? err.message : t.books.pleaseTryAgain,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RequirePermission
      permission="BOOKS.VIEW"
      title={t.books.categories.title}
      description={t.books.categories.description}
    >
      {error ? (
        <div>
          <PageHeader
            title={t.books.categories.title}
            description={t.books.categories.description}
          />
          <ErrorState description={t.books.categories.loadError} onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title={t.books.categories.title}
            description={t.books.categories.description}
            actions={
              canCreate && (
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  {t.books.categories.add}
                </Button>
              )
            }
          />

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <EmptyState
              icon={Tags}
              title={t.books.categories.emptyTitle}
              description={t.books.categories.emptyDescription}
              action={
                canCreate && (
                  <Button onClick={openCreate}>
                    <Plus className="size-4" />
                    {t.books.categories.add}
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <Card
                  key={category.id}
                  className="glass-card group relative overflow-hidden p-4"
                >
                  {(canEdit || canDelete) && (
                    <RowActions className="absolute right-2 top-2">
                      {canEdit && (
                        <RowActionButton
                          icon={Pencil}
                          label={t.common.edit}
                          onClick={() => openEdit(category)}
                        />
                      )}
                      {canDelete && (
                        <RowActionButton
                          icon={Trash2}
                          label={t.common.delete}
                          destructive
                          onClick={() => setDeleteTarget(category)}
                        />
                      )}
                    </RowActions>
                  )}
                  <div className="flex items-center gap-2">
                    <Tags className="size-4 text-muted-foreground" />
                    <p className="font-semibold">{category.name}</p>
                  </div>
                  {category.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs tabular-nums text-muted-foreground">
                    {t.books.categories.bookCount(category.bookCount)}
                  </p>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing
                    ? t.books.categories.editTitle
                    : t.books.categories.addTitle}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="book-category-name">
                    {t.books.categories.name}
                  </Label>
                  <Input
                    id="book-category-name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder={t.books.categories.namePlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="book-category-description">
                    {t.books.categories.descriptionLabel}
                  </Label>
                  <Textarea
                    id="book-category-description"
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    placeholder={t.books.categories.descriptionPlaceholder}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  {t.common.cancel}
                </Button>
                <Button onClick={handleSave} disabled={saving || !nameInput.trim()}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {editing ? t.common.save : t.common.add}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title={t.books.categories.deleteTitle}
            description={
              deleteTarget
                ? t.books.categories.deleteDescription(deleteTarget.name)
                : ""
            }
            confirmLabel={t.common.delete}
            variant="destructive"
            loading={deleting}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </RequirePermission>
  );
}
