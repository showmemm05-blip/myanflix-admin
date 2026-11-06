"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ClaimStatusBadge } from "@/components/lottery/claims/ClaimStatusBadge";
import { claimDrawLabel, formatMoney } from "@/components/lottery/claims/claimFormat";
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatMmtDate, formatMmtTime } from "@/lib/myanmar-time";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import type { LotteryAdminClaim } from "@/types/lottery";

/**
 * One row per customer per draw. Server-paged, server-filtered and
 * server-searched, so sorting is off. The customer cell is the winners
 * table's: the label over the phone (or e-mail for accounts without one).
 * The action is "Review" (primary) for a waiting claim and "View" for the
 * rest — paid and not-requested rows open read-only, rejected ones add
 * "Review again" inside the dialog.
 */
export function getClaimColumns({
  t,
  onOpen,
}: {
  t: TranslationShape;
  onOpen: (row: LotteryAdminClaim) => void;
}): ColumnDef<LotteryAdminClaim>[] {
  const c = t.lottery.claims;
  const col = c.columns;
  return [
    {
      accessorKey: "requestedAt",
      header: col.requestedAt,
      enableSorting: false,
      cell: ({ row }) => {
        const at = row.original.requestedAt;
        return at ? (
          <span className="flex flex-col text-sm tabular-nums">
            <span>{formatMmtDate(at)}</span>
            <span className="text-xs text-muted-foreground">{formatMmtTime(at)}</span>
          </span>
        ) : (
          <span className="flex flex-col text-sm text-muted-foreground">
            <span>—</span>
            <span className="text-xs">{c.notRequestedCell}</span>
          </span>
        );
      },
    },
    {
      id: "customer",
      header: col.customer,
      cell: ({ row }) => {
        const { user } = row.original;
        const contact = formatLocalPhone(user.phone) ?? user.email ?? "—";
        return (
          <div className="flex max-w-44 flex-col">
            <span className="truncate text-sm font-medium">{userLabel(user)}</span>
            <span className="truncate text-xs tabular-nums text-muted-foreground" title={contact}>
              {contact}
            </span>
          </div>
        );
      },
    },
    {
      id: "draw",
      header: col.draw,
      cell: ({ row }) => <span className="whitespace-nowrap text-sm tabular-nums">{claimDrawLabel(t, row.original)}</span>,
    },
    {
      accessorKey: "ticketsCount",
      header: col.tickets,
      enableSorting: false,
      cell: ({ row }) => <span className="text-sm tabular-nums">{c.ticketCount(row.original.ticketsCount)}</span>,
    },
    {
      accessorKey: "ks",
      header: col.ks,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatMoney(row.original.ks)}</span>,
    },
    {
      accessorKey: "status",
      header: col.status,
      enableSorting: false,
      cell: ({ row }) => <ClaimStatusBadge status={row.original.status} />,
    },
    {
      id: "action",
      header: () => <span className="sr-only">{col.action}</span>,
      cell: ({ row }) => {
        const claim = row.original;
        const waiting = claim.status === "requested";
        return (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant={waiting ? "default" : "outline"}
              onClick={() => onOpen(claim)}
              aria-label={`${waiting ? c.review : c.view} · ${userLabel(claim.user)} · ${claimDrawLabel(t, claim)}`}
            >
              {waiting ? c.review : c.view}
            </Button>
          </div>
        );
      },
    },
  ];
}
