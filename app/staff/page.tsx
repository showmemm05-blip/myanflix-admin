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
import { staffService } from "@/services/api/staffService";
import { ApiError } from "@/services/api/apiClient";
import type { StaffMember } from "@/types/staff";
import { toast } from "sonner";

export default function StaffPage() {
  const { currentUser } = useRole();
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
      toast.success(nextStatus === "SUSPENDED" ? "Account deactivated" : "Account activated", {
        description: `${statusTarget.username} is now ${nextStatus === "SUSPENDED" ? "inactive" : "active"}.`,
      });
      setStatusTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
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
      toast.success("Staff account deleted", { description: `${deleteTarget.username} has been removed.` });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const columns = getStaffColumns({
    currentUserId: currentUser.id,
    onEdit: setEditTarget,
    onResetPassword: setResetTarget,
    onToggleStatus: setStatusTarget,
    onDelete: setDeleteTarget,
  });

  return (
    <RequireRole allow={["SUPER_ADMIN"]} title="Staff" description="Manage admin dashboard staff accounts.">
      {error ? (
        <div>
          <PageHeader title="Staff" description="Manage admin dashboard staff accounts." />
          <ErrorState description="We couldn't load the staff list." onRetry={refetch} />
        </div>
      ) : (
        <div>
          <PageHeader
            title="Staff"
            description="Create and manage Super Admin, Admin, and Content Uploader accounts."
            actions={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Create Staff
              </Button>
            }
          />

          {!isLoading && activeStaff.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title="No staff accounts yet"
              description="Create a staff account to give someone access to this dashboard."
            />
          ) : (
            <DataTable
              columns={columns}
              data={activeStaff}
              isLoading={isLoading}
              searchKey="username"
              searchPlaceholder="Search staff by username..."
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
            title={statusTarget?.status === "SUSPENDED" ? "Activate this account?" : "Deactivate this account?"}
            description={
              statusTarget?.status === "SUSPENDED"
                ? `${statusTarget?.username} will regain access to the dashboard.`
                : `${statusTarget?.username} will immediately lose access to the dashboard.`
            }
            confirmLabel={statusTarget?.status === "SUSPENDED" ? "Activate" : "Deactivate"}
            variant={statusTarget?.status === "SUSPENDED" ? "default" : "destructive"}
            loading={statusSubmitting}
            onConfirm={handleToggleStatus}
          />

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title="Delete this staff account?"
            description={`${deleteTarget?.username} will permanently lose access to the dashboard. This action cannot be undone.`}
            confirmLabel="Delete"
            variant="destructive"
            loading={deleteSubmitting}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </RequireRole>
  );
}
