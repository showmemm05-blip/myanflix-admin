"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { UserGrowthPoint } from "@/types/analytics";

const chartConfig = {
  newUsers: {
    label: "New Users",
    color: "oklch(0.577 0.226 27.3)",
  },
  activeUsers: {
    label: "Active Users",
    color: "oklch(0.6 0.12 200)",
  },
} satisfies ChartConfig;

export function UserGrowthChart({ data }: { data: UserGrowthPoint[] }) {
  return (
    <Card className="glass-card border-white/[0.08]">
      <CardHeader>
        <CardTitle>User Growth</CardTitle>
        <p className="text-sm text-muted-foreground">New signups vs. monthly active users</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <ComposedChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={56}
              tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              yAxisId="left"
              dataKey="newUsers"
              fill="var(--color-newUsers)"
              radius={[4, 4, 0, 0]}
              barSize={22}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="activeUsers"
              stroke="var(--color-activeUsers)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
