"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Ticket } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { Button } from "@/components/ui/button";
import { AcrossDrawsCard } from "@/components/lottery/analytics/AcrossDrawsCard";
import { BeforeCloseCard } from "@/components/lottery/analytics/BeforeCloseCard";
import { DrawComparisonCard } from "@/components/lottery/analytics/DrawComparisonCard";
import { ALL_DRAWS, DrawSelect } from "@/components/lottery/analytics/DrawSelect";
import { FrequencyCard } from "@/components/lottery/analytics/FrequencyCard";
import { HeatmapCard } from "@/components/lottery/analytics/HeatmapCard";
import { PeriodChips } from "@/components/lottery/analytics/PeriodChips";
import { PopularByDrawCard } from "@/components/lottery/analytics/PopularByDrawCard";
import { RepeatFirstTimeCard } from "@/components/lottery/analytics/RepeatFirstTimeCard";
import {
  drawOptionLabel,
  drawShortLabel,
  formatCount,
  reportRangeText,
  updatedStamp,
} from "@/components/lottery/analytics/format";
import {
  REPORT_PERIODS,
  type DateRange,
  type ReportPeriodKey,
  mmtDateOfIso,
  mmtToday,
  resolveReportPeriod,
} from "@/components/lottery/analytics/period";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useNow } from "@/lib/hooks/use-now";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { lotteryService } from "@/services/api/lotteryService";

const DRAW_SELECT_SIZE = 100;

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * The Reports page (2026-10-23): the draw select FIRST, then All time ·
 * Last 7 days · Last 30 days · This month · Custom…, over seven cards that
 * each export their own CSV. "All time" sends no dates at all — the backend
 * treats both absent as all time on these endpoints. The selection's
 * tickets (the heatmap's cells added up) and buyers (the frequency card's
 * total) make the scope line and decide the empty state for the four
 * DRAW-scoped period cards; "Across all draws" is never draw-scoped and the
 * two whole-sales-window cards (before close, draw comparison) take no
 * period, so those three stay whatever the selection sold.
 *
 * On a filter change the cards keep their last slice at reduced opacity
 * (each card's own `refreshing`) and the scope line waits for BOTH loads,
 * so it never pairs stale counts with the new selection's words.
 */
function ReportsContent() {
  const { t } = useLanguage();
  const a = t.lottery.analytics;
  const r = a.reports;
  const now = useNow();

  const [drawId, setDrawId] = useState(ALL_DRAWS);
  const [periodKey, setPeriodKey] = useState<ReportPeriodKey>("all");
  const [custom, setCustom] = useState<DateRange | null>(null);

  const today = mmtToday(now);
  const range = resolveReportPeriod(periodKey, custom, now);
  const dates = range ? { from: range.from, to: range.to } : {};
  const query = { ...dates, drawId: drawId || undefined };
  const queryDeps = [range?.from, range?.to, drawId];

  const draws = useAsyncData(() => lotteryService.listDraws({ page: 1, pageSize: DRAW_SELECT_SIZE }), []);
  const frequency = useAsyncData(() => lotteryService.getAnalyticsFrequency(query), queryDeps);
  const heatmap = useAsyncData(
    () => lotteryService.getAnalyticsHeatmap(query).then((data) => ({ data, loadedAt: Date.now() })),
    queryDeps,
  );

  const drawList = draws.data?.items ?? null;
  const selected = drawList?.find((d) => d.id === drawId) ?? null;
  const drawText = selected ? drawOptionLabel(t, selected) : a.filters.allDraws;
  const drawShort = selected ? drawShortLabel(t, selected.drawNo) : null;
  // "All time · since …": the oldest listed draw's opening day stands in for the first sale.
  const oldest = drawList && drawList.length > 0 ? drawList[drawList.length - 1] : null;
  const firstSaleDate = mmtDateOfIso(oldest?.openedAt ?? null);
  const rangeText = reportRangeText(t, periodKey, range, now, firstSaleDate);

  const tickets = heatmap.data ? heatmap.data.data.cells.reduce((sum, c) => sum + c.ticketsSold, 0) : null;
  const buyers = frequency.data?.totalBuyers ?? null;
  const refreshing = heatmap.isRefreshing || frequency.isRefreshing;
  // The scope line only when both answers belong to the CURRENT selection.
  const scopeLoaded = !heatmap.isLoading && !frequency.isLoading && tickets !== null && buyers !== null;
  // The empty decision rides on the last slice in hand, dimmed while the next one loads.
  const isEmpty = tickets !== null && tickets === 0;
  const scopeText = !scopeLoaded ? null : isEmpty ? a.range.scopeEmpty : a.range.scope(formatCount(tickets), formatCount(buyers));
  const updated = heatmap.data ? a.updated(updatedStamp(t, heatmap.data.loadedAt)) : "…";
  const selectionKey = `${range?.from ?? "all"}:${range?.to ?? "all"}:${drawId}`;

  return (
    <div>
      <PageHeader
        title={r.title}
        description={`${a.reportingTime} · ${updated}`}
        actions={
          <Button variant="outline" render={<Link href="/lottery/analytics" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
            {r.backToAnalytics}
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterGroup label={a.filters.draw}>
              <DrawSelect draws={drawList} value={drawId} onChange={setDrawId} />
            </FilterGroup>
            <FilterGroup label={a.filters.period}>
              <PeriodChips
                keys={REPORT_PERIODS}
                value={periodKey}
                custom={custom}
                today={today}
                compared={false}
                onChange={(key, nextCustom) => {
                  if (nextCustom) setCustom(nextCustom);
                  setPeriodKey(key);
                }}
              />
            </FilterGroup>
          </div>
          <p className="text-xs text-muted-foreground">{[drawText, rangeText, scopeText].filter(Boolean).join(" · ")}</p>
          {draws.error && <p className="text-xs text-warning">{a.filters.drawsLoadError}</p>}
        </div>

        <p className="text-sm text-muted-foreground">{r.intro}</p>
        {!scopeLoaded && (
          <p className="sr-only" aria-live="polite">
            {a.states.loadingReports(drawText)}
          </p>
        )}

        {isEmpty ? (
          <div className={cn("transition-opacity", refreshing && "opacity-60")} aria-busy={refreshing || undefined}>
            <EmptyState
              icon={Ticket}
              title={a.states.emptyReportsTitle}
              description={a.states.emptyReportsDescription(drawText, rangeText)}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPeriodKey("all")} disabled={periodKey === "all"}>
                    {a.states.showAllTime}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDrawId(ALL_DRAWS)} disabled={!drawId}>
                    {a.states.allDraws}
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <PopularByDrawCard
            key={selectionKey}
            range={range}
            drawId={drawId}
            draws={drawList}
            rangeText={rangeText}
            onSelectDraw={setDrawId}
          />
        )}

        {/* Never draw-scoped: a draw with no sales in the period must not hide the other draws' numbers. */}
        <AcrossDrawsCard key={`${range?.from ?? "all"}:${range?.to ?? "all"}`} range={range} rangeText={rangeText} />

        {!isEmpty && (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <FrequencyCard
                data={frequency.data}
                isLoading={frequency.isLoading}
                error={frequency.error}
                onRetry={frequency.refetch}
                range={range}
                drawText={drawText}
                rangeText={rangeText}
              />
              <RepeatFirstTimeCard
                data={frequency.data}
                isLoading={frequency.isLoading}
                error={frequency.error}
                onRetry={frequency.refetch}
                range={range}
                drawText={drawText}
                drawShort={drawShort}
                rangeText={rangeText}
              />
            </div>

            <HeatmapCard
              data={heatmap.data?.data ?? null}
              isLoading={heatmap.isLoading}
              error={heatmap.error}
              onRetry={heatmap.refetch}
              range={range}
              drawText={drawText}
              rangeText={rangeText}
            />
          </>
        )}

        <BeforeCloseCard drawId={drawId} draws={drawList} />

        <DrawComparisonCard selectedDrawId={drawId} />
      </div>
    </div>
  );
}

export default function LotteryAnalyticsReportsPage() {
  const { t } = useLanguage();
  return (
    <RequirePermission permission="LOTTERY.VIEW" title={t.lottery.analytics.reports.title} description={t.lottery.analytics.description}>
      <ReportsContent />
    </RequirePermission>
  );
}
