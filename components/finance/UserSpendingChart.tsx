"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatKyat } from "@/lib/currency";
import type { FinanceSummary } from "@/types/analytics";

const chartConfig = {
  totalSpent: {
    label: "Total Spent",
    color: "oklch(0.577 0.226 27.3)",
  },
} satisfies ChartConfig;

export function UserSpendingChart({ topUsers }: { topUsers: FinanceSummary["topUsers"] }) {
  const data = topUsers
    .filter((entry) => entry.user)
    .map((entry) => ({ name: entry.user!.username, totalSpent: entry.totalSpent }));

  return (
    <Card className="glass-card border-white/[0.08]">
      <CardHeader>
        <CardTitle>Top Spenders</CardTitle>
        <p className="text-sm text-muted-foreground">Highest lifetime spend by subscriber</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={64}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <>
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: "var(--color-totalSpent)" }}
                      />
                      <div className="flex flex-1 items-center justify-between leading-none">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono font-medium tabular-nums">
                          {formatKyat(Number(value))}
                        </span>
                      </div>
                    </>
                  )}
                />
              }
            />
            <Bar dataKey="totalSpent" fill="var(--color-totalSpent)" radius={[0, 4, 4, 0]} barSize={22} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
