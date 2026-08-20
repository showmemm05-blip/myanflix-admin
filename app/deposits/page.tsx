"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, CheckCircle2, Clock, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { StatusFilterTabs, type StatusFilterValue } from "@/components/shared/StatusFilterTabs";
import { DateRangeFilter, todayStr, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { getDepositColumns } from "@/components/deposits/columns";
import { ManualDepositDialog } from "@/components/deposits/ManualDepositDialog";
import { RejectDepositDialog } from "@/components/deposits/RejectDepositDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { getSocket } from "@/lib/socket";
import { depositService } from "@/services/api/depositService";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import { formatKyat } from "@/lib/currency";
import { userLabel } from "@/lib/user-label";
import type { Deposit } from "@/types/deposit";
import { toast } from "sonner";

interface DepositCreatedEvent {
  id: string;
  userId: string;
  /** Raw login identity, straight off the realtime payload. */
  username: string;
  /** The name the user set; null until they set one. Render via `userLabel(event)`. */
  displayName: string | null;
  amount: number;
  paymentMethod: string;
  accountName: string | null;
  reference: string;
  status: Deposit["status"];
  createdAt: string;
}

interface DepositUpdatedEvent {
  id: string;
  status: Deposit["status"];
  amount: number;
  paymentMethod: string;
  reference: string;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  receivingAccountType?: string | null;
  receivingAccountSubname?: string | null;
  receivingAccountName?: string | null;
  receivingAccountNumber?: string | null;
  receivingTransactionCode?: string | null;
  receivingTransactionTime?: string | null;
}

export default function DepositsPage() {
  const { can } = useRole();
  const canViewQueue = can("DEPOSITS.VIEW");
  const canRecordDeposit = can("DEPOSITS.CREATE");
  const { t } = useLanguage();

  // Default to TODAY so the page opens on the current day's activity.
  const [range, setRange] = useState(() => ({ from: todayStr(), to: todayStr() }));

  const { data, isLoading, error, refetch } = useAsyncData(
    () => {
      // LOCAL day boundaries sent as full ISO datetimes — a bare YYYY-MM-DD
      // would be parsed as UTC midnight and make the "to" day exclusive here.
      const dateFrom = range.from ? new Date(`${range.from}T00:00:00`).toISOString() : undefined;
      const dateTo = range.to ? new Date(`${range.to}T23:59:59.999`).toISOString() : undefined;
      return depositService.getAll({ limit: 100, dateFrom, dateTo });
    },
    [range]
  );
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);
  const { data: paymentAccounts, refetch: refetchAccounts } = useAsyncData(
    () => paymentAccountService.getAccounts(),
    []
  );
  const [deposits, setDeposits] = useState<Deposit[] | null>(null);
  const activeDeposits = useMemo(() => deposits ?? data?.items ?? [], [deposits, data]);

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Deposit | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ALL");

  // True while a range-change refetch is in flight — a socket row landing in
  // that window must NOT seed the local list from the closure-stale previous
  // range's data (it would mask the refetched rows for the new range).
  const rangeRefetchingRef = useRef(false);

  const handleRangeChange = (next: DateRangeValue) => {
    // Drop the socket/action-local override so the refetched rows for the new
    // range aren't masked by the stale local list.
    rangeRefetchingRef.current = true;
    setDeposits(null);
    setRange(next);
  };

  useEffect(() => {
    if (data) rangeRefetchingRef.current = false;
  }, [data]);

  const stats = useMemo(() => {
    let pendingAmount = 0;
    let approvedAmount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    for (const d of activeDeposits) {
      if (d.status === "PENDING") {
        pendingAmount += d.amount;
        pendingCount++;
      } else if (d.status === "APPROVED") {
        approvedAmount += d.amount;
        approvedCount++;
      } else if (d.status === "REJECTED") {
        rejectedCount++;
      }
    }
    return { pendingAmount, approvedAmount, rejectedCount, pendingCount, approvedCount, total: activeDeposits.length };
  }, [activeDeposits]);

  const filteredDeposits = useMemo(
    () => (statusFilter === "ALL" ? activeDeposits : activeDeposits.filter((d) => d.status === statusFilter)),
    [activeDeposits, statusFilter]
  );

  useEffect(() => {
    if (!canViewQueue) return;
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = (event: DepositCreatedEvent) => {
      // A freshly created row is always from "now" — skip the prepend when the
      // active range excludes today (the default today-range and All both
      // include it, so their behavior is unchanged).
      const today = todayStr();
      if ((range.from && today < range.from) || (range.to && today > range.to)) return;
      // Mid-refetch the fetched data still belongs to the previous range —
      // skip; the in-flight fetch will include this row if it qualifies.
      if (rangeRefetchingRef.current) return;
      const incoming: Deposit = {
        id: event.id,
        userId: event.userId,
        userName: userLabel(event),
        userUsername: event.username,
        userPhone: null,
        amount: event.amount,
        paymentMethod: event.paymentMethod,
        accountName: event.accountName,
        reference: event.reference,
        status: event.status,
        rejectionReason: null,
        approvedByUserId: null,
        approvedAt: null,
        receivingAccountType: null,
        receivingAccountSubname: null,
        receivingAccountName: null,
        receivingAccountNumber: null,
        receivingTransactionCode: null,
        receivingTransactionTime: null,
        receivingPaymentAccountId: null,
        walletBalanceBefore: null,
        walletBalanceAfter: null,
        createdAt: event.createdAt,
        updatedAt: event.createdAt,
      };
      // Toasting here too would double up with AdminDepositNotifications,
      // mounted app-wide in app/layout.tsx — this listener only keeps the
      // visible table current in real time while this page is open.
      setDeposits((prev) => [incoming, ...(prev ?? data?.items ?? [])]);
    };

    const handleUpdated = (event: DepositUpdatedEvent) => {
      // Covers status changes and receiving-account edits made from another
      // admin session/tab — this page's own actions already update state
      // directly via handleApproved/handleRejected/handleReceivingSaved, so
      // this merge is a no-op there and only matters for cross-session sync.
      setDeposits((prev) =>
        (prev ?? data?.items ?? []).map((d) =>
          d.id === event.id
            ? {
                ...d,
                status: event.status,
                amount: event.amount,
                paymentMethod: event.paymentMethod,
                reference: event.reference,
                rejectionReason: event.rejectionReason ?? null,
                approvedAt: event.approvedAt ?? null,
                receivingAccountType: event.receivingAccountType ?? null,
                receivingAccountSubname: event.receivingAccountSubname ?? null,
                receivingAccountName: event.receivingAccountName ?? null,
                receivingAccountNumber: event.receivingAccountNumber ?? null,
                receivingTransactionCode: event.receivingTransactionCode ?? null,
                receivingTransactionTime: event.receivingTransactionTime ?? null,
              }
            : d
        )
      );
    };

    socket.on("deposit.created", handleCreated);
    socket.on("deposit.updated", handleUpdated);
    return () => {
      socket.off("deposit.created", handleCreated);
      socket.off("deposit.updated", handleUpdated);
    };

  }, [canViewQueue, data, range]);

  const handleApprove = async (deposit: Deposit) => {
    setApprovingId(deposit.id);
    try {
      // No account picker anymore — the depositor already declared which of
      // our payment accounts they sent to when submitting, and the backend
      // auto-credits that declared account on approval.
      const updated = await depositService.approve(deposit.id);
      setDeposits(activeDeposits.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      toast.success(t.deposits.approvedToast, {
        description: t.deposits.approvedDescription(deposit.userName),
      });
    } catch (err) {
      toast.error(t.deposits.approveFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejected = (updated: Deposit) => {
    setDeposits(activeDeposits.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  };

  const handleReceivingSaved = (updated: Deposit) => {
    setDeposits(activeDeposits.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  };

  const handleManualSaved = (created: Deposit) => {
    // The new row lands in local state immediately (same idiom as the other
    // handlers); the payment-accounts refetch picks up the destination
    // account's changed balance for the receiving-account column labels.
    setDeposits([created, ...activeDeposits]);
    refetchAccounts();
  };

  const columns = getDepositColumns({
    t,
    types: types ?? [],
    paymentAccounts: paymentAccounts ?? [],
    canApprove: can("DEPOSITS.APPROVE"),
    canReject: can("DEPOSITS.REJECT"),
    onApprove: handleApprove,
    onReject: setRejectTarget,
    onReceivingSaved: handleReceivingSaved,
    approvingId,
  });

  // Shared by the loaded AND loading DataTable branches so the range inputs
  // never unmount mid-typing while a refetch is in flight.
  const tableToolbar = (
    <div className="flex flex-wrap items-center gap-2">
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
      <DateRangeFilter value={range} onChange={handleRangeChange} />
    </div>
  );

  // Lives right beside the table's search input (DataTable searchActions slot).
  const recordButton = canRecordDeposit ? (
    <Button className="shrink-0" onClick={() => setRecordOpen(true)}>
      <Plus className="size-4" />
      {t.deposits.manualDeposit.recordButton}
    </Button>
  ) : null;

  return (
    <RequirePermission
      permission="DEPOSITS.VIEW"
      title={t.deposits.page.title}
      description={t.deposits.page.description}
    >
      <div className="flex flex-col gap-6">
        {isLoading ? (
          // Toolbar stays mounted through refetches — otherwise changing a
          // date unmounts the very input the admin is typing into.
          <DataTable
            columns={columns}
            data={[]}
            isLoading
            pageSize={10}
            searchKey="userName"
            searchPlaceholder={t.deposits.searchPlaceholder}
            searchActions={recordButton}
            toolbar={tableToolbar}
          />
        ) : error ? (
          <ErrorState description={t.deposits.loadError} onRetry={refetch} />
        ) : activeDeposits.length === 0 && !range.from && !range.to ? (
          // Full-page empty state only when unfiltered — with a range active the
          // table (and its toolbar) must stay visible so the range can be changed.
          // The table (and its search-side button) is hidden here, so keep a
          // way to record the very first deposit.
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">{recordButton}</div>
            <EmptyState icon={ArrowDownToLine} title={t.deposits.emptyTitle} description={t.deposits.emptyDescription} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                title={t.deposits.pendingAmount}
                value={formatKyat(stats.pendingAmount)}
                icon={Clock}
                iconClassName="bg-pending/15 text-pending"
              />
              <DashboardCard
                title={t.deposits.approvedAmount}
                value={formatKyat(stats.approvedAmount)}
                icon={CheckCircle2}
                iconClassName="bg-approved/15 text-approved"
              />
              <DashboardCard
                title={t.shared.statusRejected}
                value={stats.rejectedCount.toLocaleString()}
                icon={XCircle}
                iconClassName="bg-rejected/15 text-rejected"
              />
              <DashboardCard
                title={t.deposits.totalDeposits}
                value={stats.total.toLocaleString()}
                icon={ArrowDownToLine}
                iconClassName="bg-info/15 text-info"
              />
            </div>

            <DataTable
              columns={columns}
              data={filteredDeposits}
              searchKey="userName"
              searchPlaceholder={t.deposits.searchPlaceholder}
              searchActions={recordButton}
              toolbar={tableToolbar}
            />
          </>
        )}

        <ManualDepositDialog
          accounts={paymentAccounts ?? []}
          types={types ?? []}
          open={recordOpen}
          onOpenChange={setRecordOpen}
          onSaved={handleManualSaved}
        />

        <RejectDepositDialog
          deposit={rejectTarget}
          open={rejectTarget !== null}
          onOpenChange={(open) => !open && setRejectTarget(null)}
          onRejected={handleRejected}
        />
      </div>
    </RequirePermission>
  );
}
