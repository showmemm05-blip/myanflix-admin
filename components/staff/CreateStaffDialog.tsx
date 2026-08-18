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

function CreateStaffForm({
  onOpenChange,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  onCreated: (staff: StaffMember) => void;
}) {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("CONTENT_UPLOADER");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ROLE_ITEMS: Record<StaffRole, string> = {
    SUPER_ADMIN: t.staff.roleOptions.superAdmin,
    ADMIN: t.staff.roleOptions.admin,
    CONTENT_UPLOADER: t.staff.roleOptions.contentUploader,
  };

  const handleCreate = async () => {
    setError(null);
    setSaving(true);
    try {
      const staff = await staffService.createStaff(username, password, role);
      onCreated(staff);
      toast.success(t.staff.createDialog.createdToast, {
        description: t.staff.createDialog.createdDescription(username),
      });
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
        <DialogTitle>{t.staff.createDialog.title}</DialogTitle>
        <DialogDescription>{t.staff.createDialog.description}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="create-staff-username">{t.staff.createDialog.usernameLabel}</Label>
          <Input
            id="create-staff-username"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t.staff.createDialog.usernamePlaceholder}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="create-staff-password">{t.staff.createDialog.passwordLabel}</Label>
          <Input
            id="create-staff-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.staff.createDialog.passwordPlaceholder}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t.staff.createDialog.roleLabel}</Label>
          <Select items={ROLE_ITEMS} value={role} onValueChange={(v) => v && setRole(v as StaffRole)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUPER_ADMIN">{t.staff.roleOptions.superAdmin}</SelectItem>
              <SelectItem value="ADMIN">{t.staff.roleOptions.admin}</SelectItem>
              <SelectItem value="CONTENT_UPLOADER">{t.staff.roleOptions.contentUploader}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleCreate} disabled={saving || username.length < 3 || password.length < 8}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.staff.createDialog.createAccount}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CreateStaffDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (staff: StaffMember) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <CreateStaffForm key={open ? "open" : "closed"} onOpenChange={onOpenChange} onCreated={onCreated} />
        )}
      </DialogContent>
    </Dialog>
  );
}
