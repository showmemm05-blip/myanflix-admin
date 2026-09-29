"use client";

import { useEffect, useState } from "react";
import { Users as UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { getUserColumns } from "@/components/users/columns";
import { EditRoleDialog } from "@/components/users/EditRoleDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { userService } from "@/services/api/userService";
import { ApiError } from "@/services/api/apiClient";
import { isClosedAccountError } from "@/lib/account-status";
import type { AppUser } from "@/types/user";
import { toast } from "sonner";

/** Rows per server page (H-24): the user base is paged on the server, not capped at one page. */
const PAGE_LIMIT = 25;

export default function UsersPage() {
  const { t } = useLanguage();
  const { can } = useRole();
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AppUser[] | null>(null);
  // Search runs on the SERVER: the endpoint matches username, display name and
  // phone, so an account stays findable by its login identity or its number
  // even once the rendered label is a self-chosen display name. A client-side
  // filter over the loaded page could only ever match the one shown column.
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = search.trim().slice(0, 100);
      if (next === appliedSearch) return;
      // Drop the action-local override so the refetched matches aren't
      // masked by the previous term's list, and start from the first page.
      setUsers(null);
      setPage(1);
      setAppliedSearch(next);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () => userService.getUsers({ page, limit: PAGE_LIMIT, search: appliedSearch || undefined }),
    [appliedSearch, page]
  );
  const activeUsers = users ?? data?.items ?? [];
  const total = data?.total ?? 0;

  const handlePageChange = (next: number) => {
    setUsers(null);
    setPage(next);
  };

  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AppUser | null>(null);
  const [suspending, setSuspending] = useState(false);

  const reloadList = () => {
    setUsers(null);
    refetch();
  };

  const handleToggleSuspend = async () => {
    if (!suspendTarget) return;
    const nextStatus = suspendTarget.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setSuspending(true);
    try {
      await userService.updateUserStatus(suspendTarget.id, nextStatus);
      setUsers(activeUsers.map((u) => (u.id === suspendTarget.id ? { ...u, status: nextStatus } : u)));
      toast.success(nextStatus === "SUSPENDED" ? t.users.suspendedToast : t.users.reactivatedToast, {
        description:
          nextStatus === "SUSPENDED"
            ? t.users.suspendedDescription(suspendTarget.name)
            : t.users.reactivatedDescription(suspendTarget.name),
      });
      setSuspendTarget(null);
    } catch (err) {
      if (isClosedAccountError(err)) {
        // The row was stale: the owner closed the account after this page
        // loaded. Retrying can never succeed, so reload the list instead.
        toast.error(t.users.closedAccount);
        setSuspendTarget(null);
        reloadList();
      } else {
        toast.error(err instanceof ApiError ? err.message : t.login.genericError);
      }
    } finally {
      setSuspending(false);
    }
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
          {!isLoading && total === 0 && !search ? (
            <EmptyState
              icon={UsersIcon}
              title={t.users.page.emptyTitle}
              description={t.users.page.emptyDescription}
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={activeUsers}
                isLoading={isLoading}
                pageSize={PAGE_LIMIT}
                manualPagination
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder={t.users.page.searchPlaceholder}
              />
              {!isLoading && (
                <ServerPagination page={page} pageSize={PAGE_LIMIT} total={total} onPageChange={handlePageChange} />
              )}
            </>
          )}

          <EditRoleDialog
            user={editUser}
            open={!!editUser}
            onOpenChange={(o) => !o && setEditUser(null)}
            onSaved={(updated) =>
              setUsers(activeUsers.map((u) => (u.id === updated.id ? updated : u)))
            }
            onAccountClosed={reloadList}
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
