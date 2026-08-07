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
import { ApiError } from "@/services/api/apiClient";
import { staffService } from "@/services/api/staffService";
import type { StaffMember, StaffRole } from "@/types/staff";
import { toast } from "sonner";

const ROLE_ITEMS: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  CONTENT_UPLOADER: "Content Uploader",
};

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
  const [username, setUsername] = useState(staff.username);
  const [role, setRole] = useState<StaffRole>(staff.role);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      toast.success("Staff account updated");
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
        <DialogTitle>Edit staff account</DialogTitle>
        <DialogDescription>Update the username or role for {staff.username}.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-staff-username">Username</Label>
          <Input
            id="edit-staff-username"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Role</Label>
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
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="CONTENT_UPLOADER">Content Uploader</SelectItem>
            </SelectContent>
          </Select>
          {isSelf && (
            <p className="text-xs text-muted-foreground">
              You cannot change your own role. Ask another Super Admin to do this.
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !dirty || username.length < 3}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save changes
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
