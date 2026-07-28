"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import type { Deposit, DepositStatus } from "@/types/deposit";

const STATUS_TONE: Record<DepositStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export function getDepositColumns({
  onApprove,
  onReject,
}: {
  onApprove: (deposit: Deposit) => void;
  onReject: (deposit: Deposit) => void;
}): ColumnDef<Deposit>[] {
  return [
    {
      accessorKey: "userName",
      header: "User",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="max-w-40 truncate text-sm font-medium">{row.original.userName}</span>
          <span className="max-w-40 truncate text-xs text-muted-foreground">{row.original.userEmail}</span>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatKyat(row.original.amount)}</span>,
    },
    {
      accessorKey: "paymentMethod",
      header: "Method",
      cell: ({ row }) => <span className="text-sm">{row.original.paymentMethod}</span>,
    },
    {
      accessorKey: "reference",
      header: "Reference",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.reference}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Submitted",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "MMM d, yyyy HH:mm")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const deposit = row.original;
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge label={deposit.status} tone={STATUS_TONE[deposit.status]} />
            {deposit.status === "REJECTED" && deposit.rejectionReason && (
              <span className="max-w-48 truncate text-xs text-muted-foreground" title={deposit.rejectionReason}>
                {deposit.rejectionReason}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const deposit = row.original;
        if (deposit.status !== "PENDING") {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => onApprove(deposit)}>
              <Check className="size-3.5 text-success" />
              Approve
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => onReject(deposit)}>
              <X className="size-3.5 text-destructive" />
              Reject
            </Button>
          </div>
        );
      },
    },
  ];
}
