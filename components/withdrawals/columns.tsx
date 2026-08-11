"use client";

import { format } from "date-fns";
import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Eye, ImageIcon, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatSignedKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import type { Withdrawal, WithdrawalStatus } from "@/types/withdrawal";
import type { PaymentAccountType } from "@/types/payment-account";

const STATUS_TONE: Record<WithdrawalStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export function getWithdrawalColumns({
  types,
  onView,
  onApprove,
  onReject,
  onEdit,
  approvingId,
}: {
  types: PaymentAccountType[];
  onView: (withdrawal: Withdrawal) => void;
  onApprove: (withdrawal: Withdrawal) => void;
  onReject: (withdrawal: Withdrawal) => void;
  onEdit: (withdrawal: Withdrawal) => void;
  approvingId?: string | null;
}): ColumnDef<Withdrawal>[] {
  const typeLogo = (accountType: string) => types.find((t) => t.value === accountType)?.logoUrl ?? null;

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
        <span className="text-base font-semibold tabular-nums text-violet-400">
          {formatSignedKyat(row.original.amount, "out")}
        </span>
      ),
    },
    {
      accessorKey: "accountType",
      header: "Payout Method",
      cell: ({ row }) => {
        const logoUrl = typeLogo(row.original.accountType);
        return (
          <div className="flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border border-white/[0.08] bg-secondary/20">
              {logoUrl ? (
                <Image src={logoUrl} alt="" width={24} height={24} className="size-full object-cover" unoptimized />
              ) : (
                <ImageIcon className="size-3 text-muted-foreground" />
              )}
            </div>
            <span className="text-sm">{row.original.accountType}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "accountName",
      header: "Destination Account",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.accountName}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.original.accountNumber}</span>
        </div>
      ),
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
        const withdrawal = row.original;
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge label={withdrawal.status} tone={STATUS_TONE[withdrawal.status]} />
            {withdrawal.status === "REJECTED" && withdrawal.rejectionReason && (
              <span className="max-w-48 truncate text-xs text-muted-foreground" title={withdrawal.rejectionReason}>
                {withdrawal.rejectionReason}
              </span>
            )}
            {withdrawal.status === "APPROVED" &&
              (withdrawal.transferAccountType ? (
                <StatusBadge label="Transfer added" tone="success" />
              ) : (
                <StatusBadge label="Transfer needed" tone="warning" />
              ))}
            {withdrawal.status !== "PENDING" && withdrawal.approvedAt && (
              <span className="text-xs text-muted-foreground">
                Processed {format(new Date(withdrawal.approvedAt), "MMM d, yyyy HH:mm")}
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
        const withdrawal = row.original;
        const isApproving = approvingId === withdrawal.id;
        return (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => onView(withdrawal)}>
              <Eye className="size-3.5" />
              View
            </Button>
            {withdrawal.status === "PENDING" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={isApproving}
                  onClick={() => onApprove(withdrawal)}
                >
                  {isApproving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5 text-success" />
                  )}
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="gap-1" disabled={isApproving} onClick={() => onReject(withdrawal)}>
                  <X className="size-3.5 text-destructive" />
                  Reject
                </Button>
              </>
            )}
            {withdrawal.status === "APPROVED" && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onEdit(withdrawal)}>
                <Pencil className="size-3.5" />
                {withdrawal.transferAccountType ? "Edit Transfer Account" : "Add Transfer Account"}
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
