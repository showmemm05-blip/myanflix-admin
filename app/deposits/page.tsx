"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, CheckCircle2, Clock, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { StatusFilterTabs, type StatusFilterValue } from "@/components/shared/StatusFilterTabs";
import { VerificationFilterTabs } from "@/components/shared/VerificationFilterTabs";
import { VerificationDetailsDialog } from "@/components/shared/VerificationDetailsDialog";
import {
  ApproveSuspiciousDialog,
  type AmountMismatch,
  type AmountOverrideDecision,
} from "@/components/shared/ApproveSuspiciousDialog";
import { DateRangeFilter, todayStr, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { getDepositColumns } from "@/components/deposits/columns";
import { ManualDepositDialog } from "@/components/deposits/ManualDepositDialog";
import { RejectDepositDialog } from "@/components/deposits/RejectDepositDialog";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback";
import { useNow } from "@/lib/hooks/use-now";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { getSocket, onResync } from "@/lib/socket";
import { depositService, type DepositQuery } from "@/services/api/depositService";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import { formatKyat } from "@/lib/currency";
import { toDepositVerification, viewMatchStatus } from "@/lib/bank-verification";
import {
  depositFromCreatedEvent,
  mergeDepositVerification,
  type DepositCreatedEvent,
  type DepositVerificationEvent,
} from "@/lib/realtime-rows";
import type { PaginatedResponse } from "@/types/api";
import type { VerificationFilter, VerificationReviewAction } from "@/types/bank-verification";
import type { Deposit } from "@/types/deposit";
import { toast } from "sonner";

/** Rows per server page (H-24): the queue, its search and its totals all live on the server. */
const PAGE_LIMIT = 25;
// Live events arriving within this window refresh the stat cards once.
const STATS_REFETCH_DEBOUNCE_MS = 750;

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
  // The bank-verification axis and the money-status tabs — both SERVER
  // filters now (H-24), so they narrow the whole queue, not one loaded page.
  const [verification, setVerification] = useState<VerificationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ALL");
  const [page, setPage] = useState(1);

  // Server search over reference, payer name and the user's username /
  // display name / phone — the queue is paged, so a filter over the loaded
  // page would hide every match past it. Capped at the API's 100 characters.
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
  const query = useMemo<DepositQuery>(() => {
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
    () => depositService.getAll({ ...query, page, limit: PAGE_LIMIT }),
    [query, page]
  );
  // Cards and tab counts summed by the database over EVERY matching row —
  // never from the page in hand (H-24). Kept on screen while a refetch runs.
  const { data: stats, refetch: refetchStatsNow } = useAsyncData(() => depositService.getStats(query), [query]);
  // One approval emits several socket events in a row (updated, the
  // verification twins, plus this page's own call after the action); the
  // stats are a database aggregate, so a burst is coalesced into one request.
  const refetchStats = useDebouncedCallback(refetchStatsNow, STATS_REFETCH_DEBOUNCE_MS);
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);
  const { data: paymentAccounts, refetch: refetchAccounts } = useAsyncData(
    () => paymentAccountService.getAccounts(),
    []
  );
  // Local edits and socket pushes ride on the page they were made against.
  // Once a newer fetch lands (a filter, a page turn, a resync) it replaces
  // them — it already carries those changes — so a push arriving mid-refetch
  // can never mask the new query's rows with the previous one's.
  const [local, setLocal] = useState<{ base: PaginatedResponse<Deposit>; rows: Deposit[] } | null>(null);
  const activeDeposits = useMemo(
    () => (data && local?.base === data ? local.rows : data?.items ?? []),
    [data, local]
  );
  const updateRows = useCallback(
    (change: (rows: Deposit[]) => Deposit[]) => {
      if (!data) return;
      setLocal((prev) => ({ base: data, rows: change(prev?.base === data ? prev.rows : data.items) }));
    },
    [data]
  );
  // Rows a push or a manual deposit added on this page count toward the total.
  const total = data ? data.total + activeDeposits.length - data.items.length : 0;

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Deposit | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  // The modal is keyed by id and re-reads the row from `activeDeposits` on
  // every render, so a `deposit.verification` push updates it while open.
  const [verificationTargetId, setVerificationTargetId] = useState<string | null>(null);
  // Approve on a SUSPICIOUS row goes through a confirm (with a note) first.
  const [approveSuspiciousTarget, setApproveSuspiciousTarget] = useState<Deposit | null>(null);

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
   * Whether a brand-new row (created "now", newest first) belongs at the top
   * of what is on screen: page 1, no search term (the server decides what a
   * term matches), a status tab that admits it, and a range that includes
   * today (the default today-range and All both do).
   */
  const newRowFitsView = useCallback(
    (status: Deposit["status"]) => {
      const today = todayStr();
      if ((range.from && today < range.from) || (range.to && today > range.to)) return false;
      return page === 1 && !appliedSearch && (statusFilter === "ALL" || statusFilter === status);
    },
    [range, page, appliedSearch, statusFilter]
  );

  const verificationTarget = useMemo(
    () => (verificationTargetId ? (activeDeposits.find((d) => d.id === verificationTargetId) ?? null) : null),
    [activeDeposits, verificationTargetId]
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

    const handleCreated = (event: DepositCreatedEvent) => {
      // Every new request moves the cards and tab counts, wherever it lands.
      refetchStats();
      // A new row is PENDING and newest: skip the prepend when the view
      // (page, search, status tab, range) would not show it at the top.
      if (!newRowFitsView("PENDING")) return;
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
      updateRows((rows) => [incoming, ...rows]);
    };

    const handleVerification = (event: DepositVerificationEvent) => {
      // Push to DEPOSITS.VIEW holders (their permission room) from the
      // matcher / a review action in another session. Merged by id; a row
      // not on this page is simply ignored (it will carry the values when it
      // is next fetched). The verification tab counts move with it.
      refetchStats();
      updateRows((rows) => rows.map((d) => (d.id === event.id ? mergeDepositVerification(d, event) : d)));
    };

    const handleUpdated = (event: DepositUpdatedEvent) => {
      // Covers status changes and receiving-account edits made from another
      // admin session/tab — this page's own actions already update state
      // directly via handleApproved/handleRejected/handleReceivingSaved, so
      // this merge is a no-op there and only matters for cross-session sync.
      // A status change moves the cards, so the totals are re-read too.
      refetchStats();
      updateRows((rows) =>
        rows.map((d) =>
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
      stopResync();
      socket.off("deposit.created", handleCreated);
      socket.off("deposit.updated", handleUpdated);
      socket.off("deposit.verification", handleVerification);
    };

  }, [canViewQueue, verification, newRowFitsView, updateRows, refetch, refetchStats]);

  /** M-15/M-7: the typed amount next to the bank's, only when they differ. */
  const amountMismatchOf = (deposit: Deposit): AmountMismatch | null =>
    deposit.receivingAmount !== null && deposit.receivingAmount !== deposit.amount
      ? { typed: deposit.amount, bank: deposit.receivingAmount }
      : null;

  const performApprove = async (deposit: Deposit, note?: string, amountOverride?: AmountOverrideDecision) => {
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
      // auto-credits that declared account on approval. The amount override
      // (credit what the bank saw, with a reason) rides in the same request.
      const updated = await depositService.approve(deposit.id, amountOverride);
      updateRows((rows) => rows.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      refetchStats();
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
    // mismatch against the bank) must be approved deliberately, with a note
    // — and a row whose bank amount differs from the typed one needs the
    // explicit "credit the bank amount" decision the server insists on.
    if (
      viewMatchStatus(toDepositVerification(deposit), now) === "SUSPICIOUS" ||
      amountMismatchOf(deposit) !== null
    ) {
      setApproveSuspiciousTarget(deposit);
      return;
    }
    void performApprove(deposit);
  };

  const handleReview = async (action: VerificationReviewAction, note: string) => {
    if (!verificationTarget) return;
    try {
      const updated = await depositService.reviewVerification(verificationTarget.id, action, note);
      updateRows((rows) => rows.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      refetchStats();
      toast.success(t.verification.actions.reviewedToast);
    } catch (err) {
      toast.error(t.verification.actions.reviewFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    }
  };

  const handleRejected = (updated: Deposit) => {
    updateRows((rows) => rows.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
    refetchStats();
  };

  const handleReceivingSaved = (updated: Deposit) => {
    updateRows((rows) => rows.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  };

  const handleManualSaved = (created: Deposit) => {
    // The new row lands in local state immediately (same idiom as the other
    // handlers) when the view shows it — it is created APPROVED and newest;
    // anywhere else the next fetch places it. The payment-accounts refetch
    // picks up the destination account's changed balance for the
    // receiving-account column labels.
    if (newRowFitsView(created.status)) updateRows((rows) => [created, ...rows]);
    refetchAccounts();
    refetchStats();
  };

  // Both places approve/reject: the row's buttons (the owner wants them in
  // sight) and the Verification Details modal, where the bank's side is on
  // screen. Same handlers, so the two can never disagree.
  const columns = getDepositColumns({
    t,
    types: types ?? [],
    paymentAccounts: paymentAccounts ?? [],
    actions: {
      canApprove: can("DEPOSITS.APPROVE"),
      canReject: can("DEPOSITS.REJECT"),
      onApprove: handleApprove,
      onReject: setRejectTarget,
      approvingId,
    },
    onReceivingSaved: handleReceivingSaved,
    onOpenVerification: (deposit) => setVerificationTargetId(deposit.id),
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

  // Lives right beside the table's search input (DataTable searchActions slot).
  const recordButton = canRecordDeposit ? (
    <Button className="shrink-0" onClick={() => setRecordOpen(true)}>
      <Plus className="size-4" />
      {t.deposits.manualDeposit.recordButton}
    </Button>
  ) : null;

  // Full-page empty state only for a genuinely empty, unfiltered queue — with
  // any range, tab or search active the table (and its toolbar) must stay
  // visible so the filter can be changed back.
  const isFiltered =
    !!range.from || !!range.to || statusFilter !== "ALL" || verification !== "all" || !!search;

  return (
    <RequirePermission
      permission="DEPOSITS.VIEW"
      title={t.deposits.page.title}
      description={t.deposits.page.description}
    >
      <div className="flex flex-col gap-6">
        {error ? (
          <ErrorState description={t.deposits.loadError} onRetry={refetch} />
        ) : !isLoading && total === 0 && !isFiltered ? (
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
                value={stats ? formatKyat(stats.byStatus.PENDING.amount) : "—"}
                icon={Clock}
                iconClassName="bg-pending/15 text-pending"
              />
              <DashboardCard
                title={t.deposits.approvedAmount}
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
                title={t.deposits.totalDeposits}
                value={stats ? stats.total.count.toLocaleString() : "—"}
                icon={ArrowDownToLine}
                iconClassName="bg-info/15 text-info"
              />
            </div>

            <div>
              <DataTable
                columns={columns}
                data={activeDeposits}
                isLoading={isLoading}
                pageSize={PAGE_LIMIT}
                manualPagination
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder={t.deposits.searchPlaceholder}
                searchActions={recordButton}
                toolbar={tableToolbar}
              />
              {!isLoading && (
                <ServerPagination page={page} pageSize={PAGE_LIMIT} total={total} onPageChange={setPage} />
              )}
            </div>
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
          amountMismatch={approveSuspiciousTarget ? amountMismatchOf(approveSuspiciousTarget) : null}
          onConfirm={(note, amountOverride) =>
            approveSuspiciousTarget && performApprove(approveSuspiciousTarget, note, amountOverride)
          }
        />
      </div>
    </RequirePermission>
  );
}
