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
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    setError(null);
    setSaving(true);
    try {
      await staffService.resetPassword(staff.id, newPassword);
      toast.success("Password reset", { description: `${staff.username}'s password has been changed.` });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reset password</DialogTitle>
        <DialogDescription>Set a new password for {staff.username}.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-staff-password">New password</Label>
          <Input
            id="reset-staff-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleReset} disabled={saving || newPassword.length < 8}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Reset password
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
