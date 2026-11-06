"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ErrorState } from "@/components/shared/ErrorState";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useLanguage } from "@/lib/context/language-context";
import { lotteryService } from "@/services/api/lotteryService";
import {
  LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE,
  type LotteryAnalyticsAcrossRow,
  type LotteryAnalyticsAcrossSort,
  type LotteryAnalyticsSortOrder,
} from "@/types/lottery-analytics";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { SortHeader } from "@/components/lottery/analytics/SortHeader";
import { csvFileName, csvPct, csvText, downloadCsv } from "@/components/lottery/analytics/csv";
import { drawShortLabel, formatCount, formatShare } from "@/components/lottery/analytics/format";
import { NumberCell } from "@/components/lottery/analytics/numberColumns";
import type { DateRange } from "@/components/lottery/analytics/period";

const PAGE_SIZE = 10;

interface AcrossDrawsCardProps {
  range: DateRange | null;
  rangeText: string;
}

/**
 * Rank · Number · Tickets · Buyers · Share · Draws played · Best rank over
 * every draw with sales in the period — never limited by the draw select,
 * which is the point of the card. Server sort and paging like the others.
 */
export function AcrossDrawsCard({ range, rangeText }: AcrossDrawsCardProps) {
  const { t } = useLanguage();
  const n = t.lottery.analytics.numbers;
  const r = t.lottery.analytics.reports.across;
  const [sort, setSort] = useState<LotteryAnalyticsAcrossSort>("tickets");
  const [order, setOrder] = useState<LotteryAnalyticsSortOrder>("desc");
  const [page, setPage] = useState(1);
  const dates = range ? { from: range.from, to: range.to } : {};

  const { data, isLoading, error, refetch } = useAsyncData(
    () => lotteryService.getAnalyticsNumbersAcross({ ...dates, sort, order, page, pageSize: PAGE_SIZE }),
    [range?.from, range?.to, sort, order, page],
  );
  useClampPage({
    page,
    pageSize: PAGE_SIZE,
    rowCount: data?.items.length,
    total: data?.total,
    isLoading,
    onPageChange: setPage,
  });

  const changeSort = (next: LotteryAnalyticsAcrossSort) => {
    if (next === sort) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(next);
      setOrder("desc");
    }
    setPage(1);
  };
  const sortable = (key: LotteryAnalyticsAcrossSort, label: string) => (
    <SortHeader label={label} active={sort === key} order={order} onClick={() => changeSort(key)} alignRight />
  );

  const columns: ColumnDef<LotteryAnalyticsAcrossRow>[] = [
    { accessorKey: "rank", header: n.columns.rank, enableSorting: false, cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.rank}</span> },
    { accessorKey: "number", header: n.columns.number, enableSorting: false, cell: ({ row }) => <NumberCell number={row.original.number} /> },
    { accessorKey: "tickets", header: () => sortable("tickets", n.columns.tickets), enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.tickets)}</span> },
    { accessorKey: "buyers", header: () => sortable("buyers", n.columns.buyers), enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.buyers)}</span> },
    { accessorKey: "share", header: n.columns.share, enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{formatShare(row.original.share)}</span> },
    { accessorKey: "drawsPlayed", header: () => sortable("draws", n.columns.drawsPlayed), enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{r.drawsPlayed(row.original.drawsPlayed)}</span> },
    {
      id: "bestRank",
      header: n.columns.bestRank,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.bestRank ? (
          <span className="tabular-nums">{r.bestRank(row.original.bestRank.rank, drawShortLabel(t, row.original.bestRank.drawNo))}</span>
        ) : (
          <span className="text-muted-foreground">{t.lottery.analytics.none}</span>
        ),
    },
  ];

  const exportCsv = async () => {
    const all = await lotteryService.getAnalyticsNumbersAcross({ ...dates, sort, order, page: 1, pageSize: LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE });
    const file = csvFileName(r.csvStem, range);
    downloadCsv(
      file,
      ["rank", "number", "tickets", "buyers", "share_pct", "draws_played", "best_rank", "best_rank_draw_no"],
      all.items.map((x) => [x.rank, csvText(x.number), x.tickets, x.buyers, csvPct(x.share), x.drawsPlayed, x.bestRank?.rank ?? "", x.bestRank?.drawNo ?? ""]),
    );
    return file;
  };

  return (
    <AnalyticsCard
      title={r.title}
      description={r.sub(rangeText, formatCount(data?.totalTickets ?? 0))}
      actions={<ExportButton onExport={exportCsv} disabled={!data} numbersAsText />}
    >
      {error ? (
        <ErrorState description={n.loadError} onRetry={refetch} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            isLoading={isLoading}
            pageSize={PAGE_SIZE}
            manualPagination
            emptyState={<p className="text-sm text-muted-foreground">{n.empty}</p>}
          />
          {!isLoading && data && <ServerPagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />}
        </>
      )}
    </AnalyticsCard>
  );
}
