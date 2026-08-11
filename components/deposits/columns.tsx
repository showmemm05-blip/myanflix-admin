"use client";

import { format } from "date-fns";
import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, ImageIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatSignedKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import type { Deposit, DepositStatus } from "@/types/deposit";
import type { PaymentAccountType } from "@/types/payment-account";

const STATUS_TONE: Record<DepositStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export function getDepositColumns({
  types,
  onApprove,
  onReject,
  approvingId,
}: {
  types: PaymentAccountType[];
  onApprove: (deposit: Deposit) => void;
  onReject: (deposit: Deposit) => void;
  approvingId?: string | null;
}): ColumnDef<Deposit>[] {
  // paymentMethod is a free-typed label, sometimes with " - <bank name>"
  // appended (see the deposit dialogs' methodLabel() helper) — so an exact
  // match against the catalog only works for non-bank methods; everything
  // else needs the "<label> - " prefix check.
  const typeLogo = (paymentMethod: string) =>
    types.find((t) => paymentMethod === t.label || paymentMethod.startsWith(`${t.label} - `))?.logoUrl ?? null;

  return [
    {
      accessorKey: "userName",
      header: "Customer",
      cell: ({ row }) => <span className="max-w-40 truncate text-sm font-medium">{row.original.userName}</span>,
    },
    {
      accessorKey: "userPhone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="text-sm">{formatLocalPhone(row.original.userPhone) ?? <span className="text-muted-foreground">—</span>}</span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="text-base font-semibold tabular-nums text-sky-400">
          {formatSignedKyat(row.original.amount, "in")}
        </span>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: "Payment Method",
      cell: ({ row }) => {
        const logoUrl = typeLogo(row.original.paymentMethod);
        return (
          <div className="flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border border-white/[0.08] bg-secondary/20">
              {logoUrl ? (
                <Image src={logoUrl} alt="" width={24} height={24} className="size-full object-cover" unoptimized />
              ) : (
                <ImageIcon className="size-3 text-muted-foreground" />
              )}
            </div>
            <span className="text-sm">{row.original.paymentMethod}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "accountName",
      header: "Account Name",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.accountName ?? <span className="text-muted-foreground">—</span>}</span>
      ),
    },
    {
      accessorKey: "reference",
      header: "Reference / Txn ID",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.reference}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Date & Time",
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
            {deposit.status !== "PENDING" && deposit.approvedAt && (
              <span className="text-xs text-muted-foreground">
                Processed {format(new Date(deposit.approvedAt), "MMM d, yyyy HH:mm")}
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
        const isApproving = approvingId === deposit.id;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={isApproving}
              onClick={() => onApprove(deposit)}
            >
              {isApproving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5 text-success" />
              )}
              Approve
            </Button>
            <Button size="sm" variant="outline" className="gap-1" disabled={isApproving} onClick={() => onReject(deposit)}>
              <X className="size-3.5 text-destructive" />
              Reject
            </Button>
          </div>
        );
      },
    },
  ];
}
