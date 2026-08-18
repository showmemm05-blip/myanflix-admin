"use client";

import { useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequireRole } from "@/components/shared/RequireRole";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/DataTable";
import { getStaffColumns } from "@/components/staff/columns";
import { CreateStaffDialog } from "@/components/staff/CreateStaffDialog";
import { EditStaffDialog } from "@/components/staff/EditStaffDialog";
import { ResetPasswordDialog } from "@/components/staff/ResetPasswordDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { staffService } from "@/services/api/staffService";
import { ApiError } from "@/services/api/apiClient";
import type { StaffMember } from "@/types/staff";
import { toast } from "sonner";

export default function StaffPage() {
  const { currentUser } = useRole();
  const { t } = useLanguage();
  const { data, isLoading, error, refetch } = useAsyncData(() => staffService.getStaff(), []);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const activeStaff = staff ?? data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [statusTarget, setStatusTarget] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setStatusSubmitting(true);
    try {
      const updated = await staffService.updateStatus(statusTarget.id, nextStatus);
      setStaff(activeStaff.map((s) => (s.id === updated.id ? updated : s)));
      toast.success(nextStatus === "SUSPENDED" ? t.staff.deactivatedToast : t.staff.activatedToast, {
        description:
          nextStatus === "SUSPENDED"
            ? t.staff.deactivatedDescription(statusTarget.username)
            : t.staff.activatedDescription(statusTarget.username),
      });
      setStatusTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.login.genericError);
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await staffService.deleteStaff(deleteTarget.id);
      setStaff(activeStaff.filter((s) => s.id !== deleteTarget.id));
      toast.success(t.staff.deletedToast, { description: t.staff.deletedDescription(deleteTarget.username) });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.login.genericError);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const columns = getStaffColumns({
    t,
    currentUserId: currentUser.id,
    onEdit: setEditTarget,
    onResetPassword: setResetTarget,
    onToggleStatus: setStatusTarget,
    onDelete: setDeleteTarget,
  });

  return (
    <RequireRole allow={["SUPER_ADMIN"]} title={t.staff.page.title} description={t.staff.page.descriptionShort}>
      {error ? (
        <div>
          <PageHeader title={t.staff.page.title} description={t.staff.page.descriptionShort} />
          <ErrorState description={t.staff.page.loadError} onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title={t.staff.page.title}
            description={t.staff.page.description}
            actions={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t.staff.page.createStaff}
              </Button>
            }
          />

          {!isLoading && activeStaff.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title={t.staff.page.emptyTitle}
              description={t.staff.page.emptyDescription}
            />
          ) : (
            <DataTable
              columns={columns}
              data={activeStaff}
              isLoading={isLoading}
              searchKey="username"
              searchPlaceholder={t.staff.page.searchPlaceholder}
            />
          )}

          <CreateStaffDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={(created) => setStaff([created, ...activeStaff])}
          />

          <EditStaffDialog
            staff={editTarget}
            currentUserId={currentUser.id}
            open={!!editTarget}
            onOpenChange={(o) => !o && setEditTarget(null)}
            onSaved={(updated) => setStaff(activeStaff.map((s) => (s.id === updated.id ? updated : s)))}
          />

          <ResetPasswordDialog
            staff={resetTarget}
            open={!!resetTarget}
            onOpenChange={(o) => !o && setResetTarget(null)}
          />

          <ConfirmDialog
            open={!!statusTarget}
            onOpenChange={(o) => !o && setStatusTarget(null)}
            title={statusTarget?.status === "SUSPENDED" ? t.staff.activateTitle : t.staff.deactivateTitle}
            description={
              statusTarget?.status === "SUSPENDED"
                ? t.staff.activateDescription(statusTarget?.username ?? "")
                : t.staff.deactivateDescription(statusTarget?.username ?? "")
            }
            confirmLabel={statusTarget?.status === "SUSPENDED" ? t.staff.activate : t.staff.deactivate}
            variant={statusTarget?.status === "SUSPENDED" ? "default" : "destructive"}
            loading={statusSubmitting}
            onConfirm={handleToggleStatus}
          />

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title={t.staff.deleteTitle}
            description={t.staff.deleteDescription(deleteTarget?.username ?? "")}
            confirmLabel={t.common.delete}
            variant="destructive"
            loading={deleteSubmitting}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </RequireRole>
  );
}
