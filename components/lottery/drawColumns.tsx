"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import { DRAW_STATUS_TONES } from "@/components/lottery/drawFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatKyat } from "@/lib/currency";
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatDateOnly, formatMmt } from "@/lib/myanmar-time";
import type { LotteryAdminDraw } from "@/types/lottery";

/**
 * The draws list. Sorting is off: the list is server-paged (newest draw
 * number first), so sorting one page would mislead. Times are Myanmar time
 * — the header says MMT.
 */
export function getDrawColumns({ t }: { t: TranslationShape }): ColumnDef<LotteryAdminDraw>[] {
  const c = t.lottery.draws.columns;
  return [
    {
      accessorKey: "drawNo",
      header: c.drawNo,
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-sm font-semibold tabular-nums">{row.original.drawNo}</span>,
    },
    {
      accessorKey: "thaiDrawDate",
      header: c.thaiDrawDate,
      enableSorting: false,
      cell: ({ row }) => <span className="text-sm tabular-nums">{formatDateOnly(row.original.thaiDrawDate)}</span>,
    },
    {
      accessorKey: "salesCloseAt",
      header: c.salesClose,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">{formatMmt(row.original.salesCloseAt)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: c.status,
      enableSorting: false,
      cell: ({ row }) => {
        const draw = row.original;
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge label={t.lottery.draws.statuses[draw.status]} tone={DRAW_STATUS_TONES[draw.status]} />
            {/* A published draw says what it paid; the counts come with the row, null until published. */}
            {draw.status === "published" && draw.winnersCount !== null && draw.prizesPaidKs !== null && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {t.lottery.draws.publishedLine(draw.winnersCount, formatKyat(draw.prizesPaidKs))}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "ticketsSold",
      header: c.ticketsSold,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{row.original.ticketsSold.toLocaleString("en-US")}</span>,
    },
    {
      accessorKey: "revenueKs",
      header: c.revenue,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatKyat(row.original.revenueKs)}</span>,
    },
    {
      accessorKey: "buyers",
      header: c.buyers,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{row.original.buyers.toLocaleString("en-US")}</span>,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/lottery/draws/${row.original.id}`} />}
            nativeButton={false}
          >
            {t.lottery.draws.open}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];
}
