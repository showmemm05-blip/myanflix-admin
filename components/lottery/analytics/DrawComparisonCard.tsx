"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/tables/DataTable";
import { ServerPagination } from "@/components/tables/ServerPagination";
import { DRAW_STATUS_TONES } from "@/components/lottery/drawFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useClampPage } from "@/lib/hooks/use-clamp-page";
import { useLanguage } from "@/lib/context/language-context";
import { formatKyat } from "@/lib/currency";
import { formatDateOnly, formatMmtDate } from "@/lib/myanmar-time";
import { lotteryService } from "@/services/api/lotteryService";
import type { LotteryAnalyticsDrawRow } from "@/types/lottery-analytics";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { csvFileName, downloadCsv } from "@/components/lottery/analytics/csv";
import { drawOptionLabel, formatCount, hourRangeLabel } from "@/components/lottery/analytics/format";

const PAGE_SIZE = 25;
/** The export takes the newest draws up to the backend's page cap. */
const EXPORT_PAGE_SIZE = 100;

/** "0.00" strings from the SUM() → kyat; "—" when the wire has null. */
function kyat(value: string | null): string {
  if (value === null) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? formatKyat(n) : value;
}

interface DrawComparisonCardProps {
  /** Highlighted in the table; "" for none. */
  selectedDrawId: string;
}

/**
 * Draw · Sales period (MMT) · Tickets · Buyers · Revenue · Peak hour ·
 * Winners paid · Status, one row per draw, newest first, whole sales
 * windows (never limited by the period). The draw selected above is
 * highlighted; an undrawn draw says "Not drawn yet (date)".
 */
export function DrawComparisonCard({ selectedDrawId }: DrawComparisonCardProps) {
  const { t } = useLanguage();
  const a = t.lottery.analytics;
  const c = a.reports.comparison;
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useAsyncData(
    () => lotteryService.getAnalyticsDraws({ page, pageSize: PAGE_SIZE }),
    [page],
  );
  useClampPage({
    page,
    pageSize: PAGE_SIZE,
    rowCount: data?.items.length,
    total: data?.total,
    isLoading,
    onPageChange: setPage,
  });

  const salesPeriod = (row: LotteryAnalyticsDrawRow) => {
    if (!row.openedAt) return c.salesNotOpened;
    const span = a.date.span(formatMmtDate(row.openedAt), formatMmtDate(row.salesCloseAt));
    return row.status === "open" || row.status === "paused" ? c.salesSoFar(span) : span;
  };
  const winners = (row: LotteryAnalyticsDrawRow) =>
    row.status === "published" && row.winnersCount !== null
      ? c.winnersPaid(formatCount(row.winnersCount), kyat(row.prizesPaidKs))
      : c.notDrawn(formatDateOnly(row.thaiDrawDate));

  const columns: ColumnDef<LotteryAnalyticsDrawRow>[] = [
    { id: "draw", header: c.columns.draw, enableSorting: false, cell: ({ row }) => <span className="font-medium">{drawOptionLabel(t, { ...row.original, status: "published" })}</span> },
    { id: "sales", header: c.columns.sales, enableSorting: false, cell: ({ row }) => <span className="text-muted-foreground">{salesPeriod(row.original)}</span> },
    { accessorKey: "tickets", header: c.columns.tickets, enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.tickets)}</span> },
    { accessorKey: "buyers", header: c.columns.buyers, enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.buyers)}</span> },
    { accessorKey: "revenueKs", header: c.columns.revenue, enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <span className="tabular-nums">{kyat(row.original.revenueKs)}</span> },
    { accessorKey: "peakHour", header: c.columns.peakHour, enableSorting: false, cell: ({ row }) => <span className="tabular-nums">{row.original.peakHour === null ? a.none : hourRangeLabel(t, row.original.peakHour)}</span> },
    { id: "winners", header: c.columns.winners, enableSorting: false, cell: ({ row }) => <span className={row.original.status === "published" ? "tabular-nums" : "text-muted-foreground"}>{winners(row.original)}</span> },
    { accessorKey: "status", header: c.columns.status, enableSorting: false, cell: ({ row }) => <StatusBadge label={t.lottery.draws.statuses[row.original.status]} tone={DRAW_STATUS_TONES[row.original.status]} /> },
  ];

  const exportCsv = async () => {
    const all = await lotteryService.getAnalyticsDraws({ page: 1, pageSize: EXPORT_PAGE_SIZE });
    const file = csvFileName(c.csvStem, null);
    downloadCsv(
      file,
      ["draw_no", "thai_draw_date", "status", "opened_at_utc", "sales_close_at_utc", "tickets", "buyers", "revenue_ks", "peak_hour_mmt", "winners_count", "prizes_paid_ks"],
      all.items.map((r) => [r.drawNo, r.thaiDrawDate, r.status, r.openedAt ?? "", r.salesCloseAt, r.tickets, r.buyers, r.revenueKs, r.peakHour ?? "", r.winnersCount ?? "", r.prizesPaidKs ?? ""]),
    );
    return file;
  };

  return (
    <AnalyticsCard title={c.title} description={c.sub} actions={<ExportButton onExport={exportCsv} disabled={!data} />}>
      {error ? (
        <ErrorState description={a.states.cardError} onRetry={refetch} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            isLoading={isLoading}
            pageSize={PAGE_SIZE}
            manualPagination
            rowClassName={(row) => (row.id === selectedDrawId ? "bg-primary/10 shadow-[inset_2px_0_0_var(--primary)]" : undefined)}
            emptyState={<p className="text-sm text-muted-foreground">{c.empty}</p>}
          />
          {!isLoading && data && <ServerPagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />}
          <p className="text-xs text-muted-foreground">{c.note}</p>
        </>
      )}
    </AnalyticsCard>
  );
}
