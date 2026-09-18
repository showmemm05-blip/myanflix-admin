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
import { VerificationFilterTabs } from "@/components/shared/VerificationFilterTabs";
import { VerificationDetailsDialog } from "@/components/shared/VerificationDetailsDialog";
import { ApproveSuspiciousDialog } from "@/components/shared/ApproveSuspiciousDialog";
import { DateRangeFilter, todayStr, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { getDepositColumns } from "@/components/deposits/columns";
import { ManualDepositDialog } from "@/components/deposits/ManualDepositDialog";
import { RejectDepositDialog } from "@/components/deposits/RejectDepositDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useNow } from "@/lib/hooks/use-now";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { getSocket } from "@/lib/socket";
import { depositService } from "@/services/api/depositService";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import { formatKyat } from "@/lib/currency";
import {
  matchesVerificationFilter,
  toDepositVerification,
  viewMatchStatus,
} from "@/lib/bank-verification";
import {
  depositFromCreatedEvent,
  mergeDepositVerification,
  type DepositCreatedEvent,
  type DepositVerificationEvent,
} from "@/lib/realtime-rows";
import type { VerificationFilter, VerificationReviewAction } from "@/types/bank-verification";
import type { Deposit } from "@/types/deposit";
import { toast } from "sonner";

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
  // Drives the read-time NO_BANK_TRANSACTION derivation (24 h since submission).
  const now = useNow();

  // Default to TODAY so the page opens on the current day's activity.
  const [range, setRange] = useState(() => ({ from: todayStr(), to: todayStr() }));
  // The bank-verification axis — a server filter, unlike the status tabs.
  const [verification, setVerification] = useState<VerificationFilter>("all");

  const { data, isLoading, error, refetch } = useAsyncData(
    () => {
      // LOCAL day boundaries sent as full ISO datetimes — a bare YYYY-MM-DD
      // would be parsed as UTC midnight and make the "to" day exclusive here.
      const dateFrom = range.from ? new Date(`${range.from}T00:00:00`).toISOString() : undefined;
      const dateTo = range.to ? new Date(`${range.to}T23:59:59.999`).toISOString() : undefined;
      return depositService.getAll({
        limit: 100,
        dateFrom,
        dateTo,
        verification: verification === "all" ? undefined : verification,
      });
    },
    [range, verification]
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
  // The modal is keyed by id and re-reads the row from `activeDeposits` on
  // every render, so a `deposit.verification` push updates it while open.
  const [verificationTargetId, setVerificationTargetId] = useState<string | null>(null);
  // Approve on a SUSPICIOUS row goes through a confirm (with a note) first.
  const [approveSuspiciousTarget, setApproveSuspiciousTarget] = useState<Deposit | null>(null);

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

  // Same guard as a range change: the verification tab is a server filter,
  // so the local override must be dropped for the refetched rows to show.
  const handleVerificationChange = (next: VerificationFilter) => {
    rangeRefetchingRef.current = true;
    setDeposits(null);
    setVerification(next);
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

  // Tab counts from the loaded page. On "All" every tab is countable; on a
  // specific tab only its own rows are loaded, so the rest show no number.
  const verificationCounts = useMemo<Partial<Record<VerificationFilter, number>>>(() => {
    if (verification !== "all") return { [verification]: activeDeposits.length };
    const records = activeDeposits.map(toDepositVerification);
    return {
      all: records.length,
      awaiting_bank: records.filter((r) => matchesVerificationFilter(r, "awaiting_bank", now)).length,
      verified: records.filter((r) => matchesVerificationFilter(r, "verified", now)).length,
      needs_review: records.filter((r) => matchesVerificationFilter(r, "needs_review", now)).length,
      no_bank_transaction: records.filter((r) => matchesVerificationFilter(r, "no_bank_transaction", now)).length,
    };
  }, [activeDeposits, verification, now]);

  const verificationTarget = useMemo(
    () => (verificationTargetId ? (activeDeposits.find((d) => d.id === verificationTargetId) ?? null) : null),
    [activeDeposits, verificationTargetId]
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
      // A new row is always PENDING and never bank-checked, so it belongs on
      // "All" and "Awaiting bank" only — on any other server filter the
      // prepend would show a row the filter excludes.
      if (verification !== "all" && verification !== "awaiting_bank") return;
      // The payload carries the create-time flags (duplicate reference,
      // velocity…); the factory copies them instead of hard-coding nulls.
      const incoming = depositFromCreatedEvent(event);
      // Toasting here too would double up with AdminDepositNotifications,
      // mounted app-wide in app/layout.tsx — this listener only keeps the
      // visible table current in real time while this page is open.
      setDeposits((prev) => [incoming, ...(prev ?? data?.items ?? [])]);
    };

    const handleVerification = (event: DepositVerificationEvent) => {
      // Admins-only push from the matcher / a review action in another
      // session. Merged by id; a row not on this page is simply ignored
      // (it will carry the values when it is next fetched).
      setDeposits((prev) =>
        (prev ?? data?.items ?? []).map((d) => (d.id === event.id ? mergeDepositVerification(d, event) : d))
      );
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
    socket.on("deposit.verification", handleVerification);
    return () => {
      socket.off("deposit.created", handleCreated);
      socket.off("deposit.updated", handleUpdated);
      socket.off("deposit.verification", handleVerification);
    };

  }, [canViewQueue, data, range, verification]);

  const performApprove = async (deposit: Deposit, note?: string) => {
    setApprovingId(deposit.id);
    try {
      // A note from the suspicious-approve confirm is recorded FIRST through
      // the review endpoint (`confirm_suspicious` keeps the row SUSPICIOUS and
      // is audited with the note), because the approve route takes no body.
      // The audit log then reads: reviewed-with-reason, then approved.
      if (note?.trim() && can("DEPOSITS.EDIT")) {
        await depositService.reviewVerification(deposit.id, "confirm_suspicious", note);
      }
      // No account picker anymore — the depositor already declared which of
      // our payment accounts they sent to when submitting, and the backend
      // auto-credits that declared account on approval.
      const updated = await depositService.approve(deposit.id);
      setDeposits(activeDeposits.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      setApproveSuspiciousTarget(null);
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

  const handleApprove = (deposit: Deposit) => {
    // The money decision stays the admin's, but a SUSPICIOUS row (a hard
    // mismatch against the bank) must be approved deliberately, with a note.
    if (viewMatchStatus(toDepositVerification(deposit), now) === "SUSPICIOUS") {
      setApproveSuspiciousTarget(deposit);
      return;
    }
    void performApprove(deposit);
  };

  const handleReview = async (action: VerificationReviewAction, note: string) => {
    if (!verificationTarget) return;
    try {
      const updated = await depositService.reviewVerification(verificationTarget.id, action, note);
      setDeposits(activeDeposits.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      toast.success(t.verification.actions.reviewedToast);
    } catch (err) {
      toast.error(t.verification.actions.reviewFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
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
    onOpenVerification: (deposit) => setVerificationTargetId(deposit.id),
    approvingId,
    now,
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
      <VerificationFilterTabs
        value={verification}
        onValueChange={handleVerificationChange}
        counts={verificationCounts}
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

        <VerificationDetailsDialog
          record={verificationTarget ? toDepositVerification(verificationTarget) : null}
          now={now}
          open={verificationTargetId !== null}
          onOpenChange={(open) => !open && setVerificationTargetId(null)}
          paymentAccounts={paymentAccounts ?? []}
          types={types ?? []}
          canReview={can("DEPOSITS.EDIT")}
          canViewScreenshot={can("DEPOSITS.BANK_EVIDENCE")}
          canApprove={can("DEPOSITS.APPROVE")}
          canReject={can("DEPOSITS.REJECT")}
          approving={verificationTarget !== null && approvingId === verificationTarget.id}
          onReview={handleReview}
          onApprove={() => verificationTarget && handleApprove(verificationTarget)}
          onReject={() => verificationTarget && setRejectTarget(verificationTarget)}
          fetchScreenshot={depositService.fetchBankScreenshot}
        />

        <ApproveSuspiciousDialog
          kind="deposit"
          open={approveSuspiciousTarget !== null}
          onOpenChange={(open) => !open && setApproveSuspiciousTarget(null)}
          loading={approveSuspiciousTarget !== null && approvingId === approveSuspiciousTarget.id}
          showNote={can("DEPOSITS.EDIT")}
          onConfirm={(note) => approveSuspiciousTarget && performApprove(approveSuspiciousTarget, note)}
        />
      </div>
    </RequirePermission>
  );
}
