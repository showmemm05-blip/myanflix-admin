"use client";

import { useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequireRole } from "@/components/shared/RequireRole";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { movieService } from "@/services/api/movieService";
import type { MovieCategory } from "@/types/movie";
import { toast } from "sonner";

export default function CategoriesPage() {
  const { role } = useRole();
  const canManage = role !== "USER";

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
        toast.success("Category updated");
      } else {
        await movieService.createCategory(nameInput.trim(), descriptionInput.trim() || undefined);
        toast.success("Category created");
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await movieService.deleteCategory(deleteTarget.id);
      toast.success("Category deleted");
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN"]}
      title="Categories"
      description="Organize movies into browsable genres."
    >
      {error ? (
        <div>
          <PageHeader title="Categories" description="Organize movies into browsable genres." />
          <ErrorState description="We couldn't load categories." onRetry={refetch} />
        </div>
      ) : (
    <div>
      <PageHeader
        title="Categories"
        description="Organize movies into browsable genres."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add Category
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Create a category to help organize the catalog."
          action={
            canManage && (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add Category
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="glass-card group relative overflow-hidden border-white/[0.08] p-4"
            >
              {canManage && (
                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" />}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(category)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(category)}>
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
              <p className="mt-3 text-xs text-muted-foreground">{category.movieCount} movies</p>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Sci-Fi"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !nameInput.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this category?"
        description={`"${deleteTarget?.name}" will be removed. Movies in this category won't be deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
      )}
    </RequireRole>
  );
}
