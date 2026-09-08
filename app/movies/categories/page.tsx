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
import { movieService } from "@/services/api/movieService";
import type { MovieCategory } from "@/types/movie";
import { toast } from "sonner";

export default function CategoriesPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canCreate = can("CATEGORIES.CREATE");
  const canEdit = can("CATEGORIES.EDIT");
  const canDelete = can("CATEGORIES.DELETE");

  const { data, isLoading, error, refetch } = useAsyncData(movieService.getCategories, []);
  const categories = data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MovieCategory | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MovieCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setNameInput("");
    setDescriptionInput("");
    setFormOpen(true);
  };

  const openEdit = (category: MovieCategory) => {
    setEditing(category);
    setNameInput(category.name);
    setDescriptionInput(category.description ?? "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await movieService.updateCategory(editing.id, {
          name: nameInput.trim(),
          description: descriptionInput.trim() || undefined,
        });
        toast.success(t.movies.categories.updatedToast);
      } else {
        await movieService.createCategory(nameInput.trim(), descriptionInput.trim() || undefined);
        toast.success(t.movies.categories.createdToast);
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.somethingWentWrong);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await movieService.deleteCategory(deleteTarget.id);
      toast.success(t.movies.categories.deletedToast);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.somethingWentWrong);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RequirePermission
      permission="CATEGORIES.VIEW"
      title={t.movies.categories.title}
      description={t.movies.categories.description}
    >
      {error ? (
        <div>
          <PageHeader title={t.movies.categories.title} description={t.movies.categories.description} />
          <ErrorState description={t.movies.categories.loadError} onRetry={refetch} />
        </div>
      ) : (
    <div>
      <PageHeader
        title={t.movies.categories.title}
        description={t.movies.categories.description}
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t.movies.categories.addCategory}
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
          title={t.movies.categories.emptyTitle}
          description={t.movies.categories.emptyDescription}
          action={
            canCreate && (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                {t.movies.categories.addCategory}
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
                    <RowActionButton icon={Pencil} label={t.common.edit} onClick={() => openEdit(category)} />
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
              <p className="mt-3 text-xs tabular-nums text-muted-foreground">{t.movies.categories.movieCount(category.movieCount)}</p>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.movies.categories.editDialogTitle : t.movies.categories.addDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category-name">{t.movies.categories.name}</Label>
              <Input
                id="category-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={t.movies.categories.namePlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category-description">{t.movies.categories.descriptionLabel}</Label>
              <Textarea
                id="category-description"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder={t.movies.categories.descriptionPlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving || !nameInput.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? t.common.save : t.movies.categories.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t.movies.categories.deleteTitle}
        description={deleteTarget ? t.movies.categories.deleteDescription(deleteTarget.name) : ""}
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
