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
import { ApiError } from "@/services/api/apiClient";
import { staffService } from "@/services/api/staffService";
import type { StaffMember, StaffRole } from "@/types/staff";
import { toast } from "sonner";

function EditStaffForm({
  staff,
  isSelf,
  onOpenChange,
  onSaved,
}: {
  staff: StaffMember;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (staff: StaffMember) => void;
}) {
  const { t } = useLanguage();
  const [username, setUsername] = useState(staff.username);
  const [role, setRole] = useState<StaffRole>(staff.role);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ROLE_ITEMS: Record<StaffRole, string> = {
    SUPER_ADMIN: t.staff.roleOptions.superAdmin,
    ADMIN: t.staff.roleOptions.admin,
    CONTENT_UPLOADER: t.staff.roleOptions.contentUploader,
  };

  const dirty = username !== staff.username || role !== staff.role;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const updated = await staffService.updateStaff(staff.id, {
        ...(username !== staff.username && { username }),
        ...(role !== staff.role && { role }),
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
        <DialogDescription>{t.staff.editDialog.descriptionFor(staff.username)}</DialogDescription>
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
  open,
  onOpenChange,
  onSaved,
}: {
  staff: StaffMember | null;
  currentUserId: string;
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
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
