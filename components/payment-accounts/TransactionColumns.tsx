"use client";

import Image from "next/image";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel, userLabelOr } from "@/lib/user-label";
import { CREDIT_TRANSACTION_TYPES } from "@/types/payment-account-transaction";
import type { PaymentAccountTransaction } from "@/types/payment-account-transaction";
import type { PaymentAccountType } from "@/types/payment-account";
import type { TranslationShape } from "@/lib/i18n/translations";

const TYPE_TONE: Record<PaymentAccountTransaction["type"], StatusTone> = {
  OPENING_BALANCE: "info",
  MANUAL_CREDIT: "success",
  MANUAL_DEBIT: "warning",
  DEPOSIT_IN: "success",
  WITHDRAWAL_OUT: "warning",
  ADJUSTMENT_CREDIT: "info",
  ADJUSTMENT_DEBIT: "info",
};

/**
 * One tint per transaction type so a long ledger reads at a glance. Kept faint
 * (7% fill) with a solid left edge doing the actual identifying — a stronger
 * fill would fight the amount/badge colours already in the row and hurt text
 * contrast on the dark theme. Money-in types sit in the cool blue/teal/green
 * half of the wheel, money-out in the warm magenta/clay/amber half.
 */
const TYPE_ROW_TINT: Record<PaymentAccountTransaction["type"], string> = {
  OPENING_BALANCE: "bg-chart-2/[0.07] hover:bg-chart-2/[0.12] shadow-[inset_3px_0_0_var(--chart-2)]",
  // --success rather than --income — side by side with DEPOSIT_IN, the same
  // money-in teal was indistinguishable at this opacity.
  MANUAL_CREDIT: "bg-success/[0.07] hover:bg-success/[0.12] shadow-[inset_3px_0_0_var(--success)]",
  MANUAL_DEBIT: "bg-warning/[0.07] hover:bg-warning/[0.12] shadow-[inset_3px_0_0_var(--warning)]",
  DEPOSIT_IN: "bg-income/[0.09] hover:bg-income/[0.14] shadow-[inset_3px_0_0_var(--income)]",
  WITHDRAWAL_OUT: "bg-outgoing/[0.09] hover:bg-outgoing/[0.14] shadow-[inset_3px_0_0_var(--outgoing)]",
  ADJUSTMENT_CREDIT: "bg-info/[0.07] hover:bg-info/[0.12] shadow-[inset_3px_0_0_var(--info)]",
  ADJUSTMENT_DEBIT: "bg-chart-5/[0.07] hover:bg-chart-5/[0.12] shadow-[inset_3px_0_0_var(--chart-5)]",
};

/** Pass to DataTable's `rowClassName` to colour each row by its type. */
export function getPaymentAccountTransactionRowClass(transaction: PaymentAccountTransaction) {
  return TYPE_ROW_TINT[transaction.type];
}

interface GetPaymentAccountTransactionColumnsOptions {
  t: TranslationShape;
  /** Supplies each method's logo for the customer-bank cell; empty list falls back to the placeholder icon. */
  types?: PaymentAccountType[];
  /** Central cross-account view adds a column identifying which account each row belongs to. */
  showAccount?: boolean;
  /** Opens the full record. The table stays a summary — everything else lives in the panel. */
  onViewDetails: (transaction: PaymentAccountTransaction) => void;
}

export function getPaymentAccountTransactionColumns({
  t,
  types = [],
  showAccount = false,
  onViewDetails,
}: GetPaymentAccountTransactionColumnsOptions): ColumnDef<PaymentAccountTransaction>[] {
  const typeLabel = (value: string) => types.find((type) => type.value === value)?.label ?? value;
  const typeLogo = (value: string) => types.find((type) => type.value === value)?.logoUrl ?? null;

  const columns: ColumnDef<PaymentAccountTransaction>[] = [];

  if (showAccount) {
    columns.push({
      id: "account",
      header: t.paymentAccountLedger.transactionColumns.account,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.paymentAccount.accountName}</span>
          {row.original.paymentAccount.subname && (
            <span className="text-xs text-muted-foreground">{row.original.paymentAccount.subname}</span>
          )}
        </div>
      ),
    });
  }

  columns.push(
    {
      accessorKey: "type",
      header: t.paymentAccountLedger.transactionColumns.type,
      cell: ({ row }) => (
        <StatusBadge
          label={t.paymentAccountLedger.types[row.original.type]}
          tone={TYPE_TONE[row.original.type]}
        />
      ),
    },
    {
      accessorKey: "amount",
      header: t.paymentAccountLedger.transactionColumns.amount,
      cell: ({ row }) => {
        const isCredit = CREDIT_TRANSACTION_TYPES.includes(row.original.type);
        return (
          <span className={isCredit ? "font-medium text-income" : "font-medium text-outgoing"}>
            {isCredit ? "+" : "-"}
            {formatKyat(row.original.amount)}
          </span>
        );
      },
    },
    // The linked customer and their submitted payout details, surfaced from
    // the details panel so a reviewer can scan them without opening each row.
    // All five are display-only columns (no accessorKey): they add no sort
    // toggles and cannot disturb the existing sorting/filter/pagination.
    {
      id: "customer",
      header: t.paymentAccountLedger.transactionColumns.customer,
      cell: ({ row }) => {
        // A row is never linked to both — whichever exists carries the customer.
        // Reversal entries keep their link, so they show the same party.
        const customer = (row.original.relatedDeposit ?? row.original.relatedWithdrawal)?.user;
        if (!customer) return <span className="text-sm">—</span>;
        return (
          <div className="flex max-w-36 flex-col">
            <span className="truncate text-sm" title={userLabel(customer)}>
              {userLabel(customer)}
            </span>
            <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
              {formatLocalPhone(customer.phone ?? null) || "—"}
            </span>
          </div>
        );
      },
    },
    {
      id: "customerBank",
      header: t.paymentAccountLedger.transactionColumns.customerBank,
      cell: ({ row }) => {
        const withdrawal = row.original.relatedWithdrawal;
        const deposit = row.original.relatedDeposit;
        // Withdrawal: the customer's own payout account, as submitted with
        // that request. Deposits carry no customer-owned bank fields, so
        // they show OUR receiving account — where the customer's money
        // landed. The logo carries the method (accountType stores the
        // catalog value, same lookup as withdrawals/columns.tsx).
        const bank = withdrawal
          ? { type: withdrawal.accountType, name: withdrawal.accountName, number: withdrawal.accountNumber }
          : deposit &&
              (deposit.receivingAccountName || deposit.receivingAccountType || deposit.receivingAccountNumber)
            ? {
                type: deposit.receivingAccountType,
                name: deposit.receivingAccountName,
                number: deposit.receivingAccountNumber,
              }
            : null;
        if (!bank) return <span className="text-sm">—</span>;
        const logoUrl = bank.type ? typeLogo(bank.type) : null;
        const label = bank.type ? typeLabel(bank.type) : "";
        return (
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary/40"
              title={label || undefined}
            >
              {logoUrl ? (
                <Image src={logoUrl} alt={label} width={32} height={32} className="size-full object-cover" unoptimized />
              ) : (
                <ImageIcon className="size-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex max-w-36 flex-col">
              <span className="truncate text-sm" title={bank.name ?? undefined}>
                {bank.name || "—"}
              </span>
              <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                {bank.number || "—"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "trans6",
      header: t.paymentAccountLedger.transactionColumns.trans6,
      cell: ({ row }) => (
        // The entry's own code (withdrawal transfer code / deposit reference),
        // already stored as its final 6 characters — slice defends against
        // longer free-text codes on manual entries. Null on reversals.
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
          {row.original.referenceCode?.slice(-6) || "—"}
        </span>
      ),
    },
    // Balances and reference code are deliberately not columns — they still
    // show in the details panel, where there's room for them.
    {
      id: "performedBy",
      header: t.paymentAccountLedger.transactionColumns.performedBy,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {userLabelOr(row.original.performedBy, t.paymentAccountLedger.transactionColumns.system)}
        </span>
      ),
    },
    {
      accessorKey: "note",
      header: t.paymentAccountLedger.transactionColumns.note,
      cell: ({ row }) => (
        <span className="max-w-48 truncate text-sm text-muted-foreground" title={row.original.note ?? undefined}>
          {row.original.note ?? "—"}
        </span>
      ),
    },
    {
      // Last data column by request — the Details action stays rightmost.
      accessorKey: "createdAt",
      header: t.paymentAccountLedger.transactionColumns.dateTime,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm:ss")}
        </span>
      ),
    },
    {
      id: "details",
      header: t.paymentAccountLedger.transactionColumns.details,
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1"
          onClick={() => onViewDetails(row.original)}
          title={t.paymentAccountLedger.transactionColumns.viewDetails}
        >
          <Eye className="size-3.5" />
          {t.paymentAccountLedger.transactionColumns.details}
        </Button>
      ),
    },
  );

  return columns;
}
