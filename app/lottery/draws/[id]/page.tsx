"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CalendarX,
  Coins,
  HandCoins,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Square,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DrawEditDialog } from "@/components/lottery/DrawEditDialog";
import { TicketPreview } from "@/components/lottery/TicketPreview";
import { OffSaleNumbersCard } from "@/components/lottery/OffSaleNumbersCard";
import { ResultsCard } from "@/components/lottery/ResultsCard";
import { DrawWinnersTable } from "@/components/lottery/DrawWinnersTable";
import { drawClaimsHref } from "@/components/lottery/claims/DrawClaimsStrip";
import { getDrawTicketColumns } from "@/components/lottery/drawTicketColumns";
import {
  DRAW_STATUS_TONES,
  canCloseDraw,
  canOpenDraw,
  canPauseDraw,
  canReopenDraw,
  formatRate,
  isDrawNotFound,
  isDrawStateError,
  isSalesCloseElapsed,
  lotteryErrorMessage,
  reopenBlockReason,
} from "@/components/lottery/drawFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useNow } from "@/lib/hooks/use-now";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { formatKyat } from "@/lib/currency";
import { formatDateOnly, formatMmt } from "@/lib/myanmar-time";
import { lotteryService } from "@/services/api/lotteryService";
import type { LotteryDrawResults } from "@/types/lottery";

/** Ticket rows per server page: a draw can sell thousands, so they are paged on the server. */
const PAGE_SIZE = 25;

type DrawAction = "open" | "pause" | "close" | "reopen";

/** One label-over-value cell of the draw card. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * One draw (2026-10-19): its counters, its card with Edit and the sales
 * actions (open, pause, close, and reopen for a closed draw whose closing
 * time is still ahead and whose sheet is not in), its off-sale numbers, its
 * results (the winning numbers, the rate and Publish — phase 3; since
 * 2026-10-24 publishing awards the prizes without paying them, and the card
 * shows how the claims stand), its winners once published, and every ticket
 * sold in it. LOTTERY.VIEW reads, LOTTERY.DRAWS_MANAGE changes the draw,
 * LOTTERY.RESULTS_PUBLISH fetches, enters and publishes the results; the
 * backend audits every change and refuses an action the draw's state does
 * not allow (409), in which case the page reloads the draw.
 *
 * Times are Myanmar time (labelled MMT); the backend stores UTC.
 */
function DrawDetailContent({ id }: { id: string }) {
  const { t } = useLanguage();
  const { can } = useRole();
  const canManage = can("LOTTERY.DRAWS_MANAGE");
  const canPublish = can("LOTTERY.RESULTS_PUBLISH");
  const d = t.lottery.draws;
  const dd = d.detail;
  // Drives "can sales still open" without reading the clock in render.
  const now = useNow();

  // The draw (cards, actions) and its tickets (paged) load separately, so
  // turning a ticket page never blanks the draw card.
  const {
    data: draw,
    isLoading: drawLoading,
    error: drawError,
    refetch: refetchDraw,
  } = useAsyncData(() => lotteryService.getDraw(id), [id]);

  // The settings feed the results card its rate prefill and whether a
  // results URL is set. A refused read (null) only leaves the rate field
  // empty — it never blocks the page.
  const { data: settings } = useAsyncData(
    () => lotteryService.getSettings().catch(() => null),
    [],
  );

  const [page, setPage] = useState(1);
  // Server search over the ticket ID, the number, the purchase ref and the
  // customer — the tickets are paged, so a filter over the loaded page
  // would hide every match past it.
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

  const {
    data: tickets,
    isLoading: ticketsLoading,
    error: ticketsError,
    refetch: refetchTickets,
  } = useAsyncData(
    () =>
      lotteryService.listDrawTickets(id, {
        q: appliedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [id, appliedSearch, page],
  );
  useClampPage({
    page,
    pageSize: PAGE_SIZE,
    rowCount: tickets?.items.length,
    total: tickets?.total,
    isLoading: ticketsLoading,
    onPageChange: setPage,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<DrawAction | null>(null);
  const [acting, setActing] = useState(false);
  // The results record as the Results card loaded it (null until then):
  // Reopen is refused once a sheet is in, and entering one by hand changes
  // nothing on the draw, so the card reports every load up here.
  const [results, setResults] = useState<LotteryDrawResults | null>(null);
  // Bumped on a refused transition: a sheet that landed since the page
  // loaded leaves the draw CLOSED, so the draw reload alone would not
  // remount the Results card; the key change makes it reload the record.
  const [resultsKey, setResultsKey] = useState(0);

  const openEdit = () => {
    setEditKey((k) => k + 1);
    setEditOpen(true);
  };

  // Every change reloads the draw: the counters, the status and the locks
  // all come from the server's copy, never from a guess.
  const handleChanged = () => refetchDraw();

  const runAction = async () => {
    if (!draw || !pendingAction) return;
    setActing(true);
    try {
      if (pendingAction === "open") await lotteryService.openDraw(draw.id);
      else if (pendingAction === "pause")
        await lotteryService.pauseDraw(draw.id);
      else if (pendingAction === "close")
        await lotteryService.closeDraw(draw.id);
      else await lotteryService.reopenDraw(draw.id);
      toast.success(
        pendingAction === "open"
          ? dd.openedToast
          : pendingAction === "pause"
            ? dd.pausedToast
            : pendingAction === "close"
              ? dd.closedToast
              : dd.reopenedToast,
      );
      setPendingAction(null);
      refetchDraw();
    } catch (err) {
      toast.error(dd.actionFailedToast, {
        description: lotteryErrorMessage(err, t),
      });
      // The draw is not in the state this page showed: reload it, and
      // the results record with it (a sheet in means Reopen stays hidden).
      if (isDrawStateError(err)) {
        setPendingAction(null);
        setResultsKey((k) => k + 1);
        refetchDraw();
      }
    } finally {
      setActing(false);
    }
  };

  const backButton = (
    <Button
      variant="outline"
      render={<Link href="/lottery/draws" />}
      nativeButton={false}
    >
      <ArrowLeft className="size-4" />
      {dd.backToList}
    </Button>
  );

  if (drawLoading) {
    return (
      <div>
        <PageHeader title={d.title} actions={backButton} />
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  if (drawError || !draw) {
    return (
      <div>
        <PageHeader title={d.title} actions={backButton} />
        {drawError && !isDrawNotFound(drawError) ? (
          <ErrorState description={dd.loadError} onRetry={refetchDraw} />
        ) : (
          <EmptyState
            icon={CalendarX}
            title={dd.notFoundTitle}
            description={dd.notFoundDescription}
            action={backButton}
          />
        )}
      </div>
    );
  }

  const published = draw.status === "published";
  const showOpen = draw.status === "scheduled" || draw.status === "paused";
  const openBlocked = showOpen && isSalesCloseElapsed(draw, now);
  // A closed draw: the button while it may reopen (waiting for the results
  // record before it is clickable), else the reason as a muted line.
  const showReopen = canReopenDraw(draw, now, results);
  const reopenBlock = reopenBlockReason(draw, now, results);
  const confirmTitle =
    pendingAction === "open"
      ? dd.confirm.openTitle
      : pendingAction === "pause"
        ? dd.confirm.pauseTitle
        : pendingAction === "close"
          ? dd.confirm.closeTitle
          : dd.confirm.reopenTitle;
  const confirmDescription =
    pendingAction === "open"
      ? dd.confirm.openDescription(draw.drawNo, formatMmt(draw.salesCloseAt))
      : pendingAction === "pause"
        ? dd.confirm.pauseDescription(draw.drawNo)
        : pendingAction === "close"
          ? dd.confirm.closeDescription(draw.drawNo)
          : dd.confirm.reopenDescription(
              draw.drawNo,
              formatMmt(draw.salesCloseAt),
            );

  const ticketColumns = getDrawTicketColumns({ t });
  const ticketRows = tickets?.items ?? [];
  const noTicketsAtAll =
    !ticketsLoading && !ticketsError && tickets?.total === 0 && !appliedSearch;

  return (
    <div>
      <PageHeader
        title={d.drawLabel(draw.drawNo)}
        description={formatDateOnly(draw.thaiDrawDate)}
        actions={
          <>
            {backButton}
            {/* Once published, the way to this draw's prize claims (the Waiting tab, filtered to it). */}
            {published && (
              <Button render={<Link href={drawClaimsHref(draw.id)} />} nativeButton={false}>
                <HandCoins className="size-4" />
                {dd.results.claims.headerButton}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-3${published ? " lg:grid-cols-5" : ""}`}
        >
          <DashboardCard
            title={dd.ticketsSoldCard}
            value={draw.ticketsSold.toLocaleString("en-US")}
            icon={Ticket}
          />
          <DashboardCard
            title={dd.revenueCard}
            value={formatKyat(draw.revenueKs)}
            icon={Banknote}
            iconClassName="bg-income/15 text-income"
          />
          <DashboardCard
            title={dd.buyersCard}
            value={draw.buyers.toLocaleString("en-US")}
            icon={Users}
          />
          {/* The payout counters exist only once the draw is published (null before). "Prizes paid" is money actually paid: it grows one confirmed claim at a time. */}
          {published && (
            <>
              <DashboardCard
                title={dd.winnersCard}
                value={(draw.winnersCount ?? 0).toLocaleString("en-US")}
                icon={Trophy}
                iconClassName="bg-warning/15 text-warning"
              />
              <DashboardCard
                title={dd.prizesPaidCard}
                value={formatKyat(draw.prizesPaidKs ?? 0)}
                icon={Coins}
              />
            </>
          )}
        </div>

        <Card className="glass-card">
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-start">
            {/* The sample ticket as the apps print it for this draw: its own frame (built-in when null) and picture (the default art when null). */}
            <TicketPreview
              frameUrl={draw.frameUrl}
              pictureUrl={draw.pictureUrl}
              draw={draw}
              label={dd.ticketPreview(draw.drawNo)}
              className="shrink-0 md:w-[28rem]"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{dd.drawCardTitle}</h2>
                <StatusBadge
                  label={d.statuses[draw.status]}
                  tone={DRAW_STATUS_TONES[draw.status]}
                />
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label={dd.thaiDrawDate}
                  value={formatDateOnly(draw.thaiDrawDate)}
                />
                <Field
                  label={dd.drawAt}
                  value={`${formatMmt(draw.drawAt)} ${d.mmt}`}
                />
                <Field
                  label={dd.salesCloseAt}
                  value={`${formatMmt(draw.salesCloseAt)} ${d.mmt}`}
                />
                <Field
                  label={dd.ticketPrice}
                  value={formatKyat(draw.ticketPrice)}
                />
                <Field
                  label={dd.maxPerNumber}
                  value={String(draw.maxPerNumber)}
                />
                <Field
                  label={dd.exchangeRate}
                  value={
                    draw.exchangeRate === null
                      ? dd.exchangeRateUnset
                      : dd.exchangeRateValue(formatRate(draw.exchangeRate))
                  }
                />
                {draw.openedAt && (
                  <Field
                    label={dd.openedAt}
                    value={`${formatMmt(draw.openedAt)} ${d.mmt}`}
                  />
                )}
                {draw.closedAt && (
                  <Field
                    label={dd.closedAt}
                    value={`${formatMmt(draw.closedAt)} ${d.mmt}`}
                  />
                )}
                {draw.publishedAt && (
                  <Field
                    label={dd.publishedAt}
                    value={`${formatMmt(draw.publishedAt)} ${d.mmt}`}
                  />
                )}
              </dl>
              {canManage && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={openEdit}>
                      <Pencil className="size-4" />
                      {dd.edit}
                    </Button>
                    {showOpen && (
                      <Button
                        size="sm"
                        disabled={!canOpenDraw(draw, now)}
                        onClick={() => setPendingAction("open")}
                      >
                        <Play className="size-4" />
                        {dd.actions.open}
                      </Button>
                    )}
                    {canPauseDraw(draw) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingAction("pause")}
                      >
                        <Pause className="size-4" />
                        {dd.actions.pause}
                      </Button>
                    )}
                    {canCloseDraw(draw) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setPendingAction("close")}
                      >
                        <Square className="size-4" />
                        {dd.actions.close}
                      </Button>
                    )}
                    {showReopen && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={results === null}
                        onClick={() => setPendingAction("reopen")}
                      >
                        <RotateCcw className="size-4" />
                        {dd.actions.reopen}
                      </Button>
                    )}
                  </div>
                  {openBlocked && (
                    <p className="text-xs text-warning">{dd.cannotOpenPast}</p>
                  )}
                  {reopenBlock && (
                    <p className="text-xs text-muted-foreground">
                      {reopenBlock === "past"
                        ? dd.cannotReopenPast
                        : dd.cannotReopenResults}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <OffSaleNumbersCard
          // Remount on every server copy, so the chips restart from what is stored.
          key={`${draw.updatedAt}:${(draw.offSaleNumbers ?? []).join(",")}`}
          drawId={draw.id}
          numbers={draw.offSaleNumbers ?? []}
          canManage={canManage}
          onSaved={handleChanged}
        />

        <ResultsCard
          // Remount when the draw moves (closed → published) or a transition was refused, so the card's record, rate and dialogs restart from the server's copy.
          key={`${draw.status}:${draw.publishedAt ?? ""}:${resultsKey}`}
          draw={draw}
          settings={settings}
          canPublish={canPublish}
          onDrawChanged={handleChanged}
          onResultsChanged={setResults}
        />

        {published && <DrawWinnersTable drawId={draw.id} />}

        <div>
          <h2 className="mb-1 text-lg font-semibold">{dd.tickets.title}</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {dd.tickets.description}
          </p>
          {ticketsError ? (
            <ErrorState
              description={dd.tickets.loadError}
              onRetry={refetchTickets}
            />
          ) : noTicketsAtAll ? (
            <EmptyState icon={Ticket} title={dd.tickets.empty} />
          ) : (
            <>
              <DataTable
                columns={ticketColumns}
                data={ticketRows}
                isLoading={ticketsLoading}
                pageSize={PAGE_SIZE}
                manualPagination
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder={dd.tickets.searchPlaceholder}
                emptyState={
                  <p className="text-sm text-muted-foreground">
                    {dd.tickets.noMatches}
                  </p>
                }
              />
              {!ticketsLoading && tickets && (
                <ServerPagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={tickets.total}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </div>
      </div>

      {canManage && editOpen && (
        <DrawEditDialog
          key={editKey}
          open={editOpen}
          onOpenChange={setEditOpen}
          draw={draw}
          onSaved={handleChanged}
        />
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && !acting && setPendingAction(null)}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={pendingAction ? dd.actions[pendingAction] : undefined}
        variant={pendingAction === "close" ? "destructive" : "default"}
        loading={acting}
        onConfirm={runAction}
      />
    </div>
  );
}

export default function LotteryDrawDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLanguage();
  return (
    <RequirePermission
      permission="LOTTERY.VIEW"
      title={t.lottery.draws.title}
      description={t.lottery.draws.description}
    >
      <DrawDetailContent id={id} />
    </RequirePermission>
  );
}
