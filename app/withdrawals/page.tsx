"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpFromLine, CheckCircle2, Clock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequireRole } from "@/components/shared/RequireRole";
import { DataTable } from "@/components/tables/DataTable";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { StatusFilterTabs, type StatusFilterValue } from "@/components/shared/StatusFilterTabs";
import { getWithdrawalColumns } from "@/components/withdrawals/columns";
import { RejectWithdrawalDialog } from "@/components/withdrawals/RejectWithdrawalDialog";
import { EditTransferAccountDialog } from "@/components/withdrawals/EditTransferAccountDialog";
import { ViewWithdrawalDialog } from "@/components/withdrawals/ViewWithdrawalDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { getSocket } from "@/lib/socket";
import { withdrawalService } from "@/services/api/withdrawalService";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import { formatKyat } from "@/lib/currency";
import type { Withdrawal } from "@/types/withdrawal";
import { toast } from "sonner";

interface WithdrawalCreatedEvent {
  id: string;
  userId: string;
  username: string;
  amount: number;
  accountType: string;
  accountName: string;
  accountNumber: string;
  status: Withdrawal["status"];
  createdAt: string;
}

export default function WithdrawalsPage() {
  const { role } = useRole();

  const { data, isLoading, error, refetch } = useAsyncData(
    () => withdrawalService.getAll({ limit: 100 }),
    []
  );
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null);
  const activeWithdrawals = useMemo(() => withdrawals ?? data?.items ?? [], [withdrawals, data]);

  const [viewTarget, setViewTarget] = useState<Withdrawal | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);
  const [editTarget, setEditTarget] = useState<Withdrawal | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ALL");

  const stats = useMemo(() => {
    let pendingAmount = 0;
    let approvedAmount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    for (const w of activeWithdrawals) {
      if (w.status === "PENDING") {
        pendingAmount += w.amount;
        pendingCount++;
      } else if (w.status === "APPROVED") {
        approvedAmount += w.amount;
        approvedCount++;
      } else if (w.status === "REJECTED") {
        rejectedCount++;
      }
    }
    return { pendingAmount, approvedAmount, rejectedCount, pendingCount, approvedCount, total: activeWithdrawals.length };
  }, [activeWithdrawals]);

  const filteredWithdrawals = useMemo(
    () => (statusFilter === "ALL" ? activeWithdrawals : activeWithdrawals.filter((w) => w.status === statusFilter)),
    [activeWithdrawals, statusFilter]
  );

  useEffect(() => {
    if (role === "USER") return;
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = (event: WithdrawalCreatedEvent) => {
      const incoming: Withdrawal = {
        id: event.id,
        userId: event.userId,
        userName: event.username,
        userPhone: null,
        amount: event.amount,
        accountType: event.accountType,
        accountName: event.accountName,
        accountNumber: event.accountNumber,
        status: event.status,
        rejectionReason: null,
        approvedByUserId: null,
        approvedAt: null,
        transferAccountType: null,
        transferAccountName: null,
        transferAccountNumber: null,
        createdAt: event.createdAt,
        updatedAt: event.createdAt,
      };
      // New requests are always PENDING, so prepending keeps the pending-
      // first ordering the initial fetch already established.
      setWithdrawals((prev) => [incoming, ...(prev ?? data?.items ?? [])]);
    };

    socket.on("withdrawal.created", handleCreated);
    return () => {
      socket.off("withdrawal.created", handleCreated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, data]);

  const handleApprove = async (withdrawal: Withdrawal) => {
    setApprovingId(withdrawal.id);
    try {
      const updated = await withdrawalService.approve(withdrawal.id);
      setWithdrawals(activeWithdrawals.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
      toast.success("Withdrawal approved", {
        description: `${withdrawal.userName}'s balance has been debited.`,
      });
    } catch (err) {
      toast.error("Failed to approve withdrawal", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejected = (updated: Withdrawal) => {
    setWithdrawals(activeWithdrawals.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
  };

  const handleAccountEdited = (updated: Withdrawal) => {
    setWithdrawals(activeWithdrawals.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
  };

  const columns = getWithdrawalColumns({
    types: types ?? [],
    onView: setViewTarget,
    onApprove: handleApprove,
    onReject: setRejectTarget,
    onEdit: setEditTarget,
    approvingId,
  });

  return (
    <RequireRole
      allow={["SUPER_ADMIN", "ADMIN"]}
      title="Withdrawals"
      description="Review and approve wallet withdrawal requests."
    >
      <div className="flex flex-col gap-6">
        <PageHeader title="Withdrawals" description="Review and approve wallet withdrawal requests. Pending requests are shown first." />

        {isLoading ? (
          <DataTable columns={columns} data={[]} isLoading pageSize={10} />
        ) : error ? (
          <ErrorState description="We couldn't load withdrawals." onRetry={refetch} />
        ) : activeWithdrawals.length === 0 ? (
          <EmptyState icon={ArrowUpFromLine} title="No withdrawals yet" description="Submitted withdrawal requests will show up here." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                title="Pending Amount"
                value={formatKyat(stats.pendingAmount)}
                icon={Clock}
                iconClassName="bg-warning/15 text-warning"
              />
              <DashboardCard
                title="Approved Amount"
                value={formatKyat(stats.approvedAmount)}
                icon={CheckCircle2}
                iconClassName="bg-success/15 text-success"
              />
              <DashboardCard
                title="Rejected"
                value={stats.rejectedCount.toLocaleString()}
                icon={XCircle}
                iconClassName="bg-destructive/15 text-destructive"
              />
              <DashboardCard
                title="Total Withdrawals"
                value={stats.total.toLocaleString()}
                icon={ArrowUpFromLine}
                iconClassName="bg-violet-500/15 text-violet-400"
              />
            </div>

            <DataTable
              columns={columns}
              data={filteredWithdrawals}
              searchKey="userName"
              searchPlaceholder="Search by customer name..."
              toolbar={
                <StatusFilterTabs
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  counts={{
                    all: stats.total,
                    pending: stats.pendingCount,
                    approved: stats.approvedCount,
                    rejected: stats.rejectedCount,
                  }}
                />
              }
            />
          </>
        )}

        <ViewWithdrawalDialog
          withdrawal={viewTarget}
          open={viewTarget !== null}
          onOpenChange={(open) => !open && setViewTarget(null)}
        />

        <RejectWithdrawalDialog
          withdrawal={rejectTarget}
          open={rejectTarget !== null}
          onOpenChange={(open) => !open && setRejectTarget(null)}
          onRejected={handleRejected}
        />

        <EditTransferAccountDialog
          withdrawal={editTarget}
          types={types ?? []}
          open={editTarget !== null}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSaved={handleAccountEdited}
        />
      </div>
    </RequireRole>
  );
}
