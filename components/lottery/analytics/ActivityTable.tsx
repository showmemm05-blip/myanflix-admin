"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/context/language-context";
import type { LotteryAnalyticsChartView } from "@/types/lottery-analytics";
import { formatCount } from "@/components/lottery/analytics/format";
import type { ActivityPoint } from "@/components/lottery/analytics/activityModel";

interface ActivityTableProps {
  view: LotteryAnalyticsChartView;
  points: ActivityPoint[];
  tracked: boolean;
  /** The chart's title, so the caption says what the table twins. */
  title: string;
}

/**
 * The chart "as a table": the same buckets, one row each, in a box that
 * scrolls sideways on a phone. A bucket still to come shows "—" rather than
 * the zero the wire carries for it.
 */
export function ActivityTable({ view, points, tracked, title }: ActivityTableProps) {
  const { t } = useLanguage();
  const a = t.lottery.analytics.activity;
  const none = t.lottery.analytics.none;
  const first = view === "hourly" ? a.columns.hour : view === "daily" ? a.columns.day : a.columns.week;
  const cell = (point: ActivityPoint, value: number | null) =>
    point.future ? none : value === null ? a.notYet : formatCount(value);

  return (
    <div className="glass-card overflow-hidden rounded-xl">
      <Table>
        <caption className="sr-only">{a.tableCaption(title)}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{first}</TableHead>
            <TableHead className="text-right">{a.series.ticketsSold}</TableHead>
            <TableHead className="text-right">{a.series.purchases}</TableHead>
            <TableHead className="text-right">{a.series.purchasingUsers}</TableHead>
            <TableHead className="text-right">{tracked ? a.series.activeUsers : a.columns.activeNotTracked}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {points.map((point, index) => (
            <TableRow key={point.key} className={index % 2 === 1 ? "bg-foreground/[0.02]" : undefined}>
              <TableCell className={point.future ? "text-muted-foreground" : undefined}>{point.title}</TableCell>
              <TableCell className="text-right tabular-nums">{cell(point, point.ticketsSold)}</TableCell>
              <TableCell className="text-right tabular-nums">{cell(point, point.purchases)}</TableCell>
              <TableCell className="text-right tabular-nums">{cell(point, point.purchasingUsers)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {tracked ? cell(point, point.activeUsers) : a.notYet}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
