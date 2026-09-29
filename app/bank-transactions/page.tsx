"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, RotateCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { DateRangeFilter, todayStr, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { VerificationDetailsDialog } from "@/components/shared/VerificationDetailsDialog";
import { BankTransactionStateTabs } from "@/components/bank-transactions/StateFilterTabs";
import { BankTransactionDetailDialog } from "@/components/bank-transactions/BankTransactionDetailDialog";
import { BankTransactionScreenshotDialog } from "@/components/bank-transactions/BankTransactionScreenshotDialog";
import { getBankTransactionColumns } from "@/components/bank-transactions/columns";
import { endOfDayIso, startOfDayIso } from "@/components/tracking/trackingFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useNow } from "@/lib/hooks/use-now";
import { useRole } from "@/lib/context/role-context";
import { useLanguage } from "@/lib/context/language-context";
import { getSocket, onResync } from "@/lib/socket";
import {
  bankTransactionAccountLabel,
  localDayOf,
  matchesStateFilter,
  paymentAccountOptionLabel,
} from "@/lib/bank-transactions";
import { toDepositVerification, toWithdrawalVerification } from "@/lib/bank-verification";
import {
  mergeDepositVerification,
  mergeWithdrawalVerification,
  type DepositVerificationEvent,
  type WithdrawalVerificationEvent,
} from "@/lib/realtime-rows";
import { bankTransactionService, mapBankTransaction, type BackendBankTransaction } from "@/services/api/bankTransactionService";
import { depositService } from "@/services/api/depositService";
import { withdrawalService } from "@/services/api/withdrawalService";
import { paymentAccountService } from "@/services/api/paymentAccountService";
import type {
  BankTransaction,
  BankTransactionDirection,
  BankTransactionQuery,
  BankTransactionStateFilter,
} from "@/types/bank-transaction";
import type { VerificationReviewAction } from "@/types/bank-verification";
import type { Deposit } from "@/types/deposit";
import type { Withdrawal } from "@/types/withdrawal";
import { toast } from "sonner";

/**
 * Rows per server page. Like the audit log this feed only grows, so it is
 * paged on the server and DataTable's own client paging is switched off
 * (`pageSize` = the whole fetched page, footer replaced below).
 */
const PAGE_LIMIT = 50;

/** The server caps `total` here; the footer says "10,000+" past it. */
const TOTAL_CAP = 10_000;

type DirectionFilter = "" | BankTransactionDirection;

/** The deposit or withdrawal a row is linked to, fetched on demand for Verification Details. */
type LinkedRecord = { kind: "deposit"; row: Deposit } | { kind: "withdrawal"; row: Withdrawal };

function BankTransactionsContent() {
  const { t } = useLanguage();
  const { can } = useRole();
  const b = t.bankTransactions;
  // Drives the read-time UNCLAIMED derivation (48 h since the bank time).
  const now = useNow();

  const canViewScreenshot = can("BANK_TRANSACTIONS.BANK_EVIDENCE");
  const canOpenDeposit = can("DEPOSITS.VIEW");
  const canOpenWithdrawal = can("WITHDRAWALS.VIEW");

  // ---- filters (every one is a SERVER filter; any change restarts at page 1)
  const [page, setPage] = useState(1);
  // Default to TODAY so the page opens on the current day's transfers — and
  // so the capped count is rarely hit.
  const [range, setRange] = useState<DateRangeValue>(() => ({ from: todayStr(), to: todayStr() }));
  const [deviceSerial, setDeviceSerial] = useState("");
  const [accountId, setAccountId] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("");
  const [state, setState] = useState<BankTransactionStateFilter>("all");

  // Only DTO keys, and unused ones left `undefined` so apiClient drops them:
  // the backend answers 400 to any query param it does not know.
  const query: BankTransactionQuery = {
    page,
    limit: PAGE_LIMIT,
    deviceSerial: deviceSerial || undefined,
    paymentAccountId: accountId || undefined,
    direction: direction || undefined,
    state: state === "all" ? undefined : state,
    // LOCAL day boundaries as full ISO datetimes — a bare YYYY-MM-DD would be
    // parsed as UTC midnight and make the "to" day exclusive here.
    from: range.from ? startOfDayIso(range.from) : undefined,
    to: range.to ? endOfDayIso(range.to) : undefined,
  };

  const { data, isLoading, error, refetch } = useAsyncData(
    () => bankTransactionService.getAll(query),
    [page, range, deviceSerial, accountId, direction, state],
  );
  const { data: devices } = useAsyncData(() => bankTransactionService.getDevices(), []);
  const { data: paymentAccounts } = useAsyncData(() => paymentAccountService.getAccounts(), []);
  const { data: types } = useAsyncData(() => paymentAccountService.getTypes(), []);

  // Socket-local override of the fetched page (the deposits page idiom):
  // seeded from data.items on the first push, dropped on any filter change.
  const [rows, setRows] = useState<BankTransaction[] | null>(null);
  const activeRows = useMemo(() => rows ?? data?.items ?? [], [rows, data]);

  // True while a filter-change refetch is in flight — a socket row landing in
  // that window must NOT seed the local list from the closure-stale previous
  // filters' data (it would mask the refetched rows for the new filters).
  const refetchingRef = useRef(false);
  useEffect(() => {
    if (data) refetchingRef.current = false;
  }, [data]);

  /** Every filter setter goes through here: drop the local override, back to page 1. */
  const applyFilter = (apply: () => void) => {
    refetchingRef.current = true;
    setRows(null);
    setPage(1);
    apply();
  };
  const changePage = (next: number) => {
    refetchingRef.current = true;
    setRows(null);
    setPage(next);
  };

  // ---- dialogs
  const [screenshotId, setScreenshotId] = useState<string | null>(null);
  // The detail dialog is keyed by id and re-reads the row from `activeRows`
  // on every render, so a `bank-transaction.updated` push updates it while
  // open. `detailFetched` backs a deep link (`?id=`) to a row that is not on
  // the loaded page.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailFetched, setDetailFetched] = useState<BankTransaction | null>(null);
  const detailRow = useMemo(() => {
    if (!detailId) return null;
    return activeRows.find((r) => r.id === detailId) ?? (detailFetched?.id === detailId ? detailFetched : null);
  }, [activeRows, detailId, detailFetched]);

  const [linked, setLinked] = useState<LinkedRecord | null>(null);
  const [linkedLoadingId, setLinkedLoadingId] = useState<string | null>(null);

  /**
   * Deep link: /bank-transactions?id=<uuid> (the "Bank transaction" row in
   * Verification Details) opens that row's detail dialog once on mount. Read
   * straight from window.location instead of useSearchParams so this stays
   * additive — no Suspense boundary, no re-run when the param later changes.
   */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id")?.trim();
    if (!id) return;
    let cancelled = false;
    // Initializing state from an external system (the URL) on mount — the
    // documented exception to the derived-state rule this lint guards.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailId(id);
    bankTransactionService
      .getOne(id)
      .then((row) => {
        if (!cancelled) setDetailFetched(row);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDetailId(null);
        toast.error(b.detail.notFound, { description: err instanceof Error ? err.message : undefined });
      });
    return () => {
      cancelled = true;
    };
    // Mount-only by design (see above); `b` is a stable translation object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeDetail = () => {
    setDetailId(null);
    setDetailFetched(null);
    // Drop the deep-link param so a reload does not reopen a dialog the
    // admin already closed.
    const url = new URL(window.location.href);
    if (url.searchParams.has("id")) {
      url.searchParams.delete("id");
      window.history.replaceState(null, "", url.toString());
    }
  };

  // ---- live updates
  useEffect(() => {
    // Before the socket check: a reconnect or a tab coming back into view
    // must refetch even if the socket was not there when this ran.
    const stopResync = onResync(refetch);
    const socket = getSocket();
    if (!socket) return stopResync;

    /**
     * Does a pushed row belong under the ACTIVE filters? Every server filter
     * is re-checked here — serial, account, direction, state (with the 48 h
     * derivation against the wall clock) and the local-day range — otherwise
     * a socket row would appear under a filter that excludes it.
     */
    const passesFilters = (row: BankTransaction) => {
      if (deviceSerial && row.deviceSerial !== deviceSerial) return false;
      if (accountId && row.paymentAccountId !== accountId) return false;
      if (direction && row.direction !== direction) return false;
      if (!matchesStateFilter(row, state, Date.now())) return false;
      const day = localDayOf(row.occurredAt);
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
      return true;
    };

    const handleCreated = (payload: BackendBankTransaction) => {
      // Newest-first: a fresh row only belongs at the top of page 1.
      if (page !== 1) return;
      // Mid-refetch the fetched data still belongs to the previous filters —
      // skip; the in-flight fetch will include this row if it qualifies.
      if (refetchingRef.current) return;
      const row = mapBankTransaction(payload);
      if (!passesFilters(row)) return;
      setRows((prev) => {
        const base = prev ?? data?.items ?? [];
        // A re-post of a key the phone already stored is `updated`, but be
        // safe against a duplicate `created` too.
        return base.some((r) => r.id === row.id) ? base : [row, ...base];
      });
    };

    const handleUpdated = (payload: BackendBankTransaction) => {
      // Link/unlink/state change/screenshot attach. Merged by id; a row not
      // on this page is simply ignored (it will carry the values when it is
      // next fetched). The payload has no account join — keep the label.
      const row = mapBankTransaction(payload);
      const merge = (r: BankTransaction) => ({ ...r, ...row, paymentAccountLabel: row.paymentAccountLabel ?? r.paymentAccountLabel });
      setRows((prev) => (prev ?? data?.items ?? []).map((r) => (r.id === row.id ? merge(r) : r)));
      setDetailFetched((prev) => (prev && prev.id === row.id ? merge(prev) : prev));
    };

    // Keep an open Verification Details dialog current too — an unlink from
    // another session, or the matcher landing a screenshot.
    const handleDepositVerification = (event: DepositVerificationEvent) => {
      setLinked((prev) =>
        prev && prev.kind === "deposit" && prev.row.id === event.id
          ? { kind: "deposit", row: mergeDepositVerification(prev.row, event) }
          : prev,
      );
    };
    const handleWithdrawalVerification = (event: WithdrawalVerificationEvent) => {
      setLinked((prev) =>
        prev && prev.kind === "withdrawal" && prev.row.id === event.id
          ? { kind: "withdrawal", row: mergeWithdrawalVerification(prev.row, event) }
          : prev,
      );
    };

    socket.on("bank-transaction.created", handleCreated);
    socket.on("bank-transaction.updated", handleUpdated);
    socket.on("deposit.verification", handleDepositVerification);
    socket.on("withdrawal.verification", handleWithdrawalVerification);
    return () => {
      stopResync();
      socket.off("bank-transaction.created", handleCreated);
      socket.off("bank-transaction.updated", handleUpdated);
      socket.off("deposit.verification", handleDepositVerification);
      socket.off("withdrawal.verification", handleWithdrawalVerification);
    };
  }, [data, page, range, deviceSerial, accountId, direction, state, refetch]);

  // ---- linked deposit / withdrawal (Verification Details)
  const openLinked = async (tx: BankTransaction) => {
    setLinkedLoadingId(tx.id);
    try {
      if (tx.linkedDepositId) {
        setLinked({ kind: "deposit", row: await depositService.getOne(tx.linkedDepositId) });
      } else if (tx.linkedWithdrawalId) {
        setLinked({ kind: "withdrawal", row: await withdrawalService.getOne(tx.linkedWithdrawalId) });
      }
    } catch (err) {
      toast.error(b.linkedLoadError, { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLinkedLoadingId(null);
    }
  };

  const handleLinkedReview = async (action: VerificationReviewAction, note: string) => {
    if (!linked) return;
    try {
      if (linked.kind === "deposit") {
        setLinked({ kind: "deposit", row: await depositService.reviewVerification(linked.row.id, action, note) });
      } else {
        setLinked({ kind: "withdrawal", row: await withdrawalService.reviewVerification(linked.row.id, action, note) });
      }
      toast.success(t.verification.actions.reviewedToast);
    } catch (err) {
      toast.error(t.verification.actions.reviewFailedToast, {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    }
  };

  // ---- derived view state
  // Tab counts from the loaded page. On "All" every tab is countable; on a
  // specific tab only its own rows are loaded, so the rest show no number.
  const stateCounts = useMemo<Partial<Record<BankTransactionStateFilter, number>>>(() => {
    if (state !== "all") return { [state]: activeRows.length };
    return {
      all: activeRows.length,
      unmatched: activeRows.filter((r) => matchesStateFilter(r, "unmatched", now)).length,
      matched: activeRows.filter((r) => matchesStateFilter(r, "matched", now)).length,
      ambiguous: activeRows.filter((r) => matchesStateFilter(r, "ambiguous", now)).length,
      unclaimed: activeRows.filter((r) => matchesStateFilter(r, "unclaimed", now)).length,
    };
  }, [activeRows, state, now]);

  const total = data?.total ?? 0;
  const totalCapped = data?.totalCapped ?? false;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const lastRow = Math.min(page * PAGE_LIMIT, total);

  const columns = getBankTransactionColumns({
    t,
    paymentAccounts: paymentAccounts ?? [],
    types: types ?? [],
    canViewScreenshot,
    canOpenDeposit,
    canOpenWithdrawal,
    onViewScreenshot: (row) => setScreenshotId(row.id),
    onOpenLinked: openLinked,
    onViewDetails: (row) => setDetailId(row.id),
    linkedLoadingId,
    now,
  });

  // ---- filter controls (Select items follow the audit page's `items` map idiom)
  const phoneItems: Record<string, string> = {
    "": b.filters.allPhones,
    ...Object.fromEntries((devices ?? []).map((d) => [d.deviceSerial, d.deviceSerial])),
    // A serial that is filtered on but not (yet) in the devices list still
    // needs a label for the trigger.
    ...(deviceSerial && !(devices ?? []).some((d) => d.deviceSerial === deviceSerial)
      ? { [deviceSerial]: deviceSerial }
      : {}),
  };
  const accountItems: Record<string, string> = {
    "": b.filters.allAccounts,
    ...Object.fromEntries((paymentAccounts ?? []).map((a) => [a.id, paymentAccountOptionLabel(a, types ?? [])])),
  };
  const directionItems: Record<string, string> = {
    "": b.filters.allDirections,
    RECEIVED: b.filters.received,
    SENT: b.filters.sent,
  };

  // Shared by the loaded AND loading DataTable branches so the controls never
  // unmount mid-interaction while a refetch is in flight.
  const tableToolbar = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={phoneItems}
          value={deviceSerial}
          onValueChange={(next) => applyFilter(() => setDeviceSerial((next as string | null) ?? ""))}
        >
          <SelectTrigger size="sm" className="w-52" aria-label={b.filters.phone}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{b.filters.allPhones}</SelectItem>
            {(devices ?? []).map((d) => (
              <SelectItem key={d.deviceSerial} value={d.deviceSerial}>
                <span className="flex flex-col">
                  <span className="font-mono text-xs">{d.deviceSerial}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {d.lastSeenAt ? b.lastSeen(format(new Date(d.lastSeenAt), "d MMM, HH:mm")) : b.neverSeen}
                    {` · ${d.last24hCount} / ${d.totalCapped ? `${d.total}+` : d.total}`}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={accountItems}
          value={accountId}
          onValueChange={(next) => applyFilter(() => setAccountId((next as string | null) ?? ""))}
        >
          <SelectTrigger size="sm" className="w-44" aria-label={b.filters.account}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{b.filters.allAccounts}</SelectItem>
            {(paymentAccounts ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {paymentAccountOptionLabel(a, types ?? [])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={directionItems}
          value={direction}
          onValueChange={(next) => applyFilter(() => setDirection(((next as string | null) ?? "") as DirectionFilter))}
        >
          <SelectTrigger size="sm" className="w-36" aria-label={b.filters.direction}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{b.filters.allDirections}</SelectItem>
            <SelectItem value="RECEIVED">{b.filters.received}</SelectItem>
            <SelectItem value="SENT">{b.filters.sent}</SelectItem>
          </SelectContent>
        </Select>

        <BankTransactionStateTabs
          value={state}
          onValueChange={(next) => applyFilter(() => setState(next))}
          counts={stateCounts}
        />
        <DateRangeFilter value={range} onChange={(next) => applyFilter(() => setRange(next))} />
      </div>
      {/* The two tabs whose meaning is not obvious from their name carry a one-line explanation. */}
      {state === "unclaimed" && <p className="text-xs text-muted-foreground">{b.unclaimedHint}</p>}
      {state === "ambiguous" && <p className="text-xs text-muted-foreground">{b.ambiguousHint}</p>}
    </div>
  );

  const linkedRecord = linked
    ? linked.kind === "deposit"
      ? toDepositVerification(linked.row)
      : toWithdrawalVerification(linked.row)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={b.title}
        description={b.description}
        actions={
          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RotateCw className="size-4" />
            {isLoading ? t.audit.refreshing : t.audit.refresh}
          </Button>
        }
      />

      {error ? (
        <ErrorState description={b.loadError} onRetry={refetch} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={activeRows}
            isLoading={isLoading}
            pageSize={PAGE_LIMIT}
            hideFooter
            searchKey="txCode"
            searchPlaceholder={b.searchPlaceholder}
            toolbar={tableToolbar}
            emptyState={<EmptyState icon={Smartphone} title={b.title} description={b.empty} />}
          />
          {!isLoading && total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm tabular-nums text-muted-foreground">
                {t.shared.showingResults(firstRow, lastRow, total)}
                {totalCapped && total >= TOTAL_CAP && (
                  <span className="ml-2 text-warning">{b.totalCapped}</span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => changePage(Math.max(1, page - 1))} disabled={page <= 1}>
                  <ChevronLeft className="size-4" />
                  {t.shared.previous}
                </Button>
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {t.shared.pageOf(page, totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changePage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                >
                  {t.shared.next}
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <BankTransactionScreenshotDialog
        transactionId={screenshotId}
        open={screenshotId !== null}
        onOpenChange={(open) => !open && setScreenshotId(null)}
      />

      <BankTransactionDetailDialog
        row={detailRow}
        open={detailId !== null}
        onOpenChange={(open) => !open && closeDetail()}
        now={now}
        accountLabel={detailRow ? bankTransactionAccountLabel(detailRow, paymentAccounts ?? [], types ?? []) : null}
        canViewScreenshot={canViewScreenshot}
        canOpenLinked={detailRow?.linkedDepositId ? canOpenDeposit : canOpenWithdrawal}
        linkedLoading={detailRow !== null && linkedLoadingId === detailRow.id}
        onOpenLinked={openLinked}
      />

      {/* The linked deposit/withdrawal in the same Verification Details the
          queues use. Review actions (clear / confirm suspicious / unlink) work
          from here; Approve/Reject stay on the queue pages, which own the
          suspicious-approve confirm and the reject-reason dialog. */}
      <VerificationDetailsDialog
        record={linkedRecord}
        now={now}
        open={linked !== null}
        onOpenChange={(open) => !open && setLinked(null)}
        paymentAccounts={paymentAccounts ?? []}
        types={types ?? []}
        canReview={linked?.kind === "withdrawal" ? can("WITHDRAWALS.EDIT") : can("DEPOSITS.EDIT")}
        canViewScreenshot={
          linked?.kind === "withdrawal" ? can("WITHDRAWALS.BANK_EVIDENCE") : can("DEPOSITS.BANK_EVIDENCE")
        }
        canApprove={false}
        canReject={false}
        approving={false}
        onReview={handleLinkedReview}
        onApprove={() => undefined}
        onReject={() => undefined}
        fetchScreenshot={
          linked?.kind === "withdrawal" ? withdrawalService.fetchBankScreenshot : depositService.fetchBankScreenshot
        }
      />
    </div>
  );
}

export default function BankTransactionsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission
      permission="BANK_TRANSACTIONS.VIEW"
      title={t.bankTransactions.title}
      description={t.bankTransactions.description}
    >
      <BankTransactionsContent />
    </RequirePermission>
  );
}
