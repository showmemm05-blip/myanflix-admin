"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { RevenuePoint } from "@/types/analytics";

type RevenuePeriod = "daily" | "weekly" | "monthly";

interface RevenueChartProps {
  daily: RevenuePoint[];
  weekly: RevenuePoint[];
  monthly: RevenuePoint[];
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "oklch(0.577 0.226 27.3)",
  },
} satisfies ChartConfig;

export function RevenueChart({ daily, weekly, monthly }: RevenueChartProps) {
  const [period, setPeriod] = useState<RevenuePeriod>("daily");

  const dataset = period === "daily" ? daily : period === "weekly" ? weekly : monthly;

  return (
    <Card className="glass-card border-white/[0.08]">
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Revenue</CardTitle>
          <p className="text-sm text-muted-foreground">Income across purchases and subscriptions</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as RevenuePeriod)}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <AreaChart data={dataset} margin={{ left: 4, right: 12, top: 8 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                value >= 1000 ? `${(value / 1000).toFixed(0)}k Ks` : `${value} Ks`
              }
              width={56}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <>
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: "var(--color-revenue)" }}
                      />
                      <div className="flex flex-1 items-center justify-between leading-none">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono font-medium tabular-nums">
                          {Number(value).toLocaleString()} Ks
                        </span>
                      </div>
                    </>
                  )}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              fill="url(#revenueFill)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
