"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLanguage } from "@/lib/context/language-context";
import { formatWatchDuration, hourRangeLabel } from "@/components/tracking/trackingFormat";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { WatchTimeReport } from "@/types/tracking";

/**
 * Web and mobile keep the same two hues they carry in `PlatformChip`
 * (chart-2 / chart-3) so a series in a chart and a chip in a table are
 * obviously the same thing. UNKNOWN gets chart-4 and is only ever drawn when
 * there is some of it.
 */
const WEB_COLOR = "var(--chart-2)";
const MOBILE_COLOR = "var(--chart-3)";
const UNKNOWN_COLOR = "var(--chart-4)";
const TOTAL_COLOR = "var(--chart-1)";

/** Y-axis ticks are seconds on the wire and durations on screen. */
function durationTick(t: TranslationShape) {
  return (value: number) => formatWatchDuration(Number(value), t);
}

/**
 * The tooltip body, shared by both charts: a colour chip, the series name and
 * the value as a duration rather than a raw second count. Recharts' default
 * would print "4920", which is true and useless.
 */
function durationTooltip(labels: Record<string, string>, t: TranslationShape) {
  return (
    <ChartTooltipContent
      formatter={(value, name, item) => (
        <>
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          <div className="flex flex-1 items-center justify-between gap-4 leading-none">
            <span className="text-muted-foreground">{labels[String(name)] ?? String(name)}</span>
            <span className="font-mono font-medium tabular-nums">
              {formatWatchDuration(Number(value), t)}
            </span>
          </div>
        </>
      )}
    />
  );
}

/**
 * Watch time by hour of day, website against mobile.
 *
 * Stacked rather than side-by-side: the question this answers is "when is the
 * platform busy", and the stack height answers it directly while the split
 * inside each bar answers the second question without a second chart.
 */
export function WatchTimeHourChart({ report }: { report: WatchTimeReport }) {
  const { t } = useLanguage();
  const w = t.tracking.watchTime;

  // Only drawn when there is any: a permanently-zero series in the legend
  // reads as a third product nobody uses, rather than as an absence.
  const showUnknown = report.totals.unknown > 0;

  const chartConfig = {
    web: { label: w.series.web, color: WEB_COLOR },
    mobile: { label: w.series.mobile, color: MOBILE_COLOR },
    unknown: { label: w.series.unknown, color: UNKNOWN_COLOR },
  } satisfies ChartConfig;

  const labels: Record<string, string> = {
    web: w.series.web,
    mobile: w.series.mobile,
    unknown: w.series.unknown,
  };

  // The category value is the full "8 PM – 9 PM" label, so the tooltip title
  // is readable without a formatter; the axis shrinks it back to "20" via a
  // lookup rather than a tick index, which `interval` would shift under us.
  const data = report.byHour.map((bucket) => ({
    label: hourRangeLabel(bucket.hour, t),
    short: w.hours[bucket.hour],
    web: bucket.web,
    mobile: bucket.mobile,
    unknown: bucket.unknown,
  }));
  const shortByLabel = new Map(data.map((point) => [point.label, point.short]));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{w.hourChart.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{w.hourChart.description}</p>
      </CardHeader>
      <CardContent>
        <p className="mb-1 text-[11px] text-muted-foreground">{w.hourChart.yLabel}</p>
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={1}
              tickFormatter={(value: string) => shortByLabel.get(value) ?? value}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={64}
              tickFormatter={durationTick(t)}
            />
            <ChartTooltip content={durationTooltip(labels, t)} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="web" stackId="watch" fill="var(--color-web)" />
            <Bar
              dataKey="mobile"
              stackId="watch"
              fill="var(--color-mobile)"
              radius={showUnknown ? 0 : [2, 2, 0, 0]}
            />
            {showUnknown && (
              <Bar
                dataKey="unknown"
                stackId="watch"
                fill="var(--color-unknown)"
                radius={[2, 2, 0, 0]}
              />
            )}
          </BarChart>
        </ChartContainer>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{w.hourChart.xLabel}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Watch time by weekday — one total bar each, deliberately NOT a second
 * platform split. The hour chart already carries that comparison; repeating
 * it here would make two charts look like the same chart twice.
 */
export function WatchTimeWeekdayChart({ report }: { report: WatchTimeReport }) {
  const { t } = useLanguage();
  const w = t.tracking.watchTime;

  const chartConfig = {
    total: { label: w.series.total, color: TOTAL_COLOR },
  } satisfies ChartConfig;

  const labels: Record<string, string> = { total: w.series.total };

  const data = report.byWeekday.map((bucket) => ({
    label: w.weekdays[bucket.weekday],
    short: w.weekdaysShort[bucket.weekday],
    total: bucket.total,
  }));
  const shortByLabel = new Map(data.map((point) => [point.label, point.short]));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{w.weekdayChart.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{w.weekdayChart.description}</p>
      </CardHeader>
      <CardContent>
        <p className="mb-1 text-[11px] text-muted-foreground">{w.hourChart.yLabel}</p>
        <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
          <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => shortByLabel.get(value) ?? value}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={64}
              tickFormatter={durationTick(t)}
            />
            <ChartTooltip content={durationTooltip(labels, t)} />
            <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} barSize={36} />
          </BarChart>
        </ChartContainer>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {w.weekdayChart.xLabel}
        </p>
      </CardContent>
    </Card>
  );
}
