"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpFromLine, CheckCircle2, Clock, XCircle } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
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
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback";
import { useNow } from "@/lib/hooks/use-now";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { getSocket, onResync } from "@/lib/socket";
import { withdrawalService, type WithdrawalQuery } from "@/services/api/withdrawalService";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import { formatKyat } from "@/lib/currency";
import { toWithdrawalVerification, viewMatchStatus } from "@/lib/bank-verification";
import {
  mergeWithdrawalVerification,
  withdrawalFromCreatedEvent,
  type WithdrawalCreatedEvent,
  type WithdrawalVerificationEvent,
} from "@/lib/realtime-rows";
import type { PaginatedResponse } from "@/types/api";
import type { VerificationFilter, VerificationReviewAction } from "@/types/bank-verification";
import type { Withdrawal } from "@/types/withdrawal";
import { toast } from "sonner";

/** Rows per server page (H-24): the queue, its search and its totals all live on the server. */
const PAGE_LIMIT = 25;
// Live events arriving within this window refresh the stat cards once.
const STATS_REFETCH_DEBOUNCE_MS = 750;

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
  // The bank-verification axis and the money-status tabs — both SERVER
  // filters now (H-24), so they narrow the whole queue, not one loaded page.
  const [verification, setVerification] = useState<VerificationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ALL");
  const [page, setPage] = useState(1);

  // Server search over the payout account name/number and the user's
  // username / display name / phone — the queue is paged, so a filter over
  // the loaded page would hide every match past it. Capped at the API's 100.
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = search.trim().slice(0, 100);
      if (next === appliedSearch) return;
      setPage(1);
      setAppliedSearch(next);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  // The one server query behind both the page of rows and the stat cards.
  const query = useMemo<WithdrawalQuery>(() => {
    // LOCAL day boundaries sent as full ISO datetimes — a bare YYYY-MM-DD
    // would be parsed as UTC midnight and make the "to" day exclusive here.
    const dateFrom = range.from ? new Date(`${range.from}T00:00:00`).toISOString() : undefined;
    const dateTo = range.to ? new Date(`${range.to}T23:59:59.999`).toISOString() : undefined;
    return {
      dateFrom,
      dateTo,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      verification: verification === "all" ? undefined : verification,
      search: appliedSearch || undefined,
    };
  }, [range, statusFilter, verification, appliedSearch]);

  const { data, isLoading, error, refetch } = useAsyncData(
    () => withdrawalService.getAll({ ...query, page, limit: PAGE_LIMIT }),
    [query, page]
  );
  // Cards and tab counts summed by the database over EVERY matching row —
  // never from the page in hand (H-24). Kept on screen while a refetch runs.
  const { data: stats, refetch: refetchStatsNow } = useAsyncData(() => withdrawalService.getStats(query), [query]);
  // One approval emits several socket events in a row (updated, the
  // verification twins, plus this page's own call after the action); the
  // stats are a database aggregate, so a burst is coalesced into one request.
  const refetchStats = useDebouncedCallback(refetchStatsNow, STATS_REFETCH_DEBOUNCE_MS);
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);
  // Full accounts (not just method types) so the "our transfer account"
  // picker in TransferAccountCell can list every subname — a withdrawal
  // reviewer gets the admin-shaped response (incl. subname) even without
  // PAYMENT_ACCOUNT_MANAGE; see PaymentAccountsService.findAll.
  const { data: paymentAccounts } = useAsyncData(() => paymentAccountService.getAccounts(), []);
  // Local edits and socket pushes ride on the page they were made against.
  // Once a newer fetch lands (a filter, a page turn, a resync) it replaces
  // them — it already carries those changes — so a push arriving mid-refetch
  // can never mask the new query's rows with the previous one's.
  const [local, setLocal] = useState<{ base: PaginatedResponse<Withdrawal>; rows: Withdrawal[] } | null>(null);
  const activeWithdrawals = useMemo(
    () => (data && local?.base === data ? local.rows : data?.items ?? []),
    [data, local]
  );
  const updateRows = useCallback(
    (change: (rows: Withdrawal[]) => Withdrawal[]) => {
      if (!data) return;
      setLocal((prev) => ({ base: data, rows: change(prev?.base === data ? prev.rows : data.items) }));
    },
    [data]
  );
  // Rows a push added on this page count toward the total.
  const total = data ? data.total + activeWithdrawals.length - data.items.length : 0;

  const [viewTarget, setViewTarget] = useState<Withdrawal | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);
  // The modal is keyed by id and re-reads the row from `activeWithdrawals`
  // on every render, so a `withdrawal.verification` push updates it live.
  const [verificationTargetId, setVerificationTargetId] = useState<string | null>(null);
  // Approve on a SUSPICIOUS row goes through a confirm (with a note) first.
  const [approveSuspiciousTarget, setApproveSuspiciousTarget] = useState<Withdrawal | null>(null);

  // Every filter change starts again at page 1 — page N of a narrower
  // result set is usually past its end.
  const handleRangeChange = (next: DateRangeValue) => {
    setPage(1);
    setRange(next);
  };

  const handleVerificationChange = (next: VerificationFilter) => {
    setPage(1);
    setVerification(next);
  };

  const handleStatusChange = (next: StatusFilterValue) => {
    setPage(1);
    setStatusFilter(next);
  };

  /**
   * Whether a brand-new request (created "now", PENDING) belongs at the top
   * of what is on screen: page 1 (the server lists pending first, newest
   * first), no search term (the server decides what a term matches), a
   * status tab that admits it, and a range that includes today.
   */
  const newRowFitsView = useCallback(() => {
    const today = todayStr();
    if ((range.from && today < range.from) || (range.to && today > range.to)) return false;
    return page === 1 && !appliedSearch && (statusFilter === "ALL" || statusFilter === "PENDING");
  }, [range, page, appliedSearch, statusFilter]);

  const verificationTarget = useMemo(
    () => (verificationTargetId ? (activeWithdrawals.find((w) => w.id === verificationTargetId) ?? null) : null),
    [activeWithdrawals, verificationTargetId]
  );

  useEffect(() => {
    if (!canViewQueue) return;
    // Before the socket check: a reconnect or a tab coming back into view
    // must refetch even if the socket was not there when this ran.
    const stopResync = onResync(() => {
      refetch();
      refetchStats();
    });
    const socket = getSocket();
    if (!socket) return stopResync;

    const handleCreated = (event: WithdrawalCreatedEvent) => {
      // Every new request moves the cards and tab counts, wherever it lands.
      refetchStats();
      // Skip the prepend when the view (page, search, status tab, range)
      // would not show the new request at the top.
      if (!newRowFitsView()) return;
      // A new request is PENDING: nothing bank-side can exist yet, so it only
      // belongs on the unfiltered list (the open set starts at approval).
      if (verification !== "all") return;
      const incoming = withdrawalFromCreatedEvent(event);
      // New requests are always PENDING, so prepending keeps the pending-
      // first ordering the initial fetch already established.
      updateRows((rows) => [incoming, ...rows]);
    };

    const handleVerification = (event: WithdrawalVerificationEvent) => {
      // Push to WITHDRAWALS.VIEW holders (their permission room) from the
      // matcher / a review action in another session. Merged by id; a row
      // not on this page is simply ignored. The tab counts move with it.
      refetchStats();
      updateRows((rows) => rows.map((w) => (w.id === event.id ? mergeWithdrawalVerification(w, event) : w)));
    };

    const handleUpdated = (event: WithdrawalUpdatedEvent) => {
      // Covers status changes and transfer-account edits made from another
      // admin session/tab — this page's own actions already update state
      // directly via handleApprove/handleRejected/handleAccountEdited, so
      // this merge is a no-op there and only matters for cross-session sync.
      // A status change moves the cards, so the totals are re-read too.
      refetchStats();
      updateRows((rows) =>
        rows.map((w) =>
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
      stopResync();
      socket.off("withdrawal.created", handleCreated);
      socket.off("withdrawal.updated", handleUpdated);
      socket.off("withdrawal.verification", handleVerification);
    };

  }, [canViewQueue, verification, newRowFitsView, updateRows, refetch, refetchStats]);

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
      updateRows((rows) => rows.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
      refetchStats();
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
      updateRows((rows) => rows.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
      refetchStats();
      toast.success(t.verification.actions.reviewedToast);
    } catch (err) {
      toast.error(t.verification.actions.reviewFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    }
  };

  const handleRejected = (updated: Withdrawal) => {
    updateRows((rows) => rows.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
    refetchStats();
  };

  const handleAccountEdited = (updated: Withdrawal) => {
    updateRows((rows) => rows.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
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

  // Rendered once, above a single DataTable that stays mounted through
  // refetches — otherwise changing a date or typing a search would unmount
  // the very input the admin is using.
  const tableToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <StatusFilterTabs
        value={statusFilter}
        onValueChange={handleStatusChange}
        counts={
          stats
            ? {
                all: stats.total.count,
                pending: stats.byStatus.PENDING.count,
                approved: stats.byStatus.APPROVED.count,
                rejected: stats.byStatus.REJECTED.count,
              }
            : undefined
        }
      />
      <VerificationFilterTabs
        value={verification}
        onValueChange={handleVerificationChange}
        counts={stats?.verification ?? {}}
      />
      <DateRangeFilter value={range} onChange={handleRangeChange} />
    </div>
  );

  // Full-page empty state only for a genuinely empty, unfiltered queue — with
  // any range, tab or search active the table (and its toolbar) must stay
  // visible so the filter can be changed back.
  const isFiltered =
    !!range.from || !!range.to || statusFilter !== "ALL" || verification !== "all" || !!search;

  return (
    <RequirePermission
      permission="WITHDRAWALS.VIEW"
      title={t.withdrawals.page.title}
      description={t.withdrawals.page.description}
    >
      <div className="flex flex-col gap-6">
        {error ? (
          <ErrorState description={t.withdrawals.loadError} onRetry={refetch} />
        ) : !isLoading && total === 0 && !isFiltered ? (
          <EmptyState icon={ArrowUpFromLine} title={t.withdrawals.emptyTitle} description={t.withdrawals.emptyDescription} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                title={t.withdrawals.pendingAmount}
                value={stats ? formatKyat(stats.byStatus.PENDING.amount) : "—"}
                icon={Clock}
                iconClassName="bg-pending/15 text-pending"
              />
              <DashboardCard
                title={t.withdrawals.approvedAmount}
                value={stats ? formatKyat(stats.byStatus.APPROVED.amount) : "—"}
                icon={CheckCircle2}
                iconClassName="bg-approved/15 text-approved"
              />
              <DashboardCard
                title={t.shared.statusRejected}
                value={stats ? stats.byStatus.REJECTED.count.toLocaleString() : "—"}
                icon={XCircle}
                iconClassName="bg-rejected/15 text-rejected"
              />
              <DashboardCard
                title={t.withdrawals.totalWithdrawals}
                value={stats ? stats.total.count.toLocaleString() : "—"}
                icon={ArrowUpFromLine}
                iconClassName="bg-info/15 text-info"
              />
            </div>

            <div>
              <DataTable
                columns={columns}
                data={activeWithdrawals}
                isLoading={isLoading}
                pageSize={PAGE_LIMIT}
                manualPagination
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder={t.withdrawals.searchPlaceholder}
                toolbar={tableToolbar}
              />
              {!isLoading && (
                <ServerPagination page={page} pageSize={PAGE_LIMIT} total={total} onPageChange={setPage} />
              )}
            </div>
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
