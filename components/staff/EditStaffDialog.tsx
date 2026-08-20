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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/context/language-context";
import { userLabel } from "@/lib/user-label";
import { ApiError } from "@/services/api/apiClient";
import { staffService } from "@/services/api/staffService";
import type { AppRole } from "@/types/role";
import type { StaffMember, StaffRole } from "@/types/staff";
import { toast } from "sonner";

function EditStaffForm({
  staff,
  isSelf,
  assignableRoles,
  rolesUnavailable,
  onOpenChange,
  onSaved,
}: {
  staff: StaffMember;
  isSelf: boolean;
  /** Every AppRole a staff account may hold — end-user roles are excluded. */
  assignableRoles: AppRole[];
  /** True when the roles list couldn't be read (no ROLES.VIEW, or it failed). */
  rolesUnavailable: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (staff: StaffMember) => void;
}) {
  const { t } = useLanguage();
  const [username, setUsername] = useState(staff.username);
  const [role, setRole] = useState<StaffRole>(staff.role);
  // The account may predate RBAC and still be on the enum fallback — in that
  // case the built-in role whose key matches is what it effectively has.
  const [appRoleId, setAppRoleId] = useState(
    staff.appRoleId ?? assignableRoles.find((r) => r.key === staff.role)?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ROLE_ITEMS: Record<StaffRole, string> = {
    SUPER_ADMIN: t.staff.roleOptions.superAdmin,
    ADMIN: t.staff.roleOptions.admin,
    CONTENT_UPLOADER: t.staff.roleOptions.contentUploader,
  };
  const APP_ROLE_ITEMS: Record<string, string> = Object.fromEntries(
    assignableRoles.map((r) => [r.id, r.name]),
  );

  const initialAppRoleId =
    staff.appRoleId ?? assignableRoles.find((r) => r.key === staff.role)?.id ?? "";
  const dirty =
    username !== staff.username ||
    (rolesUnavailable ? role !== staff.role : appRoleId !== initialAppRoleId);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const updated = await staffService.updateStaff(staff.id, {
        ...(username !== staff.username && { username }),
        ...(rolesUnavailable
          ? role !== staff.role && { role }
          : appRoleId !== initialAppRoleId && { appRoleId }),
      });
      onSaved(updated);
      toast.success(t.staff.editDialog.updatedToast);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.login.genericError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.staff.editDialog.title}</DialogTitle>
        <DialogDescription>{t.staff.editDialog.descriptionFor(userLabel(staff))}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-staff-username">{t.staff.editDialog.usernameLabel}</Label>
          <Input
            id="edit-staff-username"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t.staff.editDialog.roleLabel}</Label>
          {rolesUnavailable ? (
            // Falls back to the three built-in enum roles when the RBAC role
            // list is unreadable, so this dialog never loses its role field.
            <Select
              items={ROLE_ITEMS}
              value={role}
              onValueChange={(v) => v && setRole(v as StaffRole)}
              disabled={isSelf}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">{t.staff.roleOptions.superAdmin}</SelectItem>
                <SelectItem value="ADMIN">{t.staff.roleOptions.admin}</SelectItem>
                <SelectItem value="CONTENT_UPLOADER">{t.staff.roleOptions.contentUploader}</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select
              items={APP_ROLE_ITEMS}
              value={appRoleId}
              onValueChange={(v) => v && setAppRoleId(v as string)}
              disabled={isSelf}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {rolesUnavailable && (
            <p className="text-xs text-muted-foreground">{t.staff.editDialog.rolesLoadFailed}</p>
          )}
          {isSelf && <p className="text-xs text-muted-foreground">{t.staff.editDialog.selfRoleNote}</p>}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleSave} disabled={saving || !dirty || username.length < 3}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.staff.editDialog.saveChanges}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditStaffDialog({
  staff,
  currentUserId,
  assignableRoles,
  open,
  onOpenChange,
  onSaved,
}: {
  staff: StaffMember | null;
  currentUserId: string;
  /** Null when the roles list is unreadable — the dialog then shows the enum roles. */
  assignableRoles: AppRole[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (staff: StaffMember) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {staff && (
          <EditStaffForm
            key={staff.id}
            staff={staff}
            isSelf={staff.id === currentUserId}
            assignableRoles={assignableRoles ?? []}
            rolesUnavailable={assignableRoles === null || assignableRoles.length === 0}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
