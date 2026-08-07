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

function CreateStaffForm({
  onOpenChange,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  onCreated: (staff: StaffMember) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("CONTENT_UPLOADER");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setSaving(true);
    try {
      const staff = await staffService.createStaff(username, password, role);
      onCreated(staff);
      toast.success("Staff account created", { description: `${username} can now sign in.` });
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
        <DialogTitle>Create staff account</DialogTitle>
        <DialogDescription>Grant dashboard access with a username and password.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="create-staff-username">Username</Label>
          <Input
            id="create-staff-username"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="jane.doe"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="create-staff-password">Password</Label>
          <Input
            id="create-staff-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Role</Label>
          <Select items={ROLE_ITEMS} value={role} onValueChange={(v) => v && setRole(v as StaffRole)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="CONTENT_UPLOADER">Content Uploader</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={saving || username.length < 3 || password.length < 8}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Create account
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
