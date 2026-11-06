"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ErrorState } from "@/components/shared/ErrorState";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { formatCount, formatDay, formatShortDate } from "@/components/lottery/analytics/format";
import { useLanguage } from "@/lib/context/language-context";
import type { AdAnalyticsDateBucket } from "@/types/ad";

/**
 * The three series are one hue in three lightness steps (the lottery
 * chart's ladder): plays at full strength, the other two lighter, so they
 * read as "the same plays, counted three ways" rather than three products.
 * color-mix with white lightens in both themes.
 */
const SHADES = [
  "var(--chart-1)",
  "color-mix(in oklab, var(--chart-1) 62%, white)",
  "color-mix(in oklab, var(--chart-1) 32%, white)",
] as const;

/**
 * The counts each day shows, with the name each one goes by: times played,
 * watched to the end and skipped — or, for corner pictures (which are never
 * "watched to the end" or skipped), the movie viewings they appeared in
 * (their `impressions`), taps and closes. The day's report has no come-backs,
 * so the corner bar is viewings, never "times on screen".
 */
const SERIES = {
  video: [
    ["impressions", "played"],
    ["completions", "watched"],
    ["skips", "skipped"],
  ],
  corner: [
    ["impressions", "viewings"],
    ["clicks", "taps"],
    ["closes", "closed"],
  ],
} as const;

export type AdDailySeries = keyof typeof SERIES;

/**
 * The video-only days of an "all types" report: every day's corner
 * openings (from the same report filtered to Corner) taken out, so the
 * plays bar stands on the same base as "watched to the end" and "skipped"
 * (2026-11-04 review). Both reports cover the same range, so the days line
 * up; a day missing from the corner report counts as no corner openings.
 */
export function videoOnlyBuckets(
  all: AdAnalyticsDateBucket[],
  corner: AdAnalyticsDateBucket[],
): AdAnalyticsDateBucket[] {
  const cornerByKey = new Map(corner.map((bucket) => [bucket.key, bucket]));
  return all.map((bucket) => {
    const c = cornerByKey.get(bucket.key);
    return {
      key: bucket.key,
      impressions: Math.max(0, bucket.impressions - (c?.impressions ?? 0)),
      completions: Math.max(0, bucket.completions - (c?.completions ?? 0)),
      skips: Math.max(0, bucket.skips - (c?.skips ?? 0)),
      // Taps and closes belong to corner pictures only.
      clicks: 0,
      closes: 0,
    };
  });
}

/** Each day needs this much width or a year of three-bar groups turns into hairlines on a phone. */
const BUCKET_WIDTH_PX = 28;

interface DailyPoint extends AdAnalyticsDateBucket {
  /** "16 Oct" on the axis. */
  xLabel: string;
  /** "Thu 16 Oct 2026" in the tooltip. */
  title: string;
}

interface AdDailyChartProps {
  buckets: AdAnalyticsDateBucket[] | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** "Last 7 days · All ads. Each group of bars is one day." */
  description: string;
  /**
   * Which three counts: "corner" for corner pictures (the Corner filter or a
   * corner ad), else "video" — whose buckets must then hold video plays only.
   */
  series?: AdDailySeries;
}

/**
 * The Ad results page's "Day by day" chart, one Myanmar calendar day per
 * group: grouped bars (times played, watched to the end, skipped — or movie
 * viewings, taps, closed with ✕ for corner pictures), a legend and a tooltip
 * with the three counts. The backend zero-fills every day of the range, so a
 * quiet day is a gap, not a hole.
 */
export function AdDailyChart({ buckets, isLoading, error, onRetry, description, series = "video" }: AdDailyChartProps) {
  const { t } = useLanguage();
  const c = t.adsUi.results.chart;
  const points: DailyPoint[] = (buckets ?? []).map((bucket) => ({
    ...bucket,
    xLabel: formatShortDate(t, bucket.key),
    title: formatDay(t, bucket.key, true),
  }));

  const bars = SERIES[series];
  const keys = bars.map(([key]) => key);
  const labels: Record<string, string> = Object.fromEntries(bars.map(([key, word]) => [key, c.series[word]]));
  const labelOf = (key: (typeof keys)[number]) => labels[key];
  const chartConfig: ChartConfig = Object.fromEntries(
    keys.map((key, i) => [key, { label: labelOf(key), color: SHADES[i] }]),
  );

  const tooltip = ({ active, payload }: TooltipContentProps) => {
    const point = payload?.[0]?.payload as DailyPoint | undefined;
    if (!active || !point) return null;
    const rows = keys.map((key, i): [string, number, string] => [labelOf(key), point[key], SHADES[i]]);
    return (
      <div className="grid min-w-44 gap-1.5 rounded-lg border border-[var(--border-strong)] bg-popover px-2.5 py-1.5 text-xs shadow-[var(--shadow-e3)]">
        <div className="font-medium">{point.title}</div>
        {rows.map(([label, value, color]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
            <span className="flex-1 text-muted-foreground">{label}</span>
            <span className="font-mono font-medium tabular-nums">{formatCount(value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {keys.map((key, i) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: SHADES[i] }} />
          {labelOf(key)}
        </span>
      ))}
    </div>
  );

  return (
    // Skeleton only before the first series; a refetch keeps the drawn chart, dimmed.
    <AnalyticsCard title={c.title} description={description} refreshing={isLoading && buckets !== null}>
      {error ? (
        <ErrorState description={t.adsUi.results.states.partError} onRetry={onRetry} />
      ) : !buckets ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-72 max-w-full rounded" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : (
        <>
          {legend}
          <div className="overflow-x-auto pb-1">
            <div style={{ minWidth: `${points.length * BUCKET_WIDTH_PX + 72}px` }}>
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart data={points} margin={{ left: 4, right: 12, top: 8 }} barCategoryGap="22%" barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="xLabel" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={48}
                    allowDecimals={false}
                    tickFormatter={(value: number) => formatCount(value)}
                  />
                  <ChartTooltip cursor={{ fill: "var(--foreground)", fillOpacity: 0.05 }} content={tooltip} />
                  {keys.map((key) => (
                    <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ChartContainer>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">{c.axis}</p>
        </>
      )}
    </AnalyticsCard>
  );
}
