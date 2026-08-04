"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequireRole } from "@/components/shared/RequireRole";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/tables/DataTable";
import { getDepositColumns } from "@/components/deposits/columns";
import { RejectDepositDialog } from "@/components/deposits/RejectDepositDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { getSocket } from "@/lib/socket";
import { depositService } from "@/services/api/depositService";
import { formatKyat } from "@/lib/currency";
import type { Deposit } from "@/types/deposit";
import { toast } from "sonner";

interface DepositCreatedEvent {
  id: string;
  userId: string;
  username: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  status: Deposit["status"];
  createdAt: string;
}

export default function DepositsPage() {
  const { role } = useRole();

  const { data, isLoading, error, refetch } = useAsyncData(
    () => depositService.getAll({ limit: 100 }),
    []
  );
  const [deposits, setDeposits] = useState<Deposit[] | null>(null);
  const activeDeposits = deposits ?? data?.items ?? [];

  const [approveTarget, setApproveTarget] = useState<Deposit | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Deposit | null>(null);

  useEffect(() => {
    if (role === "USER") return;
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = (event: DepositCreatedEvent) => {
      const incoming: Deposit = {
        id: event.id,
        userId: event.userId,
        userName: event.username,
        userEmail: "",
        amount: event.amount,
        paymentMethod: event.paymentMethod,
        reference: event.reference,
        status: event.status,
        rejectionReason: null,
        approvedByUserId: null,
        approvedAt: null,
        createdAt: event.createdAt,
        updatedAt: event.createdAt,
      };
      // Toasting here too would double up with AdminDepositNotifications,
      // mounted app-wide in app/layout.tsx — this listener only keeps the
      // visible table current in real time while this page is open.
      setDeposits((prev) => [incoming, ...(prev ?? data?.items ?? [])]);
    };

    socket.on("deposit.created", handleCreated);
    return () => {
      socket.off("deposit.created", handleCreated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, data]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    try {
      const updated = await depositService.approve(approveTarget.id);
      setDeposits(activeDeposits.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      toast.success("Deposit approved", {
        description: `${approveTarget.userName}'s balance has been updated.`,
      });
      setApproveTarget(null);
    } catch (err) {
      toast.error("Failed to approve deposit", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setApproving(false);
    }
  };

  const handleRejected = (updated: Deposit) => {
    setDeposits(activeDeposits.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  };

  const columns = getDepositColumns({
    onApprove: setApproveTarget,
    onReject: setRejectTarget,
  });

  return (
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN"]}
      title="Deposits"
      description="Review and approve balance top-up requests."
    >
      <div className="flex flex-col gap-6">
        <PageHeader title="Deposits" description="Review and approve balance top-up requests." />

        {isLoading ? (
          <DataTable columns={columns} data={[]} isLoading pageSize={10} />
        ) : error ? (
          <ErrorState description="We couldn't load deposits." onRetry={refetch} />
        ) : activeDeposits.length === 0 ? (
          <EmptyState icon={ArrowDownToLine} title="No deposits yet" description="Submitted deposits will show up here." />
        ) : (
          <DataTable
            columns={columns}
            data={activeDeposits}
            searchKey="userName"
            searchPlaceholder="Search by user name..."
          />
        )}

        <ConfirmDialog
          open={approveTarget !== null}
          onOpenChange={(open) => !open && setApproveTarget(null)}
          title="Approve deposit"
          description={
            approveTarget
              ? `Approve ${approveTarget.userName}'s deposit of ${formatKyat(approveTarget.amount)}? Their balance will be updated immediately.`
              : ""
          }
          confirmLabel="Approve"
          loading={approving}
          onConfirm={handleApprove}
        />

        <RejectDepositDialog
          deposit={rejectTarget}
          open={rejectTarget !== null}
          onOpenChange={(open) => !open && setRejectTarget(null)}
          onRejected={handleRejected}
        />
      </div>
    </RequireRole>
  );
}
