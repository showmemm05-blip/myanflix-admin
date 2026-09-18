"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpFromLine, CheckCircle2, Clock, XCircle } from "lucide-react";
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
import { getWithdrawalColumns } from "@/components/withdrawals/columns";
import { RejectWithdrawalDialog } from "@/components/withdrawals/RejectWithdrawalDialog";
import { ViewWithdrawalDialog } from "@/components/withdrawals/ViewWithdrawalDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useNow } from "@/lib/hooks/use-now";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { getSocket } from "@/lib/socket";
import { withdrawalService } from "@/services/api/withdrawalService";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import { formatKyat } from "@/lib/currency";
import {
  matchesVerificationFilter,
  toWithdrawalVerification,
  viewMatchStatus,
} from "@/lib/bank-verification";
import {
  mergeWithdrawalVerification,
  withdrawalFromCreatedEvent,
  type WithdrawalCreatedEvent,
  type WithdrawalVerificationEvent,
} from "@/lib/realtime-rows";
import type { VerificationFilter, VerificationReviewAction } from "@/types/bank-verification";
import type { Withdrawal } from "@/types/withdrawal";
import { toast } from "sonner";

interface WithdrawalUpdatedEvent {
  id: string;
  status: Withdrawal["status"];
  amount: number;
  accountType: string;
  accountName: string;
  accountNumber: string;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  transferAccountType?: string | null;
  transferAccountSubname?: string | null;
  transferAccountName?: string | null;
  transferAccountNumber?: string | null;
  transferTransactionCode?: string | null;
  transferTransactionTime?: string | null;
}

export default function WithdrawalsPage() {
  const { can } = useRole();
  const canViewQueue = can("WITHDRAWALS.VIEW");
  const { t } = useLanguage();
  // Drives the read-time NO_BANK_TRANSACTION derivation (24 h since approval).
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
      return withdrawalService.getAll({
        limit: 100,
        dateFrom,
        dateTo,
        verification: verification === "all" ? undefined : verification,
      });
    },
    [range, verification]
  );
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);
  // Full accounts (not just method types) so the "our transfer account"
  // picker in TransferAccountCell can list every subname — a withdrawal
  // reviewer gets the admin-shaped response (incl. subname) even without
  // PAYMENT_ACCOUNT_MANAGE; see PaymentAccountsService.findAll.
  const { data: paymentAccounts } = useAsyncData(() => paymentAccountService.getAccounts(), []);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null);
  const activeWithdrawals = useMemo(() => withdrawals ?? data?.items ?? [], [withdrawals, data]);

  const [viewTarget, setViewTarget] = useState<Withdrawal | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ALL");
  // The modal is keyed by id and re-reads the row from `activeWithdrawals`
  // on every render, so a `withdrawal.verification` push updates it live.
  const [verificationTargetId, setVerificationTargetId] = useState<string | null>(null);
  // Approve on a SUSPICIOUS row goes through a confirm (with a note) first.
  const [approveSuspiciousTarget, setApproveSuspiciousTarget] = useState<Withdrawal | null>(null);

  // True while a range-change refetch is in flight — a socket row landing in
  // that window must NOT seed the local list from the closure-stale previous
  // range's data (it would mask the refetched rows for the new range).
  const rangeRefetchingRef = useRef(false);

  const handleRangeChange = (next: DateRangeValue) => {
    // Drop the socket/action-local override so the refetched rows for the new
    // range aren't masked by the stale local list.
    rangeRefetchingRef.current = true;
    setWithdrawals(null);
    setRange(next);
  };

  // Same guard as a range change: the verification tab is a server filter,
  // so the local override must be dropped for the refetched rows to show.
  const handleVerificationChange = (next: VerificationFilter) => {
    rangeRefetchingRef.current = true;
    setWithdrawals(null);
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

  // Tab counts from the loaded page. On "All" every tab is countable; on a
  // specific tab only its own rows are loaded, so the rest show no number.
  const verificationCounts = useMemo<Partial<Record<VerificationFilter, number>>>(() => {
    if (verification !== "all") return { [verification]: activeWithdrawals.length };
    const records = activeWithdrawals.map(toWithdrawalVerification);
    return {
      all: records.length,
      awaiting_bank: records.filter((r) => matchesVerificationFilter(r, "awaiting_bank", now)).length,
      verified: records.filter((r) => matchesVerificationFilter(r, "verified", now)).length,
      needs_review: records.filter((r) => matchesVerificationFilter(r, "needs_review", now)).length,
      no_bank_transaction: records.filter((r) => matchesVerificationFilter(r, "no_bank_transaction", now)).length,
    };
  }, [activeWithdrawals, verification, now]);

  const verificationTarget = useMemo(
    () => (verificationTargetId ? (activeWithdrawals.find((w) => w.id === verificationTargetId) ?? null) : null),
    [activeWithdrawals, verificationTargetId]
  );

  useEffect(() => {
    if (!canViewQueue) return;
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = (event: WithdrawalCreatedEvent) => {
      // A freshly created row is always from "now" — skip the prepend when the
      // active range excludes today (the default today-range and All both
      // include it, so their behavior is unchanged).
      const today = todayStr();
      if ((range.from && today < range.from) || (range.to && today > range.to)) return;
      // Mid-refetch the fetched data still belongs to the previous range —
      // skip; the in-flight fetch will include this row if it qualifies.
      if (rangeRefetchingRef.current) return;
      // A new request is PENDING: nothing bank-side can exist yet, so it only
      // belongs on the unfiltered list (the open set starts at approval).
      if (verification !== "all") return;
      const incoming = withdrawalFromCreatedEvent(event);
      // New requests are always PENDING, so prepending keeps the pending-
      // first ordering the initial fetch already established.
      setWithdrawals((prev) => [incoming, ...(prev ?? data?.items ?? [])]);
    };

    const handleVerification = (event: WithdrawalVerificationEvent) => {
      // Admins-only push from the matcher / a review action in another
      // session. Merged by id; a row not on this page is simply ignored.
      setWithdrawals((prev) =>
        (prev ?? data?.items ?? []).map((w) => (w.id === event.id ? mergeWithdrawalVerification(w, event) : w))
      );
    };

    const handleUpdated = (event: WithdrawalUpdatedEvent) => {
      // Covers status changes and transfer-account edits made from another
      // admin session/tab — this page's own actions already update state
      // directly via handleApprove/handleRejected/handleAccountEdited, so
      // this merge is a no-op there and only matters for cross-session sync.
      setWithdrawals((prev) =>
        (prev ?? data?.items ?? []).map((w) =>
          w.id === event.id
            ? {
                ...w,
                status: event.status,
                amount: event.amount,
                accountType: event.accountType,
                accountName: event.accountName,
                accountNumber: event.accountNumber,
                rejectionReason: event.rejectionReason ?? null,
                approvedAt: event.approvedAt ?? null,
                transferAccountType: event.transferAccountType ?? null,
                transferAccountSubname: event.transferAccountSubname ?? null,
                transferAccountName: event.transferAccountName ?? null,
                transferAccountNumber: event.transferAccountNumber ?? null,
                transferTransactionCode: event.transferTransactionCode ?? null,
                transferTransactionTime: event.transferTransactionTime ?? null,
              }
            : w
        )
      );
    };

    socket.on("withdrawal.created", handleCreated);
    socket.on("withdrawal.updated", handleUpdated);
    socket.on("withdrawal.verification", handleVerification);
    return () => {
      socket.off("withdrawal.created", handleCreated);
      socket.off("withdrawal.updated", handleUpdated);
      socket.off("withdrawal.verification", handleVerification);
    };

  }, [canViewQueue, data, range, verification]);

  const performApprove = async (withdrawal: Withdrawal, note?: string) => {
    setApprovingId(withdrawal.id);
    try {
      // A note from the suspicious-approve confirm is recorded FIRST through
      // the review endpoint (audited with the note), because the approve
      // route takes no body — see the deposits page for the same idiom.
      if (note?.trim() && can("WITHDRAWALS.EDIT")) {
        await withdrawalService.reviewVerification(withdrawal.id, "confirm_suspicious", note);
      }
      const updated = await withdrawalService.approve(withdrawal.id);
      setWithdrawals(activeWithdrawals.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
      setApproveSuspiciousTarget(null);
      toast.success(t.withdrawals.approvedToast, {
        description: t.withdrawals.approvedDescription(withdrawal.userName),
      });
    } catch (err) {
      toast.error(t.withdrawals.approveFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleApprove = (withdrawal: Withdrawal) => {
    // A request flagged SUSPICIOUS before approval (a reused payout code on
    // its twins, say) must be approved deliberately, with a note.
    if (viewMatchStatus(toWithdrawalVerification(withdrawal), now) === "SUSPICIOUS") {
      setApproveSuspiciousTarget(withdrawal);
      return;
    }
    void performApprove(withdrawal);
  };

  const handleReview = async (action: VerificationReviewAction, note: string) => {
    if (!verificationTarget) return;
    try {
      const updated = await withdrawalService.reviewVerification(verificationTarget.id, action, note);
      setWithdrawals(activeWithdrawals.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
      toast.success(t.verification.actions.reviewedToast);
    } catch (err) {
      toast.error(t.verification.actions.reviewFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    }
  };

  const handleRejected = (updated: Withdrawal) => {
    setWithdrawals(activeWithdrawals.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
  };

  const handleAccountEdited = (updated: Withdrawal) => {
    setWithdrawals(activeWithdrawals.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
  };

  const columns = getWithdrawalColumns({
    t,
    types: types ?? [],
    paymentAccounts: paymentAccounts ?? [],
    onView: setViewTarget,
    canApprove: can("WITHDRAWALS.APPROVE"),
    canReject: can("WITHDRAWALS.REJECT"),
    onApprove: handleApprove,
    onReject: setRejectTarget,
    onTransferSaved: handleAccountEdited,
    onOpenVerification: (withdrawal) => setVerificationTargetId(withdrawal.id),
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

  return (
    <RequirePermission
      permission="WITHDRAWALS.VIEW"
      title={t.withdrawals.page.title}
      description={t.withdrawals.page.description}
    >
      <div className="flex flex-col gap-6">
        {isLoading ? (
          // Toolbar stays mounted through refetches — otherwise changing a
          // date unmounts the very input the admin is typing into.
          <DataTable columns={columns} data={[]} isLoading pageSize={10} toolbar={tableToolbar} />
        ) : error ? (
          <ErrorState description={t.withdrawals.loadError} onRetry={refetch} />
        ) : activeWithdrawals.length === 0 && !range.from && !range.to ? (
          // Full-page empty state only when unfiltered — with a range active the
          // table (and its toolbar) must stay visible so the range can be changed.
          <EmptyState icon={ArrowUpFromLine} title={t.withdrawals.emptyTitle} description={t.withdrawals.emptyDescription} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                title={t.withdrawals.pendingAmount}
                value={formatKyat(stats.pendingAmount)}
                icon={Clock}
                iconClassName="bg-pending/15 text-pending"
              />
              <DashboardCard
                title={t.withdrawals.approvedAmount}
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
                title={t.withdrawals.totalWithdrawals}
                value={stats.total.toLocaleString()}
                icon={ArrowUpFromLine}
                iconClassName="bg-info/15 text-info"
              />
            </div>

            <DataTable
              columns={columns}
              data={filteredWithdrawals}
              searchKey="userName"
              searchPlaceholder={t.withdrawals.searchPlaceholder}
              toolbar={tableToolbar}
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

        <VerificationDetailsDialog
          record={verificationTarget ? toWithdrawalVerification(verificationTarget) : null}
          now={now}
          open={verificationTargetId !== null}
          onOpenChange={(open) => !open && setVerificationTargetId(null)}
          paymentAccounts={paymentAccounts ?? []}
          types={types ?? []}
          canReview={can("WITHDRAWALS.EDIT")}
          canViewScreenshot={can("WITHDRAWALS.BANK_EVIDENCE")}
          canApprove={can("WITHDRAWALS.APPROVE")}
          canReject={can("WITHDRAWALS.REJECT")}
          approving={verificationTarget !== null && approvingId === verificationTarget.id}
          onReview={handleReview}
          onApprove={() => verificationTarget && handleApprove(verificationTarget)}
          onReject={() => verificationTarget && setRejectTarget(verificationTarget)}
          fetchScreenshot={withdrawalService.fetchBankScreenshot}
        />

        <ApproveSuspiciousDialog
          kind="withdrawal"
          open={approveSuspiciousTarget !== null}
          onOpenChange={(open) => !open && setApproveSuspiciousTarget(null)}
          loading={approveSuspiciousTarget !== null && approvingId === approveSuspiciousTarget.id}
          showNote={can("WITHDRAWALS.EDIT")}
          onConfirm={(note) => approveSuspiciousTarget && performApprove(approveSuspiciousTarget, note)}
        />
      </div>
    </RequirePermission>
  );
}
