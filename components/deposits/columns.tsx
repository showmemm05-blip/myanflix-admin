"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { ReceivingAccountCell } from "@/components/deposits/ReceivingAccountCell";
import { UserDepositAccountCell } from "@/components/deposits/UserDepositAccountCell";
import { formatSignedKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Deposit, DepositStatus } from "@/types/deposit";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

const STATUS_TONE: Record<DepositStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export function getDepositColumns({
  t,
  types,
  paymentAccounts,
  onApprove,
  onReject,
  onReceivingSaved,
  approvingId,
}: {
  t: TranslationShape;
  types: PaymentAccountType[];
  paymentAccounts: PaymentAccount[];
  onApprove: (deposit: Deposit) => void;
  onReject: (deposit: Deposit) => void;
  onReceivingSaved: (deposit: Deposit) => void;
  approvingId?: string | null;
}): ColumnDef<Deposit>[] {
  return [
    {
      accessorKey: "userName",
      header: t.deposits.columns.customer,
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
      header: t.deposits.columns.amount,
      cell: ({ row }) => (
        <span className="text-base font-semibold tabular-nums text-income">
          {formatSignedKyat(row.original.amount, "in")}
        </span>
      ),
    },
    {
      id: "receivingAccount",
      header: t.deposits.columns.receivingAccount,
      cell: ({ row }) => (
        <ReceivingAccountCell
          deposit={row.original}
          accounts={paymentAccounts}
          types={types}
          onSaved={onReceivingSaved}
        />
      ),
    },
    {
      accessorKey: "reference",
      header: t.deposits.columns.reference,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.reference}</span>,
    },
    {
      accessorKey: "createdAt",
      header: t.deposits.columns.dateTime,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm:ss")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t.deposits.columns.status,
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
                {t.deposits.columns.processedAt(format(new Date(deposit.approvedAt), "d MMM yyyy, HH:mm:ss"))}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: t.deposits.columns.actions,
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
              {t.common.approve}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" disabled={isApproving} onClick={() => onReject(deposit)}>
              <X className="size-3.5 text-destructive" />
              {t.common.reject}
            </Button>
          </div>
        );
      },
    },
    {
      id: "userDepositAccount",
      header: t.deposits.columns.userDepositAccount,
      cell: ({ row }) => (
        <UserDepositAccountCell
          deposit={row.original}
          accounts={paymentAccounts}
          types={types}
          onSaved={onReceivingSaved}
        />
      ),
    },
  ];
}
