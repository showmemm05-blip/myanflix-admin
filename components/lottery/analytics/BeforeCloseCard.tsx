"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { CalendarClock, Hourglass } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { formatMmt } from "@/lib/myanmar-time";
import { ApiError } from "@/services/api/apiClient";
import { lotteryService } from "@/services/api/lotteryService";
import type { LotteryAdminDraw } from "@/types/lottery";
import {
  LOTTERY_ANALYTICS_BEFORE_CLOSE_KEYS,
  type LotteryAnalyticsBeforeCloseKey,
} from "@/types/lottery-analytics";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { csvFileName, csvPct, downloadCsv } from "@/components/lottery/analytics/csv";
import {
  drawOptionLabel,
  drawShortLabel,
  formatCount,
  formatShare,
  salesWindowText,
} from "@/components/lottery/analytics/format";

const HOUR_MS = 3_600_000;
const WINDOW_HOURS = 72;

interface BinPoint {
  key: LotteryAnalyticsBeforeCloseKey;
  label: string;
  name: string;
  tickets: number;
  hours: number;
  perHour: number;
  share: number;
}

interface BeforeCloseCardProps {
  /** The selected draw, or "" for the most recent closed or published one. */
  drawId: string;
  draws: LotteryAdminDraw[] | null;
}

/**
 * Tickets by stretch before the draw's closing time: 72–48h · 48–24h ·
 * 24–12h · 12–6h · 6–1h · last hour. The bars are not equal lengths of
 * time, so the tooltip gives tickets per hour and the insight names the
 * densest stretch. An open draw shows the "Sales have not closed yet" state
 * instead; no closed draw at all (404) the empty one.
 */
export function BeforeCloseCard({ drawId, draws }: BeforeCloseCardProps) {
  const { t } = useLanguage();
  const a = t.lottery.analytics;
  const b = a.reports.beforeClose;
  const { data, isLoading, error, refetch } = useAsyncData(
    () => lotteryService.getAnalyticsBeforeClose({ drawId: drawId || undefined }),
    [drawId],
  );
  const notFound = error instanceof ApiError && error.status === 404;

  const draw = data?.draw ?? null;
  const listed = draw ? (draws?.find((d) => d.id === draw.id) ?? null) : null;
  const drawLabel = draw ? drawOptionLabel(t, { ...draw, status: "published" }) : "";
  const drawShort = draw ? drawShortLabel(t, draw.drawNo) : "";
  const closeText = draw ? formatMmt(draw.salesCloseAt) : "";

  const byKey = new Map((data?.bins ?? []).map((bin) => [bin.key, bin]));
  const last72 = (data?.bins ?? []).reduce((sum, bin) => sum + bin.tickets, 0);
  const points: BinPoint[] = LOTTERY_ANALYTICS_BEFORE_CLOSE_KEYS.map((key) => {
    const bin = byKey.get(key);
    const tickets = bin?.tickets ?? 0;
    const hours = bin?.hours ?? 1;
    return { key, label: b.bins[key], name: b.binNames[key], tickets, hours, perHour: hours > 0 ? tickets / hours : 0, share: last72 > 0 ? tickets / last72 : 0 };
  });
  const densest = points.reduce<BinPoint | null>((best, p) => (p.tickets > 0 && (best === null || p.perHour > best.perHour) ? p : best), null);
  const total = data?.total ?? 0;
  // With "All draws" the backend chose the most recent closed draw itself: say so first, whatever the list holds.
  const description = !draw
    ? ""
    : !data?.closed
      ? b.subOpen(drawLabel, closeText)
      : !drawId
        ? [b.subLatest(drawLabel), listed ? salesWindowText(t, listed) : null, b.closedAt(closeText)].filter(Boolean).join(" · ")
        : b.sub(drawLabel, listed ? salesWindowText(t, listed) : a.none, closeText);
  // Nothing sold at all · everything sold before the 72-hour window · the usual share-and-densest sentence.
  const insight = !draw
    ? ""
    : total === 0
      ? b.insightNone(drawShort)
      : !densest || last72 === 0
        ? b.insightNoLast72(drawShort, formatCount(total), closeText)
        : b.insight(formatShare(last72 / total, 0), drawShort, formatCount(total), closeText, densest.name, formatCount(densest.tickets), formatCount(Math.round(densest.perHour)));

  const chartConfig = { tickets: { label: b.tickets, color: "var(--chart-1)" } } satisfies ChartConfig;
  const tooltip = ({ active, payload }: TooltipContentProps) => {
    const point = payload?.[0]?.payload as BinPoint | undefined;
    if (!active || !point) return null;
    return (
      <div className="grid min-w-44 gap-1 rounded-lg border border-[var(--border-strong)] bg-popover px-2.5 py-1.5 text-xs shadow-[var(--shadow-e3)]">
        <div className="font-medium">{point.name}</div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{b.tickets}</span>
          <span className="font-mono tabular-nums">{formatCount(point.tickets)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{b.ofLast72}</span>
          <span className="font-mono tabular-nums">{formatShare(point.share, 0)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{b.perHour}</span>
          <span className="font-mono tabular-nums">{formatCount(Math.round(point.perHour))}</span>
        </div>
      </div>
    );
  };

  const exportCsv = () => {
    if (!data) throw new Error(a.states.cardError);
    const file = csvFileName(b.csvStem, null, `draw-${data.draw.drawNo}`);
    downloadCsv(
      file,
      ["stretch", "hours", "tickets", "share_of_last_72h_pct", "tickets_per_hour"],
      [
        ...points.map((p) => [p.key, p.hours, p.tickets, csvPct(p.share), p.perHour.toFixed(1)]),
        ["earlier", "", data.earlier, "", ""],
        ["total", "", data.total, "", ""],
      ],
    );
    return file;
  };

  return (
    <AnalyticsCard
      title={b.title}
      description={description}
      actions={<ExportButton onExport={exportCsv} disabled={!data || !data.closed} />}
      refreshing={isLoading && data !== null}
    >
      {notFound ? (
        <EmptyState icon={Hourglass} title={b.noDrawTitle} description={b.noDrawText} className="py-10" />
      ) : error ? (
        <ErrorState description={a.states.cardError} onRetry={refetch} />
      ) : !data || !draw ? (
        <Skeleton className="h-56 rounded-lg" />
      ) : !data.closed ? (
        <EmptyState
          icon={CalendarClock}
          title={b.notClosedTitle}
          description={b.notClosedText(
            drawShort,
            closeText,
            formatMmt(new Date(new Date(draw.salesCloseAt).getTime() - WINDOW_HOURS * HOUR_MS).toISOString()),
          )}
          className="py-10"
        />
      ) : (
        <>
          <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full">
            <BarChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} allowDecimals={false} tickFormatter={(v: number) => formatCount(v)} />
              <ChartTooltip cursor={{ fill: "var(--foreground)", fillOpacity: 0.05 }} content={tooltip} />
              <Bar dataKey="tickets" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {points.map((p) => (
                  <Cell key={p.key} fill={densest && p.key === densest.key ? "var(--chart-1)" : "color-mix(in oklab, var(--chart-1) 55%, white)"} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="text-center text-[11px] text-muted-foreground">{b.axis}</p>
          <p className="text-sm">{insight}</p>
          {data.earlier > 0 && <p className="text-xs text-muted-foreground">{b.earlier(formatCount(data.earlier))}</p>}
        </>
      )}
    </AnalyticsCard>
  );
}
