"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ErrorState } from "@/components/shared/ErrorState";
import { useLanguage } from "@/lib/context/language-context";
import {
  LOTTERY_ANALYTICS_FREQUENCY_KEYS,
  type LotteryAnalyticsFrequency,
  type LotteryAnalyticsFrequencyKey,
} from "@/types/lottery-analytics";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { csvFileName, csvPct, downloadCsv } from "@/components/lottery/analytics/csv";
import { formatCount, formatShare } from "@/components/lottery/analytics/format";
import type { DateRange } from "@/components/lottery/analytics/period";

interface BinPoint {
  key: LotteryAnalyticsFrequencyKey;
  label: string;
  name: string;
  users: number;
  share: number;
}

export interface FrequencyCardProps {
  data: LotteryAnalyticsFrequency | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  range: DateRange | null;
  drawText: string;
  rangeText: string;
}

/** Purchasing users by how many purchases they made: 1 · 2–3 · 4–9 · 10+, the value and its share under each bar. */
export function FrequencyCard({ data, isLoading, error, onRetry, range, drawText, rangeText }: FrequencyCardProps) {
  const { t } = useLanguage();
  const f = t.lottery.analytics.reports.frequency;
  const byKey = new Map((data?.bins ?? []).map((b) => [b.key, b]));
  const points: BinPoint[] = LOTTERY_ANALYTICS_FREQUENCY_KEYS.map((key) => ({
    key,
    label: f.bins[key],
    name: f.binNames[key],
    users: byKey.get(key)?.users ?? 0,
    share: byKey.get(key)?.share ?? 0,
  }));
  const top = points.reduce<BinPoint | null>((best, p) => (p.users > 0 && (best === null || p.users > best.users) ? p : best), null);
  const total = data?.totalBuyers ?? 0;
  const note = total > 0 ? f.note(formatShare(points[0].share, 0), formatShare(points[3].share, 0)) : f.noteEmpty;

  const chartConfig = { users: { label: f.users, color: "var(--chart-1)" } } satisfies ChartConfig;
  const tooltip = ({ active, payload }: TooltipContentProps) => {
    const point = payload?.[0]?.payload as BinPoint | undefined;
    if (!active || !point) return null;
    return (
      <div className="grid min-w-40 gap-1 rounded-lg border border-[var(--border-strong)] bg-popover px-2.5 py-1.5 text-xs shadow-[var(--shadow-e3)]">
        <div className="font-medium">{point.name}</div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{f.users}</span>
          <span className="font-mono tabular-nums">{formatCount(point.users)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{f.ofBuyers}</span>
          <span className="font-mono tabular-nums">{formatShare(point.share, 0)}</span>
        </div>
      </div>
    );
  };

  const exportCsv = () => {
    const file = csvFileName(f.csvStem, range);
    downloadCsv(
      file,
      ["purchases", "users", "share_pct"],
      [...points.map((p) => [p.key, p.users, csvPct(p.share)]), ["total", total, ""]],
    );
    return file;
  };

  return (
    <AnalyticsCard
      title={f.title}
      description={f.sub(drawText, rangeText)}
      actions={<ExportButton onExport={exportCsv} disabled={!data} />}
      refreshing={isLoading && data !== null}
    >
      {error ? (
        <ErrorState description={t.lottery.analytics.states.cardError} onRetry={onRetry} />
      ) : !data ? (
        <Skeleton className="h-56 rounded-lg" />
      ) : (
        <>
          <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
            <BarChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} allowDecimals={false} tickFormatter={(v: number) => formatCount(v)} />
              <ChartTooltip cursor={{ fill: "var(--foreground)", fillOpacity: 0.05 }} content={tooltip} />
              <Bar dataKey="users" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {points.map((p) => (
                  <Cell key={p.key} fill={top && p.key === top.key ? "var(--chart-1)" : "color-mix(in oklab, var(--chart-1) 55%, white)"} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          {/* The short bin label under each bar (the long name is the tooltip / aria): "2–3 purchases" would truncate in four phone-width columns. */}
          <dl className="grid grid-cols-4 gap-2 text-center">
            {points.map((p) => (
              <div key={p.key} className="min-w-0" title={p.name} aria-label={`${p.name}: ${formatCount(p.users)} ${f.users}, ${formatShare(p.share, 0)}`}>
                <dt className="text-[11px] tabular-nums text-muted-foreground">{p.label}</dt>
                <dd className="font-heading text-lg font-bold tabular-nums">{formatCount(p.users)}</dd>
                <dd className="text-xs tabular-nums text-muted-foreground">{formatShare(p.share, 0)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm">{note}</p>
        </>
      )}
    </AnalyticsCard>
  );
}
