"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import { matchesUserSearch } from "@/lib/user-search";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Transaction, TransactionStatus } from "@/types/transaction";

const STATUS_TONE: Record<TransactionStatus, StatusTone> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "danger",
};

export function getTransactionColumns(t: TranslationShape): ColumnDef<Transaction>[] {
  const typeLabels: Record<Transaction["type"], string> = {
    DEPOSIT: t.finance.columns.typeDeposit,
    PURCHASE: t.finance.columns.typePurchase,
    REFUND: t.finance.columns.typeRefund,
  };

  return [
    {
      accessorKey: "id",
      header: t.finance.columns.transactionId,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.id}</span>
      ),
    },
    {
      accessorKey: "userName",
      header: t.finance.columns.customer,
      // The ledger renders the display label, so the search also matches the
      // raw login identity behind it — otherwise an account named only by its
      // username becomes unfindable the moment its owner picks a name.
      filterFn: (row, _columnId, value) =>
        matchesUserSearch(String(value), {
          name: row.original.userName,
          username: row.original.userUsername,
        }),
      cell: ({ row }) => {
        const txn = row.original;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback>{txn.userName.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="max-w-32 truncate text-sm font-medium">{txn.userName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "movieTitle",
      header: t.finance.columns.movie,
      cell: ({ row }) => (
        <span className="max-w-40 truncate text-sm text-muted-foreground">
          {row.original.movieTitle ?? <span className="italic">—</span>}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: t.finance.columns.amount,
      cell: ({ row }) => {
        const amount = row.original.amount;
        return (
          <span className={`text-base font-semibold tabular-nums ${amount < 0 ? "text-destructive" : ""}`}>
            {formatKyat(amount)}
          </span>
        );
      },
    },
    {
      accessorKey: "type",
      header: t.finance.columns.type,
      cell: ({ row }) => <Badge variant="outline">{typeLabels[row.original.type]}</Badge>,
    },
    {
      accessorKey: "createdAt",
      header: t.finance.columns.date,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t.finance.columns.status,
      cell: ({ row }) => <StatusBadge label={row.original.status} tone={STATUS_TONE[row.original.status]} />,
    },
  ];
}
