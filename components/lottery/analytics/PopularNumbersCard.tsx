"use client";

import { useState } from "react";
import { ErrorState } from "@/components/shared/ErrorState";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useLanguage } from "@/lib/context/language-context";
import { lotteryService } from "@/services/api/lotteryService";
import {
  LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE,
  type LotteryAnalyticsNumberRow,
  type LotteryAnalyticsNumberSort,
  type LotteryAnalyticsSortOrder,
} from "@/types/lottery-analytics";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { csvFileName, csvPct, csvText, downloadCsv } from "@/components/lottery/analytics/csv";
import { formatCount, formatShare } from "@/components/lottery/analytics/format";
import { getNumberColumns } from "@/components/lottery/analytics/numberColumns";
import type { DateRange } from "@/components/lottery/analytics/period";

const PAGE_SIZE = 10;
const TOP_COUNT = 10;

interface PopularNumbersCardProps {
  range: DateRange;
  /** Empty = all draws. */
  drawId: string;
  /** The selected draw's number, for the export's file name; null for all draws or an unlisted draw. */
  drawNo: number | null;
  rangeText: string;
  /** The comparison period in words ("Thu 9–Wed 15 Oct"), or null when there is no earlier data. */
  previousLabel: string | null;
}

/**
 * The share bars of the top 10 by tickets BESIDE the sortable paged table
 * (Rank · Number · Tickets · Buyers · Share · Trend · Repeat buys) — the
 * board's full-width card, bars and note in the narrower left column
 * (1fr), the seven-column table in the wider right one (1.7fr), stacked on
 * a phone. The sort runs on the SERVER (sort/order on the request): the
 * table is paged, so sorting the ten rows in hand would mislead. The bars
 * always show the tickets-desc top 10, whatever the table is sorted by —
 * one request serves both while the table sits on its default order.
 *
 * The page mounts this with a `key` of the period and the draw, so a new
 * selection starts from page 1 of the default sort.
 */
export function PopularNumbersCard({ range, drawId, drawNo, rangeText, previousLabel }: PopularNumbersCardProps) {
  const { t } = useLanguage();
  const n = t.lottery.analytics.numbers;
  const [sort, setSort] = useState<LotteryAnalyticsNumberSort>("tickets");
  const [order, setOrder] = useState<LotteryAnalyticsSortOrder>("desc");
  const [page, setPage] = useState(1);

  const base = { from: range.from, to: range.to, drawId: drawId || undefined };
  const isDefault = sort === "tickets" && order === "desc" && page === 1;

  const top = useAsyncData(
    () => lotteryService.getAnalyticsNumbers({ ...base, sort: "tickets", order: "desc", page: 1, pageSize: PAGE_SIZE }),
    [range.from, range.to, drawId],
  );
  // Only fetched off the default order/page — otherwise the top-10 request already holds the table's rows.
  const table = useAsyncData(
    () => (isDefault ? Promise.resolve(null) : lotteryService.getAnalyticsNumbers({ ...base, sort, order, page, pageSize: PAGE_SIZE })),
    [range.from, range.to, drawId, sort, order, page, isDefault],
  );

  const pageData = isDefault ? top.data : table.data;
  const tableLoading = isDefault ? top.isLoading : table.isLoading;
  const tableError = isDefault ? top.error : table.error;
  const refetch = () => {
    top.refetch();
    if (!isDefault) table.refetch();
  };
  useClampPage({
    page,
    pageSize: PAGE_SIZE,
    rowCount: pageData?.items.length,
    total: pageData?.total,
    isLoading: tableLoading,
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

  const columns = getNumberColumns({ t, sort, order, onSort: changeSort, shareLabel: n.columns.share, withTrend: true });
  const rows: LotteryAnalyticsNumberRow[] = pageData?.items ?? [];
  const bars = (top.data?.items ?? []).slice(0, TOP_COUNT);
  const maxShare = bars[0]?.share ?? 0;
  const totalTickets = top.data?.totalTickets ?? pageData?.totalTickets ?? 0;

  const exportCsv = async () => {
    const all = await lotteryService.getAnalyticsNumbers({ ...base, sort, order, page: 1, pageSize: LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE });
    const file = csvFileName(n.csvStem, range, drawId ? `draw-${drawNo ?? drawId.slice(0, 8)}` : undefined);
    downloadCsv(
      file,
      ["rank", "number", "tickets", "buyers", "share_pct", "previous_tickets", "change_pct", "is_new", "repeat_buyers"],
      all.items.map((r) => [
        r.rank,
        csvText(r.number),
        r.tickets,
        r.buyers,
        csvPct(r.share),
        r.trend.previousTickets ?? "",
        r.trend.changePct === null ? "" : csvPct(r.trend.changePct),
        r.trend.isNew ? "yes" : "no",
        r.repeatBuyers,
      ]),
    );
    return file;
  };

  return (
    <AnalyticsCard
      title={n.title}
      description={n.sub(rangeText, previousLabel ? n.trendVs(previousLabel) : n.trendNone)}
      actions={<ExportButton onExport={exportCsv} disabled={!top.data} numbersAsText />}
    >
      {top.error && isDefault ? (
        <ErrorState description={n.loadError} onRetry={refetch} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">{n.barsTitle}</p>
              {top.isLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 rounded" />
                  ))}
                </div>
              ) : top.error ? (
                <ErrorState description={n.loadError} onRetry={top.refetch} className="py-8" />
              ) : bars.length === 0 ? (
                <p className="text-sm text-muted-foreground">{n.empty}</p>
              ) : (
                <ol className="flex flex-col gap-1.5">
                  {bars.map((row) => (
                    <li
                      key={row.number}
                      className="grid grid-cols-[1.5rem_5.5rem_1fr_3.5rem] items-center gap-2 text-xs"
                      aria-label={n.barLabel(row.rank, row.number, formatShare(row.share))}
                    >
                      <span className="tabular-nums text-muted-foreground">{row.rank}</span>
                      <span className="font-mono tracking-[0.12em] tabular-nums">{row.number}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-muted-foreground/10">
                        <span
                          className="block h-full rounded-full bg-[var(--chart-1)]"
                          style={{ width: `${maxShare > 0 ? Math.max(2, (row.share / maxShare) * 100) : 0}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">{formatShare(row.share)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{n.note(formatCount(totalTickets))}</p>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {tableError ? (
              <ErrorState description={n.loadError} onRetry={refetch} className="py-8" />
            ) : (
              <>
                <DataTable
                  columns={columns}
                  data={rows}
                  isLoading={tableLoading}
                  pageSize={PAGE_SIZE}
                  manualPagination
                  emptyState={<p className="text-sm text-muted-foreground">{n.empty}</p>}
                />
                {!tableLoading && pageData && (
                  <ServerPagination page={page} pageSize={PAGE_SIZE} total={pageData.total} onPageChange={setPage} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </AnalyticsCard>
  );
}
