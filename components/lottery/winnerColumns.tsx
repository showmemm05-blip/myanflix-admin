"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClaimStatusBadge } from "@/components/lottery/claims/ClaimStatusBadge";
import { formatBaht, formatKs, prizeGroupName } from "@/components/lottery/resultsFormat";
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatMmtDate, formatMmtTime } from "@/lib/myanmar-time";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import type { LotteryAdminWinner } from "@/types/lottery";

/**
 * One published draw's winning tickets. Server-paged and server-searched,
 * so sorting is off. The customer cell is the tickets table's: the label
 * over the phone (or e-mail for accounts without one). The Claim column
 * (2026-10-24) says where each ticket's payment stands; Paid and
 * Transaction are empty until the customer's claim is confirmed.
 */
export function getWinnerColumns({ t }: { t: TranslationShape }): ColumnDef<LotteryAdminWinner>[] {
  const c = t.lottery.draws.detail.winners.columns;
  return [
    {
      accessorKey: "ticketNo",
      header: c.ticket,
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.ticketNo}</span>,
    },
    {
      accessorKey: "number",
      header: c.number,
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-sm font-semibold tabular-nums">{row.original.number}</span>,
    },
    {
      id: "customer",
      header: c.customer,
      cell: ({ row }) => {
        const { user } = row.original;
        const contact = formatLocalPhone(user.phone) ?? user.email ?? "—";
        return (
          <div className="flex max-w-40 flex-col">
            <span className="truncate text-sm font-medium">{userLabel(user)}</span>
            <span className="truncate text-xs tabular-nums text-muted-foreground" title={contact}>
              {contact}
            </span>
          </div>
        );
      },
    },
    {
      id: "groups",
      header: c.groups,
      cell: ({ row }) => (
        // One line per group: a ticket can win in more than one, and the amounts add up.
        <div className="flex flex-col gap-0.5 text-sm">
          {row.original.groups.map((g) => (
            <span key={g.key}>{prizeGroupName(g.key, t)}</span>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "baht",
      header: c.baht,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatBaht(row.original.baht)}</span>,
    },
    {
      accessorKey: "ks",
      header: c.ks,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatKs(row.original.ks)}</span>,
    },
    {
      accessorKey: "claimStatus",
      header: c.claim,
      enableSorting: false,
      cell: ({ row }) => <ClaimStatusBadge status={row.original.claimStatus} />,
    },
    {
      accessorKey: "paidAt",
      header: c.paidAt,
      enableSorting: false,
      cell: ({ row }) => {
        const at = row.original.paidAt;
        return at ? (
          <span className="flex flex-col text-sm tabular-nums text-muted-foreground">
            <span>{formatMmtDate(at)}</span>
            <span className="text-xs">{formatMmtTime(at)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "transactionId",
      header: c.transaction,
      enableSorting: false,
      cell: ({ row }) => {
        const id = row.original.transactionId;
        return id ? (
          <span className="block max-w-28 truncate font-mono text-xs text-muted-foreground" title={id}>
            {id}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
  ];
}
