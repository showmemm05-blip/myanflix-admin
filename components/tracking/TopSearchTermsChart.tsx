"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLanguage } from "@/lib/context/language-context";
import type { TopSearchTerm } from "@/types/tracking";

/** How many bars before the chart stops being a chart and becomes a table. */
const TOP_N = 10;

/**
 * The ten most-typed search terms, as horizontal bars.
 *
 * Horizontal because the labels are free text people typed — "action movies
 * 2024" does not fit under a vertical bar at any width — and because the
 * ordering is already the point, so a ranked list reading top-to-bottom is
 * the natural shape.
 *
 * Terms are unique per bar: rows are grouped by `normalizedTerm`, and a
 * spelling normalises to exactly one group, so no two rows can collide onto
 * the same Recharts category band.
 */
export function TopSearchTermsChart({ terms }: { terms: TopSearchTerm[] }) {
  const { t } = useLanguage();
  const s = t.tracking.searches;

  const chartConfig = {
    count: { label: s.chart.seriesLabel, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  const data = terms.slice(0, TOP_N).map((term) => ({
    term: term.term,
    count: term.count,
  }));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{s.chart.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{s.chart.description}</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="term"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={128}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ChartContainer>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{s.chart.xLabel}</p>
      </CardContent>
    </Card>
  );
}
