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
import { useLanguage } from "@/lib/context/language-context";
import { ApiError } from "@/services/api/apiClient";
import { staffService } from "@/services/api/staffService";
import type { StaffMember } from "@/types/staff";
import { toast } from "sonner";

function ResetPasswordForm({
  staff,
  onOpenChange,
}: {
  staff: StaffMember;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    setError(null);
    setSaving(true);
    try {
      await staffService.resetPassword(staff.id, newPassword);
      toast.success(t.staff.resetPasswordDialog.resetToast, {
        description: t.staff.resetPasswordDialog.resetDescription(staff.username),
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
        <DialogTitle>{t.staff.resetPasswordDialog.title}</DialogTitle>
        <DialogDescription>{t.staff.resetPasswordDialog.descriptionFor(staff.username)}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-staff-password">{t.staff.resetPasswordDialog.newPasswordLabel}</Label>
          <Input
            id="reset-staff-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t.staff.resetPasswordDialog.passwordPlaceholder}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button onClick={handleReset} disabled={saving || newPassword.length < 8}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t.staff.resetPasswordDialog.resetPassword}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ResetPasswordDialog({
  staff,
  open,
  onOpenChange,
}: {
  staff: StaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {staff && <ResetPasswordForm key={staff.id} staff={staff} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}
