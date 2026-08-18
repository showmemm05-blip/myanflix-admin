"use client";

import { format } from "date-fns";
import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Eye, ImageIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { TransferAccountCell } from "@/components/withdrawals/TransferAccountCell";
import { formatSignedKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Withdrawal, WithdrawalStatus } from "@/types/withdrawal";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

const STATUS_TONE: Record<WithdrawalStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export function getWithdrawalColumns({
  t,
  types,
  paymentAccounts,
  onView,
  onApprove,
  onReject,
  onTransferSaved,
  approvingId,
}: {
  t: TranslationShape;
  types: PaymentAccountType[];
  paymentAccounts: PaymentAccount[];
  onView: (withdrawal: Withdrawal) => void;
  onApprove: (withdrawal: Withdrawal) => void;
  onReject: (withdrawal: Withdrawal) => void;
  onTransferSaved: (withdrawal: Withdrawal) => void;
  approvingId?: string | null;
}): ColumnDef<Withdrawal>[] {
  const typeLogo = (accountType: string) => types.find((t) => t.value === accountType)?.logoUrl ?? null;

  return [
    {
      accessorKey: "userName",
      header: t.withdrawals.columns.customer,
      cell: ({ row }) => (
        <div className="flex max-w-40 flex-col">
          <span className="truncate text-sm font-medium">{row.original.userName}</span>
          <span className="text-xs text-muted-foreground">
            {formatLocalPhone(row.original.userPhone) ?? "—"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: t.withdrawals.columns.amount,
      cell: ({ row }) => (
        <span className="text-base font-semibold tabular-nums text-outgoing">
          {formatSignedKyat(row.original.amount, "out")}
        </span>
      ),
    },
    {
      accessorKey: "accountName",
      header: t.withdrawals.columns.destinationAccount,
      cell: ({ row }) => {
        const logoUrl = typeLogo(row.original.accountType);
        return (
          <div className="flex items-center gap-2">
            <div
              className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary/40"
              title={row.original.accountType}
            >
              {logoUrl ? (
                <Image src={logoUrl} alt={row.original.accountType} width={32} height={32} className="size-full object-cover" unoptimized />
              ) : (
                <ImageIcon className="size-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm">{row.original.accountName}</span>
              <span className="font-mono text-xs text-muted-foreground">{row.original.accountNumber}</span>
              {/* The bank the user named on this request — may differ from any bank on their profile. */}
              {row.original.bankName && (
                <span className="text-xs text-muted-foreground">{row.original.bankName}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: t.withdrawals.columns.dateTime,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm:ss")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t.withdrawals.columns.status,
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
            {withdrawal.status !== "PENDING" && withdrawal.approvedAt && (
              <span className="text-xs text-muted-foreground">
                {t.withdrawals.columns.processedAt(format(new Date(withdrawal.approvedAt), "d MMM yyyy, HH:mm:ss"))}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: t.withdrawals.columns.actions,
      cell: ({ row }) => {
        const withdrawal = row.original;
        const isApproving = approvingId === withdrawal.id;
        return (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => onView(withdrawal)}>
              <Eye className="size-3.5" />
              {t.common.view}
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
                  {t.common.approve}
                </Button>
                <Button size="sm" variant="outline" className="gap-1" disabled={isApproving} onClick={() => onReject(withdrawal)}>
                  <X className="size-3.5 text-destructive" />
                  {t.common.reject}
                </Button>
              </>
            )}
          </div>
        );
      },
    },
    {
      id: "transferAccount",
      header: t.withdrawals.columns.transferAccount,
      cell: ({ row }) => (
        <TransferAccountCell withdrawal={row.original} accounts={paymentAccounts} types={types} onSaved={onTransferSaved} />
      ),
    },
  ];
}
