"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ErrorState } from "@/components/shared/ErrorState";
import { useLanguage } from "@/lib/context/language-context";
import type { LotteryAnalyticsActivity } from "@/types/lottery-analytics";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { csvFileName, downloadCsv } from "@/components/lottery/analytics/csv";
import { formatCount, formatShare } from "@/components/lottery/analytics/format";
import { type DateRange, weekdayCounts } from "@/components/lottery/analytics/period";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

interface DayPoint {
  key: string;
  label: string;
  name: string;
  ticketsSold: number;
  purchases: number;
  purchasingUsers: number;
  activeUsers: number | null;
  /** How many of this weekday the period holds. */
  count: number;
}

interface BusiestDaysCardProps {
  data: LotteryAnalyticsActivity | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  range: DateRange;
}

/**
 * Tickets sold by weekday, Mon–Sun (view=weekday). The busiest day's bar is
 * the full hue, the others lighter, and the note says which day wins and
 * across how many of them — so a period with one Saturday in it does not
 * crown Saturday.
 */
export function BusiestDaysCard({ data, isLoading, error, onRetry, range }: BusiestDaysCardProps) {
  const { t } = useLanguage();
  const a = t.lottery.analytics;
  const d = a.days;

  const counts = weekdayCounts(range);
  const byKey = new Map((data?.buckets ?? []).map((b) => [b.key, b]));
  const points: DayPoint[] = WEEKDAY_KEYS.map((key, i) => {
    const b = byKey.get(key);
    return {
      key,
      label: a.weekdaysShort[i],
      name: a.weekdays[i],
      ticketsSold: b?.ticketsSold ?? 0,
      purchases: b?.purchases ?? 0,
      purchasingUsers: b?.purchasingUsers ?? 0,
      activeUsers: b?.activeUsers ?? null,
      count: counts[i],
    };
  });
  const total = points.reduce((sum, p) => sum + p.ticketsSold, 0);
  const withData = points.filter((p) => p.ticketsSold > 0);
  const busiest = withData.reduce<DayPoint | null>((best, p) => (best === null || p.ticketsSold > best.ticketsSold ? p : best), null);
  const quietest = withData.reduce<DayPoint | null>((best, p) => (best === null || p.ticketsSold < best.ticketsSold ? p : best), null);
  const note =
    busiest === null
      ? d.noteNone
      : withData.length === 1
        ? d.noteOnly(busiest.name)
        : d.note(busiest.name, formatCount(busiest.ticketsSold), busiest.count, quietest && quietest.key !== busiest.key ? quietest.name : null);

  const chartConfig = { ticketsSold: { label: d.ticketsSold, color: "var(--chart-1)" } } satisfies ChartConfig;

  const tooltip = ({ active, payload }: TooltipContentProps) => {
    const point = payload?.[0]?.payload as DayPoint | undefined;
    if (!active || !point) return null;
    return (
      <div className="grid min-w-40 gap-1 rounded-lg border border-[var(--border-strong)] bg-popover px-2.5 py-1.5 text-xs shadow-[var(--shadow-e3)]">
        <div className="font-medium">{point.name}</div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{d.ticketsSold}</span>
          <span className="font-mono tabular-nums">{formatCount(point.ticketsSold)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{d.ofPeriod}</span>
          <span className="font-mono tabular-nums">{total > 0 ? formatShare(point.ticketsSold / total) : a.none}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{d.purchasingUsers}</span>
          <span className="font-mono tabular-nums">{formatCount(point.purchasingUsers)}</span>
        </div>
        <div className="text-muted-foreground">{d.inPeriod(point.count, point.name)}</div>
      </div>
    );
  };

  const exportCsv = () => {
    const file = csvFileName(d.csvStem, range);
    downloadCsv(
      file,
      ["weekday", "tickets_sold", "purchases", "purchasing_users", "active_users", "days_in_period"],
      points.map((p) => [p.key, p.ticketsSold, p.purchases, p.purchasingUsers, p.activeUsers ?? "", p.count]),
    );
    return file;
  };

  return (
    <AnalyticsCard
      title={d.title}
      description={d.description}
      actions={<ExportButton onExport={exportCsv} disabled={!data} />}
      refreshing={isLoading && data !== null}
    >
      {error ? (
        <ErrorState description={d.loadError} onRetry={onRetry} />
      ) : !data ? (
        <Skeleton className="h-56 rounded-lg" />
      ) : (
        <>
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <BarChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} allowDecimals={false} tickFormatter={(v: number) => formatCount(v)} />
              <ChartTooltip cursor={{ fill: "var(--foreground)", fillOpacity: 0.05 }} content={tooltip} />
              <Bar dataKey="ticketsSold" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {points.map((p) => (
                  <Cell
                    key={p.key}
                    fill={
                      busiest && p.key === busiest.key
                        ? "var(--chart-1)"
                        : "color-mix(in oklab, var(--chart-1) 55%, white)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="text-sm">{note}</p>
        </>
      )}
    </AnalyticsCard>
  );
}
