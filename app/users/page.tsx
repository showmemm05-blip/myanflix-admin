"use client";

import { useState } from "react";
import { Users as UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequireRole } from "@/components/shared/RequireRole";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { getUserColumns } from "@/components/users/columns";
import { EditRoleDialog } from "@/components/users/EditRoleDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { userService } from "@/services/api/userService";
import type { AppUser } from "@/types/user";
import { toast } from "sonner";

export default function UsersPage() {
  const { data, isLoading, error, refetch } = useAsyncData(
    () => userService.getUsers({ limit: 100 }),
    []
  );
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const activeUsers = users ?? data?.items ?? [];

  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AppUser | null>(null);
  const [suspending, setSuspending] = useState(false);

  const handleToggleSuspend = async () => {
    if (!suspendTarget) return;
    const nextStatus = suspendTarget.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setSuspending(true);
    await userService.updateUserStatus(suspendTarget.id, nextStatus);
    setUsers(activeUsers.map((u) => (u.id === suspendTarget.id ? { ...u, status: nextStatus } : u)));
    setSuspending(false);
    toast.success(nextStatus === "SUSPENDED" ? "User suspended" : "User reactivated", {
      description: `${suspendTarget.name}'s account is now ${nextStatus.toLowerCase()}.`,
    });
    setSuspendTarget(null);
  };

  const columns = getUserColumns({
    canManage: true,
    onEditRole: setEditUser,
    onToggleSuspend: setSuspendTarget,
  });

  return (
    <RequireRole allow={["SUPER_ADMIN"]} title="Users" description="Manage subscriber accounts.">
      {error ? (
        <div>
          <PageHeader title="Users" description="Manage subscriber accounts." />
          <ErrorState description="We couldn't load the user list." onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader title="Users" description="Manage subscriber accounts, roles and access." />

          {!isLoading && activeUsers.length === 0 ? (
            <EmptyState icon={UsersIcon} title="No users yet" description="New signups will appear here." />
          ) : (
            <DataTable
              columns={columns}
              data={activeUsers}
              isLoading={isLoading}
              searchKey="name"
              searchPlaceholder="Search users by name..."
            />
          )}

          <EditRoleDialog
            user={editUser}
            open={!!editUser}
            onOpenChange={(o) => !o && setEditUser(null)}
            onSaved={(updated) =>
              setUsers(activeUsers.map((u) => (u.id === updated.id ? updated : u)))
            }
          />

          <ConfirmDialog
            open={!!suspendTarget}
            onOpenChange={(o) => !o && setSuspendTarget(null)}
            title={suspendTarget?.status === "SUSPENDED" ? "Reactivate this user?" : "Suspend this user?"}
            description={
              suspendTarget?.status === "SUSPENDED"
                ? `${suspendTarget?.name} will regain access to their account.`
                : `${suspendTarget?.name} will lose access to their account until reactivated.`
            }
            confirmLabel={suspendTarget?.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
            variant={suspendTarget?.status === "SUSPENDED" ? "default" : "destructive"}
            loading={suspending}
            onConfirm={handleToggleSuspend}
          />
        </div>
      )}
    </RequireRole>
  );
}
