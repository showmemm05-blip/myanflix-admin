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
import { Label } from "@/components/ui/label";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/context/language-context";
import { isClosedAccountError } from "@/lib/account-status";
import { ApiError } from "@/services/api/apiClient";
import { userService } from "@/services/api/userService";
import type { AppUser, UserRole } from "@/types/user";
import { toast } from "sonner";

function EditRoleForm({
  user,
  onOpenChange,
  onSaved,
  onAccountClosed,
}: {
  user: AppUser;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: AppUser) => void;
  onAccountClosed?: () => void;
}) {
  const { t } = useLanguage();
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);

  const ROLE_OPTION_LABELS: Record<UserRole, string> = {
    SUPER_ADMIN: t.users.roleOptions.superAdmin,
    ADMIN: t.users.roleOptions.admin,
    USER: t.users.roleOptions.user,
    CONTENT_UPLOADER: t.users.roleOptions.contentUploader,
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await userService.updateUserRole(user.id, role);
      onSaved(updated);
      toast.success(t.users.editRoleDialog.updatedToast, {
        description: t.users.editRoleDialog.updatedDescription(user.name, ROLE_OPTION_LABELS[role]),
      });
      onOpenChange(false);
    } catch (err) {
      if (isClosedAccountError(err)) {
        // The owner closed the account after this view loaded. Retrying can
        // never succeed, so close and let the parent reload the account.
        toast.error(t.users.closedAccount);
        onOpenChange(false);
        onAccountClosed?.();
      } else {
        // The server's self/tier/lockout refusals (403/409) surface as sent.
        toast.error(err instanceof ApiError ? err.message : t.login.genericError);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.users.editRoleDialog.title}</DialogTitle>
        <DialogDescription>{t.users.editRoleDialog.descriptionFor(user.name)}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {t.users.editRoleDialog.currentRole} <RoleBadge role={user.role} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t.users.editRoleDialog.newRoleLabel}</Label>
          <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUPER_ADMIN">{t.users.roleOptions.superAdmin}</SelectItem>
              <SelectItem value="ADMIN">{t.users.roleOptions.admin}</SelectItem>
              <SelectItem value="USER">{t.users.roleOptions.user}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleSave} disabled={saving || role === user.role}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.users.editRoleDialog.saveRole}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditRoleDialog({
  user,
  open,
  onOpenChange,
  onSaved,
  onAccountClosed,
}: {
  user: AppUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: AppUser) => void;
  /** The save hit a CLOSED account (409): the caller's copy of it is stale. */
  onAccountClosed?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {user && (
          <EditRoleForm
            key={user.id}
            user={user}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
            onAccountClosed={onAccountClosed}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
