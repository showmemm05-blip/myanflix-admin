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
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

interface GetPaymentAccountColumnsOptions {
  types: PaymentAccountType[];
  onEdit: (account: PaymentAccount) => void;
  onToggleStatus: (account: PaymentAccount) => void;
  onDelete: (account: PaymentAccount) => void;
}

export function getPaymentAccountColumns({
  types,
  onEdit,
  onToggleStatus,
  onDelete,
}: GetPaymentAccountColumnsOptions): ColumnDef<PaymentAccount>[] {
  const typeLabel = (value: string) => types.find((t) => t.value === value)?.label ?? value;
  const typeLogo = (value: string) => types.find((t) => t.value === value)?.logoUrl ?? null;

  return [
    {
      accessorKey: "type",
      header: "Payment method",
      cell: ({ row }) => {
        const logoUrl = typeLogo(row.original.type);
        return (
          <div className="flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border border-white/[0.08] bg-secondary/20">
              {logoUrl ? (
                <Image src={logoUrl} alt="" width={24} height={24} className="size-full object-cover" unoptimized />
              ) : (
                <ImageIcon className="size-3 text-muted-foreground" />
              )}
            </div>
            <span className="font-medium">{typeLabel(row.original.type)}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "accountName",
      header: "Account name",
    },
    {
      accessorKey: "accountNumber",
      header: "Account number",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.accountNumber}</span>,
    },
    {
      accessorKey: "bankName",
      header: "Bank",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.bankName ?? "—"}</span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.isActive ? "Active" : "Inactive"}
          tone={row.original.isActive ? "success" : "neutral"}
        />
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Last Updated",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.updatedAt), "MMM d, yyyy")}
          {row.original.updatedBy && ` by ${row.original.updatedBy.username}`}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const account = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(account)}>
                <Pencil className="size-4" />
                Edit
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
                {account.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(account)}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
