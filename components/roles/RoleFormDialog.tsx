"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/context/language-context";
import type { AppRole } from "@/types/role";

const NAME_MIN = 2;
const NAME_MAX = 48;
const DESCRIPTION_MAX = 200;

/**
 * The fields live in an inner component that is mounted only while the
 * dialog is open and keyed by the role being edited — the same pattern
 * EditStaffDialog uses, so the form seeds itself from props on mount and
 * never has to sync state out of an effect.
 */
function RoleForm({
  role,
  saving,
  onOpenChange,
  onSubmit,
}: {
  role: AppRole | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { name: string; description: string }) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");

  const trimmed = name.trim();
  const valid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;
  const isRename = role !== null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isRename ? t.roles.rename.title : t.roles.create.title}</DialogTitle>
        <DialogDescription>
          {isRename ? t.roles.rename.description : t.roles.create.description}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role-name">{t.roles.create.nameLabel}</Label>
          <Input
            id="role-name"
            autoComplete="off"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.roles.create.namePlaceholder}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role-description">{t.roles.create.descriptionLabel}</Label>
          <Textarea
            id="role-description"
            value={description}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.roles.create.descriptionPlaceholder}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
          {t.common.cancel}
        </Button>
        <Button
          disabled={saving || !valid}
          onClick={() => onSubmit({ name: trimmed, description: description.trim() })}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isRename ? t.roles.rename.submit : t.roles.create.submit}
        </Button>
      </DialogFooter>
    </>
  );
}

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null creates a role; a role renames/re-describes that one. */
  role: AppRole | null;
  saving: boolean;
  onSubmit: (values: { name: string; description: string }) => void;
}

/**
 * Create and rename share one form because the backend takes the same two
 * fields for both — only the key differs, and that is always derived
 * server-side and never editable.
 */
export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  saving,
  onSubmit,
}: RoleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <RoleForm
            key={role?.id ?? "new"}
            role={role}
            saving={saving}
            onOpenChange={onOpenChange}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
