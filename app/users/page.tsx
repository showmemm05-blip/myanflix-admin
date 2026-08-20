"use client";

import { useEffect, useState } from "react";
import { Users as UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { getUserColumns } from "@/components/users/columns";
import { EditRoleDialog } from "@/components/users/EditRoleDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { userService } from "@/services/api/userService";
import type { AppUser } from "@/types/user";
import { toast } from "sonner";

export default function UsersPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  // Search runs on the SERVER: the endpoint matches username, display name and
  // phone, so an account stays findable by its login identity or its number
  // even once the rendered label is a self-chosen display name. A client-side
  // filter over the loaded page could only ever match the one shown column.
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () => userService.getUsers({ limit: 100, search: appliedSearch || undefined }),
    [appliedSearch]
  );
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const activeUsers = users ?? data?.items ?? [];

  const handleSearchChange = (value: string) => {
    // Drop the action-local override so the refetched matches aren't masked by
    // the previous term's list.
    setUsers(null);
    setSearch(value);
  };

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
    toast.success(nextStatus === "SUSPENDED" ? t.users.suspendedToast : t.users.reactivatedToast, {
      description:
        nextStatus === "SUSPENDED"
          ? t.users.suspendedDescription(suspendTarget.name)
          : t.users.reactivatedDescription(suspendTarget.name),
    });
    setSuspendTarget(null);
  };

  const columns = getUserColumns({
    t,
    canEditRole: can("USERS.EDIT"),
    canSuspend: can("USERS.SUSPEND"),
    onEditRole: setEditUser,
    onToggleSuspend: setSuspendTarget,
  });

  return (
    <RequirePermission permission="USERS.VIEW" title={t.users.page.title} description={t.users.page.descriptionShort}>
      {error ? (
        <div>
          <PageHeader title={t.users.page.title} description={t.users.page.descriptionShort} />
          <ErrorState description={t.users.page.loadError} onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader title={t.users.page.title} description={t.users.page.description} />

          {/* The full-page empty state only stands in for a genuinely empty
              list — with a search term active the table (and the very box
              being typed into) must stay mounted, showing its own no-results
              row instead. */}
          {!isLoading && activeUsers.length === 0 && !search ? (
            <EmptyState
              icon={UsersIcon}
              title={t.users.page.emptyTitle}
              description={t.users.page.emptyDescription}
            />
          ) : (
            <DataTable
              columns={columns}
              data={activeUsers}
              isLoading={isLoading}
              searchValue={search}
              onSearchChange={handleSearchChange}
              searchPlaceholder={t.users.page.searchPlaceholder}
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
            title={suspendTarget?.status === "SUSPENDED" ? t.users.reactivateTitle : t.users.suspendTitle}
            description={
              suspendTarget?.status === "SUSPENDED"
                ? t.users.reactivateDescription(suspendTarget?.name ?? "")
                : t.users.suspendDescription(suspendTarget?.name ?? "")
            }
            confirmLabel={suspendTarget?.status === "SUSPENDED" ? t.users.reactivate : t.users.suspend}
            variant={suspendTarget?.status === "SUSPENDED" ? "default" : "destructive"}
            loading={suspending}
            onConfirm={handleToggleSuspend}
          />
        </div>
      )}
    </RequirePermission>
  );
}
