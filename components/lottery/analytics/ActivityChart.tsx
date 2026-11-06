"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ErrorState } from "@/components/shared/ErrorState";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { LotteryAnalyticsActivity, LotteryAnalyticsChartView } from "@/types/lottery-analytics";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ActivityTable } from "@/components/lottery/analytics/ActivityTable";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { csvFileName, downloadCsv } from "@/components/lottery/analytics/csv";
import { formatCount, formatRange } from "@/components/lottery/analytics/format";
import {
  type ActivityPoint,
  activityAxisLabel,
  activityInsight,
  activityNotes,
  buildActivityPoints,
} from "@/components/lottery/analytics/activityModel";
import {
  type DashboardPeriodKey,
  type DateRange,
  daySpan,
  mmtClock,
} from "@/components/lottery/analytics/period";

/**
 * The three series are one hue in three lightness steps (the boards'
 * ladder): tickets sold at full strength, purchasing users and active
 * users lighter, so they read as "the same thing, counted three ways"
 * rather than three products. color-mix with white lightens in both themes.
 */
const SERIES_COLORS = {
  ticketsSold: "var(--chart-1)",
  purchasingUsers: "color-mix(in oklab, var(--chart-1) 62%, white)",
  activeUsers: "color-mix(in oklab, var(--chart-1) 32%, white)",
} as const;

/** Each bucket needs this much width or 24 groups of three bars turn into hairlines on a phone. */
const BUCKET_WIDTH_PX = 40;

interface ActivityChartProps {
  /** The view actually drawn (after the period's fallback). */
  view: LotteryAnalyticsChartView;
  activity: LotteryAnalyticsActivity | null;
  /** The hourly series, whatever is drawn: the notes row is about hours. */
  hourly: LotteryAnalyticsActivity | null;
  /** The weekday series: the notes row's busiest day. */
  weekday: LotteryAnalyticsActivity | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  range: DateRange;
  periodKey: DashboardPeriodKey;
  nowMs: number;
  /** "Last 7 days · Thu 16–Wed 22 Oct 2026" */
  rangeText: string;
  /** "All draws" or "Draw 3 · 31 Oct (Open)" */
  drawText: string;
}

/**
 * Activity by hour / day / week: grouped bars per bucket, the legend, a
 * tooltip with all four counts, an insight sentence, the notes row, a
 * "Show as table" twin and Export CSV. Today's hours after the current MMT
 * hour are drawn empty and said to be still to come.
 */
export function ActivityChart({
  view,
  activity,
  hourly,
  weekday,
  isLoading,
  error,
  onRetry,
  range,
  periodKey,
  nowMs,
  rangeText,
  drawText,
}: ActivityChartProps) {
  const { t } = useLanguage();
  const a = t.lottery.analytics.activity;
  const none = t.lottery.analytics.none;
  const [showTable, setShowTable] = useState(false);

  const clock = mmtClock(nowMs);
  const days = daySpan(range);
  const tracked = activity?.activeUsersTracked ?? false;
  const points = activity ? buildActivityPoints(t, view, activity, range, periodKey, clock) : [];
  const title = a.titles[view];
  const sub =
    view === "hourly"
      ? days > 1
        ? a.subHourly(rangeText, days, drawText)
        : a.subHourlyOneDay(rangeText, drawText)
      : view === "daily"
        ? a.subDaily(rangeText, drawText)
        : a.subWeekly(rangeText, drawText);
  const axis = activityAxisLabel(t, view, range, periodKey, clock, formatRange(t, range, false));
  const insight = activity ? activityInsight(t, view, points, tracked) : "";
  const notes = activityNotes(t, hourly, weekday, tracked);

  const chartConfig = {
    ticketsSold: { label: a.series.ticketsSold, color: SERIES_COLORS.ticketsSold },
    purchasingUsers: { label: a.series.purchasingUsers, color: SERIES_COLORS.purchasingUsers },
    activeUsers: { label: a.series.activeUsers, color: SERIES_COLORS.activeUsers },
  } satisfies ChartConfig;

  const exportCsv = () => {
    const file = csvFileName(a.csvStems[view], range);
    downloadCsv(
      file,
      [view === "hourly" ? "hour_mmt" : view === "daily" ? "day_mmt" : "week_beginning_mmt", "tickets_sold", "purchases", "purchasing_users", "active_users"],
      points.map((p) => [p.key, p.ticketsSold, p.purchases, p.purchasingUsers, tracked ? (p.activeUsers ?? "") : ""]),
    );
    return file;
  };

  /** The tooltip: every count of the bucket, including purchases, which has no bar of its own. */
  const tooltip = ({ active, payload }: TooltipContentProps) => {
    const point = payload?.[0]?.payload as ActivityPoint | undefined;
    if (!active || !point) return null;
    const value = (v: number | null) => (point.future ? none : v === null ? a.notYet : formatCount(v));
    const rows: [string, string, string | null][] = [
      [a.series.ticketsSold, value(point.ticketsSold), SERIES_COLORS.ticketsSold],
      [a.series.purchases, value(point.purchases), null],
      [a.series.purchasingUsers, value(point.purchasingUsers), SERIES_COLORS.purchasingUsers],
      [tracked ? a.series.activeUsers : a.activeNotTracked, tracked ? value(point.activeUsers) : a.notYet, tracked ? SERIES_COLORS.activeUsers : null],
    ];
    return (
      <div className="grid min-w-44 gap-1.5 rounded-lg border border-[var(--border-strong)] bg-popover px-2.5 py-1.5 text-xs shadow-[var(--shadow-e3)]">
        <div className="font-medium">{point.title}</div>
        {rows.map(([label, text, color]) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn("size-2.5 shrink-0 rounded-[2px]", !color && "border border-[var(--border-stronger)]")}
              style={color ? { backgroundColor: color } : undefined}
            />
            <span className="flex-1 text-muted-foreground">{label}</span>
            <span className="font-mono font-medium tabular-nums">{text}</span>
          </div>
        ))}
      </div>
    );
  };

  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(["ticketsSold", "purchasingUsers"] as const).map((key) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: SERIES_COLORS[key] }} />
          {a.series[key]}
        </span>
      ))}
      <span className={cn("inline-flex items-center gap-1.5", !tracked && "italic")}>
        <span
          className={cn("size-2.5 rounded-[2px]", !tracked && "border border-dashed border-[var(--border-stronger)]")}
          style={tracked ? { backgroundColor: SERIES_COLORS.activeUsers } : undefined}
        />
        {tracked ? a.series.activeUsers : a.activeNotTracked}
      </span>
    </div>
  );

  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable} disabled={!activity}>
        <Table2 className="size-4" />
        {showTable ? a.hideTable : a.showTable}
      </Button>
      <ExportButton onExport={exportCsv} disabled={!activity} />
    </>
  );

  return (
    // Skeleton only before the first series; a refetch keeps the drawn chart, dimmed.
    <AnalyticsCard title={title} description={sub} actions={actions} refreshing={isLoading && activity !== null}>
      {error ? (
        <ErrorState description={t.lottery.analytics.states.cardError} onRetry={onRetry} />
      ) : !activity ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-72 max-w-full rounded" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-4 w-96 max-w-full rounded" />
        </div>
      ) : (
        <>
          {legend}
          <div className="overflow-x-auto pb-1">
            <div style={{ minWidth: `${points.length * BUCKET_WIDTH_PX + 72}px` }}>
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart data={points} margin={{ left: 4, right: 12, top: 8 }} barCategoryGap="22%" barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="xLabel" tickLine={false} axisLine={false} tickMargin={8} interval={view === "hourly" ? 0 : "preserveStartEnd"} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={48}
                    allowDecimals={false}
                    tickFormatter={(value: number) => formatCount(value)}
                  />
                  <ChartTooltip cursor={{ fill: "var(--foreground)", fillOpacity: 0.05 }} content={tooltip} />
                  <Bar dataKey="ticketsSold" fill="var(--color-ticketsSold)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="purchasingUsers" fill="var(--color-purchasingUsers)" radius={[2, 2, 0, 0]} />
                  {tracked && <Bar dataKey="activeUsers" fill="var(--color-activeUsers)" radius={[2, 2, 0, 0]} />}
                </BarChart>
              </ChartContainer>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">{axis}</p>
          <p className="text-sm">{insight}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                [notes.busiestHourLabel, notes.busiestHour],
                [a.notes.quietestHour, notes.quietestHour],
                [a.notes.busiestDay, notes.busiestDay],
                [a.notes.highestPurchasing, notes.highestPurchasing],
                [a.notes.lowestPurchasing, notes.lowestPurchasing],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {showTable && <ActivityTable view={view} points={points} tracked={tracked} title={title} />}
        </>
      )}
    </AnalyticsCard>
  );
}
