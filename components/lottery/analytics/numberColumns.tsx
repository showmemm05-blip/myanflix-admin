"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranslationShape } from "@/lib/i18n/translations";
import type {
  LotteryAnalyticsNumberRow,
  LotteryAnalyticsNumberSort,
  LotteryAnalyticsNumberTrend,
  LotteryAnalyticsSortOrder,
} from "@/types/lottery-analytics";
import { SortHeader } from "@/components/lottery/analytics/SortHeader";
import { formatCount, formatShare, formatSignedPct } from "@/components/lottery/analytics/format";

/** A six-digit number as the apps print it: monospace, letter-spaced, leading zeros kept. */
export function NumberCell({ number }: { number: string }) {
  return <span className="font-mono text-sm tracking-[0.12em] tabular-nums">{number}</span>;
}

/** ▲ "+14%", ▼ "−4%", ✦ "New" or "—": an icon plus signed text, never colour alone. */
export function TrendCell({ trend, t }: { trend: LotteryAnalyticsNumberTrend; t: TranslationShape }) {
  const words = t.lottery.analytics.numbers.trend;
  if (trend.isNew) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-info" title={words.newSr}>
        <Sparkles className="size-3.5" aria-hidden="true" />
        {words.new}
      </span>
    );
  }
  if (trend.changePct === null) {
    return (
      <span className="text-xs text-muted-foreground" title={words.noneSr}>
        {t.lottery.analytics.none}
      </span>
    );
  }
  const pct = Math.round(trend.changePct * 100);
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        direction === "up" && "text-success",
        direction === "down" && "text-destructive",
        direction === "flat" && "text-muted-foreground",
      )}
      title={direction === "up" ? words.upSr : direction === "down" ? words.downSr : words.flatSr}
    >
      {direction === "up" && <ArrowUp className="size-3.5" aria-hidden="true" />}
      {direction === "down" && <ArrowDown className="size-3.5" aria-hidden="true" />}
      {direction === "flat" && <Minus className="size-3.5" aria-hidden="true" />}
      {formatSignedPct(trend.changePct)}
    </span>
  );
}

interface NumberColumnOptions {
  t: TranslationShape;
  sort: LotteryAnalyticsNumberSort;
  order: LotteryAnalyticsSortOrder;
  onSort: (sort: LotteryAnalyticsNumberSort) => void;
  /** "Share" on the dashboard, "Share of draw" on the reports page. */
  shareLabel: string;
  /** The dashboard shows the trend against the comparison period; the reports page has none. */
  withTrend: boolean;
}

/**
 * Rank · Number · Tickets · Buyers · Share · (Trend) · Repeat buys. The
 * three server-sortable columns carry SortHeader; `enableSorting: false`
 * everywhere keeps DataTable from sorting the loaded page on its own.
 */
export function getNumberColumns({
  t,
  sort,
  order,
  onSort,
  shareLabel,
  withTrend,
}: NumberColumnOptions): ColumnDef<LotteryAnalyticsNumberRow>[] {
  const c = t.lottery.analytics.numbers.columns;
  const sortable = (key: LotteryAnalyticsNumberSort, label: string) => (
    <SortHeader label={label} active={sort === key} order={order} onClick={() => onSort(key)} alignRight />
  );
  const columns: ColumnDef<LotteryAnalyticsNumberRow>[] = [
    {
      accessorKey: "rank",
      header: c.rank,
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.rank}</span>,
    },
    {
      accessorKey: "number",
      header: c.number,
      enableSorting: false,
      cell: ({ row }) => <NumberCell number={row.original.number} />,
    },
    {
      accessorKey: "tickets",
      header: () => sortable("tickets", c.tickets),
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.tickets)}</span>,
    },
    {
      accessorKey: "buyers",
      header: () => sortable("buyers", c.buyers),
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.buyers)}</span>,
    },
    {
      accessorKey: "share",
      header: shareLabel,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{formatShare(row.original.share)}</span>,
    },
  ];
  if (withTrend) {
    columns.push({
      id: "trend",
      header: c.trend,
      enableSorting: false,
      cell: ({ row }) => <TrendCell trend={row.original.trend} t={t} />,
    });
  }
  columns.push({
    accessorKey: "repeatBuyers",
    header: () => sortable("repeat", c.repeat),
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.repeatBuyers)}</span>,
  });
  return columns;
}
