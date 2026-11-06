"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { FileBarChart, Ticket } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityChart } from "@/components/lottery/analytics/ActivityChart";
import { BusiestDaysCard } from "@/components/lottery/analytics/BusiestDaysCard";
import { DefinitionsCard } from "@/components/lottery/analytics/DefinitionsCard";
import { ALL_DRAWS, DrawSelect } from "@/components/lottery/analytics/DrawSelect";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { OverviewCards, OverviewCardsSkeleton } from "@/components/lottery/analytics/OverviewCards";
import { PeriodChips } from "@/components/lottery/analytics/PeriodChips";
import { PopularNumbersCard } from "@/components/lottery/analytics/PopularNumbersCard";
import { ViewSwitch } from "@/components/lottery/analytics/ViewSwitch";
import { csvFileName, csvPct, csvText, downloadCsv, type CsvValue } from "@/components/lottery/analytics/csv";
import {
  compareText,
  comparisonWords,
  dashboardRangeText,
  drawOptionLabel,
  drawShortLabel,
  formatRange,
  updatedStamp,
} from "@/components/lottery/analytics/format";
import { buildOverviewCards, comparisonCovered } from "@/components/lottery/analytics/overviewModel";
import {
  DASHBOARD_PERIODS,
  type DashboardPeriodKey,
  type DateRange,
  daySpan,
  effectiveChartView,
  mmtDateOfIso,
  mmtToday,
  previousRange,
  resolveDashboardPeriod,
  viewAvailability,
} from "@/components/lottery/analytics/period";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useNow } from "@/lib/hooks/use-now";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { lotteryService } from "@/services/api/lotteryService";
import {
  LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE,
  type LotteryAnalyticsActivity,
  type LotteryAnalyticsChartView,
  type LotteryAnalyticsTotals,
} from "@/types/lottery-analytics";

/** The draw select offers this many of the newest draws — years of them at two a month. */
const DRAW_SELECT_SIZE = 100;

/** The board's lower row: Busiest days (1fr) beside How these are counted (1.6fr). */
const LOWER_ROW = "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]";

/** A labelled group in the filter bar: "Period", "Draw", "View". */
function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * The Lottery analytics dashboard (2026-10-23): period chips, the draw
 * select and the Hourly/Daily/Weekly view over the six overview cards, the
 * activity chart, the most popular numbers, the busiest days and the
 * definitions card. Every date is a Myanmar calendar day worked out in the
 * browser (period.ts); the backend aggregates. Each card loads on its own,
 * so a slow numbers query never blanks the cards above it; only the
 * overview failing takes the whole page to the error state, because every
 * other card's words (the comparison, the draw) come from it.
 *
 * Skeletons are for the FIRST load only. A filter change keeps the drawn
 * page in place at reduced opacity (aria-busy) until the new slice lands —
 * the boards' "refreshing" state — so nothing jumps.
 */
function AnalyticsContent() {
  const { t } = useLanguage();
  const a = t.lottery.analytics;
  // Ticks every minute: today's "to 3:40 PM" and the still-to-come hours move with it.
  const now = useNow();

  const [periodKey, setPeriodKey] = useState<DashboardPeriodKey>("last7");
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [drawId, setDrawId] = useState(ALL_DRAWS);
  // The view asked for; the chart draws the widest one the period allows (effectiveChartView).
  const [view, setView] = useState<LotteryAnalyticsChartView>("hourly");

  const today = mmtToday(now);
  const range = resolveDashboardPeriod(periodKey, custom, now);
  const days = daySpan(range);
  const chartView = effectiveChartView(view, days);
  const query = { from: range.from, to: range.to, drawId: drawId || undefined };
  const queryDeps = [range.from, range.to, drawId];

  const draws = useAsyncData(() => lotteryService.listDraws({ page: 1, pageSize: DRAW_SELECT_SIZE }), []);
  // The load time rides with the data so "Updated …" is the moment these figures were read, not a render.
  const overview = useAsyncData(
    () => lotteryService.getAnalyticsOverview(query).then((data) => ({ data, loadedAt: Date.now() })),
    queryDeps,
  );
  const hourly = useAsyncData(() => lotteryService.getAnalyticsActivity({ ...query, view: "hourly" }), queryDeps);
  // The drawn view when it is not the hourly one already in hand.
  const viewSeries = useAsyncData(
    () => (chartView === "hourly" ? Promise.resolve(null) : lotteryService.getAnalyticsActivity({ ...query, view: chartView })),
    [...queryDeps, chartView],
  );
  const weekday = useAsyncData(() => lotteryService.getAnalyticsActivity({ ...query, view: "weekday" }), queryDeps);

  const ov = overview.data?.data ?? null;
  // The first sale ever — of the selected draw when one is selected (the backend scopes it).
  const firstSaleDate = mmtDateOfIso(ov?.firstPurchaseAt);
  const drawList = draws.data?.items ?? null;
  const selectedDraw = drawList?.find((d) => d.id === drawId) ?? null;
  const drawText = selectedDraw ? drawOptionLabel(t, selectedDraw) : a.filters.allDraws;
  const rangeText = dashboardRangeText(t, periodKey, range, now);
  const compare = ov ? compareText(t, periodKey, range, firstSaleDate, selectedDraw ? drawShortLabel(t, selectedDraw.drawNo) : null) : null;
  const viewNote =
    chartView === view
      ? null
      : view === "weekly"
        ? chartView === "daily"
          ? a.filters.fallback.weeklyDaily
          : a.filters.fallback.weeklyHourly
        : a.filters.fallback.dailyHourly;

  const words = comparisonWords(t, periodKey, range);
  const covered = ov ? comparisonCovered(firstSaleDate, ov.range.previousFrom) : false;
  const cards = ov ? buildOverviewCards(t, ov, words, covered) : null;
  const tracked = ov?.activity.trackedInRange ?? false;
  const isEmpty = ov !== null && ov.current.ticketsSold === 0;
  // Only a series of the drawn view is drawn: a daily series must never be read as weeks while weeks load.
  const chartActivity: LotteryAnalyticsActivity | null =
    chartView === "hourly" ? hourly.data : viewSeries.data?.view === chartView ? viewSeries.data : null;
  const chartLoading = chartView === "hourly" ? hourly.isLoading : viewSeries.isLoading;
  const chartError = chartView === "hourly" ? hourly.error : viewSeries.error;
  const retryChart = () => (chartView === "hourly" ? hourly.refetch() : viewSeries.refetch());

  const retryAll = () => {
    overview.refetch();
    hourly.refetch();
    viewSeries.refetch();
    weekday.refetch();
  };

  /** One file for the whole page: a `section` column tells the overview, the activity, the numbers and the days apart. */
  const exportAll = async () => {
    if (!ov) throw new Error(a.states.cardError);
    const numbers = await lotteryService.getAnalyticsNumbers({
      ...query,
      sort: "tickets",
      order: "desc",
      page: 1,
      pageSize: LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE,
    });
    // Lottery numbers go through csvText so a spreadsheet keeps 000007 as text.
    const totals = (section: string, key: string, x: LotteryAnalyticsTotals): CsvValue[] => [
      section, key, x.ticketsSold, x.purchases, "", "", x.buyers, x.revenueKs, x.popularNumber ? csvText(x.popularNumber.number) : "", x.peakHour?.hour ?? "", x.avgTicketsPerPurchase ?? "", "", "", "",
    ];
    const buckets = (section: string, series: LotteryAnalyticsActivity | null): CsvValue[][] =>
      (series?.buckets ?? []).map((b) => [section, b.key, b.ticketsSold, b.purchases, b.purchasingUsers, b.activeUsers ?? "", "", "", "", "", "", "", "", ""]);
    const rows: CsvValue[][] = [
      totals("overview", "current", ov.current),
      totals("overview", "previous", ov.previous),
      ...buckets("activity-hourly", hourly.data),
      ...(chartView !== "hourly" ? buckets(`activity-${chartView}`, chartActivity) : []),
      ...buckets("busiest-days", weekday.data),
      ...numbers.items.map((r): CsvValue[] => [
        "popular-numbers", csvText(r.number), r.tickets, "", "", "", r.buyers, "", "", "", "", csvPct(r.share), r.trend.changePct === null ? "" : csvPct(r.trend.changePct), r.repeatBuyers,
      ]),
    ];
    const file = csvFileName("lottery-analytics", range);
    downloadCsv(
      file,
      ["section", "key", "tickets_sold", "purchases", "purchasing_users", "active_users", "buyers", "revenue_ks", "popular_number", "peak_hour_mmt", "avg_tickets_per_purchase", "share_pct", "change_pct", "repeat_buyers"],
      rows,
    );
    return file;
  };

  const updated = overview.data ? a.updated(updatedStamp(t, overview.data.loadedAt)) : "…";

  return (
    <div>
      <PageHeader
        title={a.title}
        description={`${a.reportingTime} · ${updated}`}
        actions={
          <>
            <Button variant="outline" render={<Link href="/lottery/analytics/reports" />} nativeButton={false}>
              <FileBarChart className="size-4" />
              {a.reportsButton}
            </Button>
            <ExportButton onExport={exportAll} disabled={!ov || isEmpty} size="sm" numbersAsText />
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterGroup label={a.filters.period}>
              <PeriodChips
                keys={DASHBOARD_PERIODS}
                value={periodKey}
                custom={custom}
                today={today}
                compared
                onChange={(key, nextCustom) => {
                  if (nextCustom) setCustom(nextCustom);
                  setPeriodKey(key);
                }}
              />
            </FilterGroup>
            <FilterGroup label={a.filters.draw}>
              <DrawSelect draws={drawList} value={drawId} onChange={setDrawId} />
            </FilterGroup>
            <FilterGroup label={a.filters.view}>
              {/* The pressed segment is the view actually DRAWN; `view` stays the remembered wish (viewNote explains the fallback). */}
              <ViewSwitch value={chartView} onChange={setView} availability={viewAvailability(days)} />
            </FilterGroup>
          </div>
          <p className="text-xs text-muted-foreground">
            {[rangeText, drawText, compare, viewNote].filter(Boolean).join(" · ")}
          </p>
          {draws.error && <p className="text-xs text-warning">{a.filters.drawsLoadError}</p>}
        </div>

        {overview.error ? (
          <ErrorState title={a.states.errorTitle} description={a.states.errorDescription(rangeText)} onRetry={retryAll} />
        ) : overview.isInitialLoading || !ov || !cards ? (
          <>
            <p className="sr-only" aria-live="polite">
              {a.states.loading(rangeText)}
            </p>
            <OverviewCardsSkeleton />
            <Skeleton className="h-96 rounded-xl bg-secondary/60" />
            <Skeleton className="h-96 rounded-xl bg-secondary/60" />
            <div className={LOWER_ROW}>
              <Skeleton className="h-80 rounded-xl bg-secondary/60" />
              <Skeleton className="h-80 rounded-xl bg-secondary/60" />
            </div>
          </>
        ) : (
          <div
            className={cn("flex flex-col gap-4 transition-opacity", overview.isRefreshing && "opacity-60")}
            aria-busy={overview.isRefreshing || undefined}
          >
            {isEmpty ? (
              <EmptyState
                icon={Ticket}
                title={a.states.emptyTitle}
                description={a.states.emptyDescription(drawText, rangeText)}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPeriodKey("last30")}>
                      {a.states.showLast30}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDrawId(ALL_DRAWS)} disabled={!drawId}>
                      {a.states.allDraws}
                    </Button>
                  </div>
                }
              />
            ) : (
              <>
                <OverviewCards cards={cards} />

                <ActivityChart
                  view={chartView}
                  activity={chartActivity}
                  hourly={hourly.data}
                  weekday={weekday.data}
                  isLoading={chartLoading}
                  error={chartError}
                  onRetry={retryChart}
                  range={range}
                  periodKey={periodKey}
                  nowMs={now}
                  rangeText={rangeText}
                  drawText={drawText}
                />

                <PopularNumbersCard
                  // A new selection restarts the sort and the page.
                  key={`${range.from}:${range.to}:${drawId}`}
                  range={range}
                  drawId={drawId}
                  drawNo={selectedDraw?.drawNo ?? null}
                  rangeText={rangeText}
                  previousLabel={covered ? formatRange(t, previousRange(range), false) : null}
                />

                <div className={LOWER_ROW}>
                  <BusiestDaysCard
                    data={weekday.data}
                    isLoading={weekday.isLoading}
                    error={weekday.error}
                    onRetry={weekday.refetch}
                    range={range}
                  />
                  <DefinitionsCard tracked={tracked} covered={covered} firstSaleDate={firstSaleDate} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LotteryAnalyticsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission permission="LOTTERY.VIEW" title={t.lottery.analytics.title} description={t.lottery.analytics.description}>
      <AnalyticsContent />
    </RequirePermission>
  );
}
