"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import type { Transaction, TransactionStatus } from "@/types/transaction";

const STATUS_TONE: Record<TransactionStatus, StatusTone> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "danger",
};

const TYPE_LABELS: Record<Transaction["type"], string> = {
  DEPOSIT: "Deposit",
  PURCHASE: "Purchase",
  REFUND: "Refund",
};

export const transactionColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "id",
    header: "Transaction ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.id}</span>
    ),
  },
  {
    accessorKey: "userName",
    header: "User",
    cell: ({ row }) => {
      const txn = row.original;
      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarImage src={txn.userAvatarUrl} alt={txn.userName} />
            <AvatarFallback>{txn.userName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <span className="max-w-32 truncate text-sm font-medium">{txn.userName}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "movieTitle",
    header: "Movie",
    cell: ({ row }) => (
      <span className="max-w-40 truncate text-sm text-muted-foreground">
        {row.original.movieTitle ?? <span className="italic">—</span>}
      </span>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = row.original.amount;
      return (
        <span className={`font-medium tabular-nums ${amount < 0 ? "text-destructive" : ""}`}>
          {formatKyat(amount)}
        </span>
      );
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <Badge variant="outline">{TYPE_LABELS[row.original.type]}</Badge>,
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {format(new Date(row.original.createdAt), "MMM d, yyyy")}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge label={row.original.status} tone={STATUS_TONE[row.original.status]} />,
  },
];
