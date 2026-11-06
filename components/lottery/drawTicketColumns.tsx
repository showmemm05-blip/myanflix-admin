"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { TICKET_STATUS_TONES } from "@/components/lottery/drawFormat";
import { formatKs, prizeGroupName } from "@/components/lottery/resultsFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatMmtDate, formatMmtTime } from "@/lib/myanmar-time";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import type { LotteryAdminTicket } from "@/types/lottery";

/**
 * One draw's tickets. Server-paged and server-searched, so sorting is off.
 * The customer cell reads like the deposits queue's: the label over the
 * phone (or e-mail for accounts without one).
 */
export function getDrawTicketColumns({ t }: { t: TranslationShape }): ColumnDef<LotteryAdminTicket>[] {
  const c = t.lottery.draws.detail.tickets.columns;
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
      accessorKey: "purchaseRef",
      header: c.purchaseRef,
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.purchaseRef}</span>,
    },
    {
      accessorKey: "boughtAt",
      header: c.boughtAt,
      enableSorting: false,
      // Stacked, not joined: the date over the time halves the column's width.
      cell: ({ row }) => (
        <span className="flex flex-col text-sm tabular-nums text-muted-foreground">
          <span>{formatMmtDate(row.original.boughtAt)}</span>
          <span className="text-xs">{formatMmtTime(row.original.boughtAt)}</span>
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: c.status,
      enableSorting: false,
      cell: ({ row }) => {
        const ticket = row.original;
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge
              label={t.lottery.draws.detail.tickets.statuses[ticket.status]}
              tone={TICKET_STATUS_TONES[ticket.status]}
            />
            {/* A won ticket shows what it was paid and in which groups (a number can win in more than one). A row without the field (the backend half that pays is not in yet) just shows the badge. */}
            {ticket.status === "won" && typeof ticket.prizeKs === "number" && (
              <span
                className="text-xs tabular-nums text-muted-foreground"
                title={ticket.wonGroups?.map((g) => prizeGroupName(g.key, t)).join(" · ")}
              >
                {formatKs(ticket.prizeKs)}
              </span>
            )}
          </div>
        );
      },
    },
  ];
}
