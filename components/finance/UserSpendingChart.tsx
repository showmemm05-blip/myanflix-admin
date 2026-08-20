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
import { useLanguage } from "@/lib/context/language-context";
import { userLabel } from "@/lib/user-label";
import type { FinanceSummary } from "@/types/analytics";

export function UserSpendingChart({ topUsers }: { topUsers: FinanceSummary["topUsers"] }) {
  const { t } = useLanguage();
  const chartConfig = {
    totalSpent: {
      label: t.finance.topSpenders.totalSpent,
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  const spenders = topUsers
    .filter((entry) => entry.user)
    .map((entry) => ({ user: entry.user!, totalSpent: entry.totalSpent }));

  // Recharts keys the category axis BY THIS STRING, so two spenders who chose
  // the same display name would collapse onto a single band with one bar
  // hidden behind the other. Display names aren't unique (the usernames they
  // replaced were), so the ambiguous ones — and only those — carry their login
  // identity as a disambiguator.
  const labelCounts = new Map<string, number>();
  for (const entry of spenders) {
    const label = userLabel(entry.user);
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  const data = spenders.map(({ user, totalSpent }) => {
    const label = userLabel(user);
    return {
      name: (labelCounts.get(label) ?? 0) > 1 ? `${label} @${user.username}` : label,
      totalSpent,
    };
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{t.finance.topSpenders.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{t.finance.topSpenders.description}</p>
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
