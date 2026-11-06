"use client";

import { useState } from "react";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DRAW_STATUS_TONES } from "@/components/lottery/drawFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useLanguage } from "@/lib/context/language-context";
import { lotteryService } from "@/services/api/lotteryService";
import type { LotteryAdminDraw } from "@/types/lottery";
import {
  LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE,
  type LotteryAnalyticsNumberSort,
  type LotteryAnalyticsSortOrder,
} from "@/types/lottery-analytics";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { csvFileName, csvPct, csvText, downloadCsv, type CsvValue } from "@/components/lottery/analytics/csv";
import {
  drawOptionLabel,
  drawShortLabel,
  formatCount,
  formatShare,
  salesWindowText,
} from "@/components/lottery/analytics/format";
import { NumberCell, getNumberColumns } from "@/components/lottery/analytics/numberColumns";
import type { DateRange } from "@/components/lottery/analytics/period";

const PAGE_SIZE = 10;
const MINI_COUNT = 5;
/** With "All draws" selected, the three most recent draws get a top-5 each. */
const MINI_DRAWS = 3;

interface PopularByDrawCardProps {
  range: DateRange | null;
  drawId: string;
  draws: LotteryAdminDraw[] | null;
  rangeText: string;
  onSelectDraw: (drawId: string) => void;
}

/**
 * One draw: the sortable paged table of its numbers (Share of draw, no
 * trend). All draws: a top-5 mini table for each of the three most recent
 * draws, each with "Show all numbers for Draw n", which selects that draw
 * above. Mounted with a `key` of the selection so the sort and page restart.
 */
export function PopularByDrawCard({ range, drawId, draws, rangeText, onSelectDraw }: PopularByDrawCardProps) {
  const { t } = useLanguage();
  const n = t.lottery.analytics.numbers;
  const r = t.lottery.analytics.reports.byDraw;
  const selected = draws?.find((d) => d.id === drawId) ?? null;

  const [sort, setSort] = useState<LotteryAnalyticsNumberSort>("tickets");
  const [order, setOrder] = useState<LotteryAnalyticsSortOrder>("desc");
  const [page, setPage] = useState(1);
  const dates = range ? { from: range.from, to: range.to } : {};

  const one = useAsyncData(
    () => (drawId ? lotteryService.getAnalyticsNumbers({ ...dates, drawId, sort, order, page, pageSize: PAGE_SIZE }) : Promise.resolve(null)),
    [range?.from, range?.to, drawId, sort, order, page],
  );
  useClampPage({
    page,
    pageSize: PAGE_SIZE,
    rowCount: one.data?.items.length,
    total: one.data?.total,
    isLoading: one.isLoading,
    onPageChange: setPage,
  });
  const changeSort = (next: LotteryAnalyticsNumberSort) => {
    if (next === sort) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(next);
      setOrder("desc");
    }
    setPage(1);
  };
  const columns = getNumberColumns({ t, sort, order, onSort: changeSort, shareLabel: n.columns.shareOfDraw, withTrend: false });

  const miniDraws = (draws ?? []).slice(0, MINI_DRAWS);

  const exportOne = async () => {
    if (!selected) throw new Error(n.loadError);
    const all = await lotteryService.getAnalyticsNumbers({ ...dates, drawId, sort, order, page: 1, pageSize: LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE });
    const file = csvFileName(r.csvStem, range, `draw-${selected.drawNo}`);
    downloadCsv(
      file,
      ["rank", "number", "tickets", "buyers", "share_of_draw_pct", "repeat_buyers"],
      all.items.map((x) => [x.rank, csvText(x.number), x.tickets, x.buyers, csvPct(x.share), x.repeatBuyers]),
    );
    return file;
  };

  /** Every number of each of the three draws, one row per draw and number. */
  const exportAll = async () => {
    const pages = await Promise.all(
      miniDraws.map((d) =>
        lotteryService.getAnalyticsNumbers({ ...dates, drawId: d.id, sort: "tickets", order: "desc", page: 1, pageSize: LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE }),
      ),
    );
    const rows: CsvValue[][] = [];
    pages.forEach((p, i) => {
      for (const x of p.items) rows.push([miniDraws[i].drawNo, x.rank, csvText(x.number), x.tickets, x.buyers, csvPct(x.share), x.repeatBuyers]);
    });
    const file = csvFileName(r.csvByDraw, range);
    downloadCsv(file, ["draw_no", "rank", "number", "tickets", "buyers", "share_of_draw_pct", "repeat_buyers"], rows);
    return file;
  };

  if (selected) {
    const tickets = one.data?.totalTickets ?? 0;
    return (
      <AnalyticsCard
        title={r.title}
        description={r.subOne(drawOptionLabel(t, selected), rangeText, formatCount(tickets))}
        actions={<ExportButton onExport={exportOne} disabled={!one.data} numbersAsText />}
      >
        {one.error ? (
          <ErrorState description={n.loadError} onRetry={one.refetch} />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={one.data?.items ?? []}
              isLoading={one.isLoading}
              pageSize={PAGE_SIZE}
              manualPagination
              emptyState={<p className="text-sm text-muted-foreground">{n.empty}</p>}
            />
            {!one.isLoading && one.data && (
              <ServerPagination page={page} pageSize={PAGE_SIZE} total={one.data.total} onPageChange={setPage} />
            )}
          </>
        )}
      </AnalyticsCard>
    );
  }

  return (
    <AnalyticsCard
      title={r.title}
      description={r.subAll(rangeText)}
      actions={<ExportButton onExport={exportAll} disabled={miniDraws.length === 0} numbersAsText />}
    >
      {draws === null ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: MINI_DRAWS }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : miniDraws.length === 0 ? (
        <p className="text-sm text-muted-foreground">{r.noDraws}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {miniDraws.map((draw) => (
            <DrawMiniTable key={draw.id} draw={draw} range={range} onSelect={() => onSelectDraw(draw.id)} />
          ))}
        </div>
      )}
    </AnalyticsCard>
  );
}

/** One draw's top 5 by tickets in the period, with its status badge and the way to its full list. */
function DrawMiniTable({ draw, range, onSelect }: { draw: LotteryAdminDraw; range: DateRange | null; onSelect: () => void }) {
  const { t } = useLanguage();
  const n = t.lottery.analytics.numbers;
  const r = t.lottery.analytics.reports.byDraw;
  const dates = range ? { from: range.from, to: range.to } : {};
  const { data, isLoading, error, refetch } = useAsyncData(
    () => lotteryService.getAnalyticsNumbers({ ...dates, drawId: draw.id, sort: "tickets", order: "desc", page: 1, pageSize: MINI_COUNT }),
    [range?.from, range?.to, draw.id],
  );
  const title = drawOptionLabel(t, { ...draw, status: "published" });
  const sales = salesWindowText(t, draw);
  const empty = !!data && data.totalTickets === 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-strong)] bg-secondary/20 p-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <StatusBadge label={t.lottery.draws.statuses[draw.status]} tone={DRAW_STATUS_TONES[draw.status]} />
        </div>
        <p className="text-xs text-muted-foreground">
          {data ? (empty ? r.miniEmpty(sales) : r.miniSub(formatCount(data.totalTickets), formatCount(data.total), sales)) : sales}
        </p>
      </div>
      {error ? (
        <ErrorState description={n.loadError} onRetry={refetch} className="py-6" />
      ) : isLoading || !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: MINI_COUNT }).map((_, i) => (
            <Skeleton key={i} className="h-5 rounded" />
          ))}
        </div>
      ) : empty ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{n.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <caption className="sr-only">{r.miniCaption(title)}</caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 first:pl-3">{n.columns.rank}</TableHead>
                <TableHead className="h-9">{n.columns.number}</TableHead>
                <TableHead className="h-9 text-right">{n.columns.tickets}</TableHead>
                <TableHead className="h-9 text-right last:pr-3">{n.columns.share}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => (
                <TableRow key={row.number}>
                  <TableCell className="py-2 tabular-nums text-muted-foreground first:pl-3">{row.rank}</TableCell>
                  <TableCell className="py-2">
                    <NumberCell number={row.number} />
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums">{formatCount(row.tickets)}</TableCell>
                  <TableCell className="py-2 text-right tabular-nums last:pr-3">{formatShare(row.share)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Button variant="ghost" size="sm" className="self-start" onClick={onSelect}>
        {r.showAll(drawShortLabel(t, draw.drawNo))}
      </Button>
    </div>
  );
}
