"use client";

import { format } from "date-fns";
import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, ImageIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { userLabel } from "@/lib/user-label";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";
import type { TranslationShape } from "@/lib/i18n/translations";

interface GetPaymentAccountColumnsOptions {
  types: PaymentAccountType[];
  /** PAYMENT_ACCOUNTS.EDIT — rename and the active/inactive toggle. */
  canEdit: boolean;
  /** PAYMENT_ACCOUNTS.DELETE. */
  canDelete: boolean;
  onEdit: (account: PaymentAccount) => void;
  onToggleStatus: (account: PaymentAccount) => void;
  onDelete: (account: PaymentAccount) => void;
  t: TranslationShape;
}

export function getPaymentAccountColumns({
  types,
  canEdit,
  canDelete,
  onEdit,
  onToggleStatus,
  onDelete,
  t,
}: GetPaymentAccountColumnsOptions): ColumnDef<PaymentAccount>[] {
  const typeLabel = (value: string) => types.find((type) => type.value === value)?.label ?? value;
  const typeLogo = (value: string) => types.find((type) => type.value === value)?.logoUrl ?? null;

  return [
    {
      accessorKey: "accountName",
      header: t.paymentAccounts.columns.accountName,
      // Account and payment method share one cell: the logo alone identifies
      // the method (its name stays as the tooltip and the image's alt text).
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
            <span className="font-medium">{row.original.accountName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "subname",
      header: t.paymentAccounts.columns.subname,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.subname ?? "—"}</span>
      ),
    },
    {
      accessorKey: "accountNumber",
      header: t.paymentAccounts.columns.accountNumber,
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.accountNumber}</span>,
    },
    {
      accessorKey: "bankName",
      header: t.paymentAccounts.columns.bank,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.bankName ?? "—"}</span>
      ),
    },
    {
      accessorKey: "isActive",
      header: t.paymentAccounts.columns.status,
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.isActive ? t.common.active : t.common.inactive}
          tone={row.original.isActive ? "success" : "neutral"}
        />
      ),
    },
    {
      accessorKey: "updatedAt",
      header: t.paymentAccounts.columns.lastUpdated,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.updatedAt), "d MMM yyyy")}
          {row.original.updatedBy && t.paymentAccounts.columns.updatedBySuffix(userLabel(row.original.updatedBy))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const account = row.original;
        if (!canEdit && !canDelete) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(account)}>
                    <Pencil className="size-4" />
                    {t.common.edit}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant={account.isActive ? "destructive" : undefined}
                    onClick={() => onToggleStatus(account)}
                  >
                    {account.isActive ? (
                      <Ban className="size-4" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    {account.isActive ? t.paymentAccounts.toggleStatus.deactivate : t.paymentAccounts.toggleStatus.activate}
                  </DropdownMenuItem>
                </>
              )}
              {canEdit && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(account)}>
                  <Trash2 className="size-4" />
                  {t.common.delete}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
