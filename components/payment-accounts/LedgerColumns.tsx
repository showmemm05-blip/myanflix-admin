"use client";

import Image from "next/image";
import Link from "next/link";
import { History, ImageIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import type { TranslationShape } from "@/lib/i18n/translations";

interface GetPaymentAccountLedgerColumnsOptions {
  t: TranslationShape;
  /** Supplies each method's logo; an empty list just falls back to the placeholder icon. */
  types: PaymentAccountType[];
}

export function getPaymentAccountLedgerColumns({
  t,
  types,
}: GetPaymentAccountLedgerColumnsOptions): ColumnDef<PaymentAccount>[] {
  const typeLabel = (value: string) => types.find((type) => type.value === value)?.label ?? value;
  const typeLogo = (value: string) => types.find((type) => type.value === value)?.logoUrl ?? null;

  return [
    {
      accessorKey: "accountName",
      header: t.paymentAccountLedger.columns.account,
      // Account and payment method share one cell: the logo carries the method,
      // so its name only appears as the subtitle alongside the subname.
      cell: ({ row }) => {
        const logoUrl = typeLogo(row.original.type);
        const label = typeLabel(row.original.type);
        return (
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary/40"
              title={label}
            >
              {logoUrl ? (
                <Image src={logoUrl} alt={label} width={32} height={32} className="size-full object-cover" unoptimized />
              ) : (
                <ImageIcon className="size-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{row.original.accountName}</span>
              {row.original.subname && (
                <span className="text-xs text-muted-foreground">{row.original.subname}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "accountNumber",
      header: t.paymentAccountLedger.columns.accountNumber,
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.accountNumber}</span>,
    },
    {
      accessorKey: "balance",
      header: t.paymentAccountLedger.columns.balance,
      cell: ({ row }) => (
        <span className={row.original.balance < 0 ? "font-semibold text-destructive tabular-nums" : "font-semibold tabular-nums"}>
          {formatKyat(row.original.balance)}
        </span>
      ),
    },
    {
      accessorKey: "totalIn",
      header: t.paymentAccountLedger.columns.totalIn,
      cell: ({ row }) => <span className="text-success tabular-nums">{formatKyat(row.original.totalIn)}</span>,
    },
    {
      accessorKey: "totalOut",
      header: t.paymentAccountLedger.columns.totalOut,
      cell: ({ row }) => <span className="text-destructive tabular-nums">{formatKyat(row.original.totalOut)}</span>,
    },
    {
      accessorKey: "isActive",
      header: t.paymentAccountLedger.columns.status,
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.isActive ? t.common.active : t.common.inactive}
          tone={row.original.isActive ? "success" : "neutral"}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/finance/payment-accounts/${row.original.id}`} />}
          nativeButton={false}
        >
          <History className="size-4" />
          {t.paymentAccountLedger.list.viewHistory}
        </Button>
      ),
    },
  ];
}
