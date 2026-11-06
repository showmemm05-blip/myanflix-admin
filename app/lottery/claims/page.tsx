"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, HandCoins, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { Button } from "@/components/ui/button";
import { ALL_DRAWS } from "@/components/lottery/analytics/DrawSelect";
import { updatedStamp } from "@/components/lottery/analytics/format";
import { ClaimReviewDialog } from "@/components/lottery/claims/ClaimReviewDialog";
import { ClaimsFilters } from "@/components/lottery/claims/ClaimsFilters";
import { ClaimsSummaryTiles } from "@/components/lottery/claims/ClaimsSummaryTiles";
import { getClaimColumns } from "@/components/lottery/claims/claimColumns";
import { claimDrawLabel, toClaimListStatus } from "@/components/lottery/claims/claimFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { lotteryService } from "@/services/api/lotteryService";
import type { LotteryAdminClaim, LotteryClaimListStatus } from "@/types/lottery";

/** Claim rows per server page — the backend's default. */
const PAGE_SIZE = 25;

/** The draw select offers this many of the newest draws — years of them at two a month. */
const DRAW_SELECT_SIZE = 100;

interface InitialParams {
  status: LotteryClaimListStatus;
  drawId: string;
  claimId: string | null;
}

/**
 * The deep links into this page: `?draw=<id>&status=<tab>` from the draw
 * page's strip, `?claim=<id>` from the audit log (opens the review dialog).
 * Read straight from window.location in a lazy initializer — the shell
 * never renders a page before the session is known, so there is no server
 * render to mismatch and no Suspense boundary to add.
 */
function readInitialParams(): InitialParams {
  if (typeof window === "undefined") return { status: "requested", drawId: ALL_DRAWS, claimId: null };
  const params = new URLSearchParams(window.location.search);
  return {
    status: toClaimListStatus(params.get("status")) ?? "requested",
    drawId: params.get("draw")?.trim() || ALL_DRAWS,
    claimId: params.get("claim")?.trim() || null,
  };
}

/** Drops a query param from the address without a navigation (a reload must not reopen a dialog the admin closed). */
function dropQueryParam(name: string) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState(null, "", url.toString());
}

/**
 * The Lottery "Prize claims" page (2026-10-24): one row per customer per
 * draw. Publishing a draw awards the prizes but pays nobody; the winner
 * requests payment in the app, and a staff member confirms the claim here
 * (one wallet credit, one LOTTERY_PRIZE row) or rejects it with a reason the
 * customer reads. There is no pay-all: the Waiting tab is worked one claim
 * at a time. LOTTERY.VIEW reads the page; Confirm and pay, Reject and Review
 * again need LOTTERY.CLAIMS_CONFIRM (the backend is the real gate).
 *
 * The tabs, the Draw select and the search all run on the SERVER (the list
 * is paged); the four tiles follow the Draw select so they match the rows.
 */
function ClaimsContent() {
  const { t } = useLanguage();
  const { can } = useRole();
  const canConfirm = can("LOTTERY.CLAIMS_CONFIRM");
  const c = t.lottery.claims;

  const [initial] = useState(readInitialParams);
  const [status, setStatus] = useState<LotteryClaimListStatus>(initial.status);
  const [drawId, setDrawId] = useState(initial.drawId);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = search.trim();
      if (next === appliedSearch) return;
      setPage(1);
      setAppliedSearch(next);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  // The address mirrors the tab and the draw, so the view in force can be
  // linked and survives a reload — the same params the draw page links with.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (drawId) url.searchParams.set("draw", drawId);
    else url.searchParams.delete("draw");
    if (status !== "requested") url.searchParams.set("status", status);
    else url.searchParams.delete("status");
    window.history.replaceState(null, "", url.toString());
  }, [status, drawId]);

  const draws = useAsyncData(() => lotteryService.listDraws({ page: 1, pageSize: DRAW_SELECT_SIZE }), []);
  // The load time rides with the tiles so "Updated …" is the moment these figures were read.
  const summary = useAsyncData(
    () => lotteryService.getClaimsSummary(drawId || undefined).then((data) => ({ data, loadedAt: Date.now() })),
    [drawId],
  );
  const list = useAsyncData(
    () =>
      lotteryService.listClaims({
        status,
        drawId: drawId || undefined,
        q: appliedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [status, drawId, appliedSearch, page],
  );
  // A claim decided elsewhere can leave a later page of the Waiting tab empty: step back to the last page that has rows.
  useClampPage({
    page,
    pageSize: PAGE_SIZE,
    rowCount: list.data?.items.length,
    total: list.data?.total,
    isLoading: list.isLoading,
    onPageChange: setPage,
  });

  const changeStatus = (next: LotteryClaimListStatus) => {
    setStatus(next);
    setPage(1);
  };
  const changeDraw = (next: string) => {
    setDrawId(next);
    setPage(1);
  };
  const showAll = () => {
    setStatus("all");
    setDrawId(ALL_DRAWS);
    setSearch("");
    setPage(1);
  };

  // The review dialog: a row from the table, or the id alone from a deep link.
  const [dialog, setDialog] = useState<{ row: LotteryAdminClaim | null; claimId: string | null } | null>(() =>
    initial.claimId ? { row: null, claimId: initial.claimId } : null,
  );
  const [dialogKey, setDialogKey] = useState(0);
  const openRow = (row: LotteryAdminClaim) => {
    setDialogKey((k) => k + 1);
    setDialog({ row, claimId: row.id });
  };
  const closeDialog = () => {
    setDialog(null);
    dropQueryParam("claim");
  };
  // Every decision reloads the rows and the tiles: the counts come from the server's copy, never from a guess.
  const handleChanged = () => {
    list.refetch();
    summary.refetch();
  };

  const drawList = draws.data?.items ?? null;
  const selectedDraw = drawList?.find((d) => d.id === drawId) ?? null;
  const drawText = selectedDraw ? claimDrawLabel(t, selectedDraw) : t.lottery.analytics.filters.allDraws;
  const dialogDraw = dialog?.row ? drawList?.find((d) => d.id === dialog.row?.drawId) ?? null : null;

  const columns = getClaimColumns({ t, onOpen: openRow });
  const rows = list.data?.items ?? [];
  const isEmpty = !list.isLoading && !list.error && list.data?.total === 0;
  const filtered = status !== "all" || !!drawId || !!appliedSearch;
  const empty = appliedSearch
    ? { title: c.empty.searchTitle, description: c.empty.searchDescription(appliedSearch, drawText) }
    : drawId
      ? { title: c.empty[status].title, description: c.empty.inDraw(drawText) }
      : c.empty[status];
  const updated = summary.data ? c.updated(updatedStamp(t, summary.data.loadedAt)) : "…";

  return (
    <div>
      <PageHeader
        title={c.title}
        description={c.description}
        actions={
          selectedDraw ? (
            <Button variant="outline" render={<Link href={`/lottery/draws/${selectedDraw.id}`} />} nativeButton={false}>
              <CalendarDays className="size-4" />
              {c.openDraw(selectedDraw.drawNo)}
            </Button>
          ) : undefined
        }
      />
      <p className="-mt-3 mb-4 text-xs tabular-nums text-muted-foreground">
        {c.timezone} · {updated}
      </p>
      {!canConfirm && <p className="-mt-2 mb-4 text-sm text-muted-foreground">{c.readOnly}</p>}

      <div className="flex flex-col gap-4">
        <ClaimsSummaryTiles
          summary={summary.data?.data ?? null}
          isLoading={summary.isLoading}
          error={summary.error}
          onRetry={summary.refetch}
        />

        <ClaimsFilters
          status={status}
          onStatusChange={changeStatus}
          drawId={drawId}
          onDrawChange={changeDraw}
          draws={drawList}
          drawsError={!!draws.error}
          search={search}
          onSearchChange={setSearch}
        />

        {list.error ? (
          <ErrorState description={c.loadError} onRetry={list.refetch} />
        ) : isEmpty ? (
          <EmptyState
            icon={HandCoins}
            title={empty.title}
            description={empty.description}
            action={
              filtered ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={showAll}>
                    {c.empty.showAll}
                  </Button>
                  {appliedSearch && (
                    <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                      {c.empty.clearSearch}
                    </Button>
                  )}
                </div>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={rows}
              isLoading={list.isLoading}
              pageSize={PAGE_SIZE}
              manualPagination
              emptyState={<p className="text-sm text-muted-foreground">{c.empty.searchTitle}</p>}
            />
            {!list.isLoading && list.data && (
              <ServerPagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPageChange={setPage} />
            )}
          </>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          {c.permissionLine}
        </p>
      </div>

      {dialog && (
        <ClaimReviewDialog
          key={dialogKey}
          open
          onOpenChange={(open) => !open && closeDialog()}
          row={dialog.row}
          claimId={dialog.claimId}
          canConfirm={canConfirm}
          fallbackDeadlineAt={dialogDraw?.claimDeadlineAt ?? null}
          onChanged={handleChanged}
        />
      )}
    </div>
  );
}

export default function LotteryClaimsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission permission="LOTTERY.VIEW" title={t.lottery.claims.title} description={t.lottery.claims.description}>
      <ClaimsContent />
    </RequirePermission>
  );
}
