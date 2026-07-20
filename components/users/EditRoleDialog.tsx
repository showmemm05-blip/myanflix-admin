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
import { userService } from "@/services/api/userService";
import { ROLE_LABELS, type AppUser, type UserRole } from "@/types/user";
import { toast } from "sonner";

function EditRoleForm({
  user,
  onOpenChange,
  onSaved,
}: {
  user: AppUser;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: AppUser) => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updated = await userService.updateUserRole(user.id, role);
    setSaving(false);
    onSaved(updated);
    toast.success("Role updated", { description: `${user.name} is now ${ROLE_LABELS[role]}.` });
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit role</DialogTitle>
        <DialogDescription>Change permission level for {user.name}.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Current role: <RoleBadge role={user.role} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>New role</Label>
          <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="USER">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || role === user.role}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save role
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
}: {
  user: AppUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: AppUser) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {user && <EditRoleForm key={user.id} user={user} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}
