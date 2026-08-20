"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, MoreHorizontal, ShieldCheck, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import { formatLocalPhone } from "@/lib/phone";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { AppUser, UserStatus } from "@/types/user";

const STATUS_TONE: Record<UserStatus, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BANNED: "danger",
};

interface GetUserColumnsOptions {
  t: TranslationShape;
  /** USERS.EDIT — reassigning an account's role. */
  canEditRole: boolean;
  /** USERS.SUSPEND — suspending or reactivating an account. */
  canSuspend: boolean;
  onEditRole: (user: AppUser) => void;
  onToggleSuspend: (user: AppUser) => void;
}

export function getUserColumns({
  t,
  canEditRole,
  canSuspend,
  onEditRole,
  onToggleSuspend,
}: GetUserColumnsOptions): ColumnDef<AppUser>[] {
  const columns: ColumnDef<AppUser>[] = [
    {
      accessorKey: "name",
      header: t.users.columns.name,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8 border border-border">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
              <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="max-w-36 truncate font-medium">{user.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: t.users.columns.phone,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatLocalPhone(row.original.phone) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: t.users.columns.role,
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: "balance",
      header: t.users.columns.balance,
      cell: ({ row }) => <span className="tabular-nums">{formatKyat(row.original.balance)}</span>,
    },
    {
      accessorKey: "isSubscribed",
      header: t.users.columns.subscription,
      cell: ({ row }) =>
        row.original.isSubscribed ? (
          <StatusBadge label={t.common.active} tone="success" />
        ) : (
          <StatusBadge label={t.dashboard.notSubscribed} tone="neutral" />
        ),
    },
    {
      accessorKey: "totalSpent",
      header: t.users.columns.totalSpending,
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatKyat(row.original.totalSpent)}</span>
      ),
    },
    {
      accessorKey: "joinDate",
      header: t.users.columns.joinDate,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.joinDate), "d MMM yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t.users.columns.status,
      cell: ({ row }) => (
        <StatusBadge label={row.original.status} tone={STATUS_TONE[row.original.status]} />
      ),
    },
  ];

  columns.push({
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/users/${user.id}`} />}>
              <UserRound className="size-4" />
              {t.users.columns.viewProfile}
            </DropdownMenuItem>
            {canEditRole && (
              <DropdownMenuItem onClick={() => onEditRole(user)}>
                <ShieldCheck className="size-4" />
                {t.users.columns.editRole}
              </DropdownMenuItem>
            )}
            {canSuspend && (
              <DropdownMenuItem
                variant={user.status === "SUSPENDED" ? undefined : "destructive"}
                onClick={() => onToggleSuspend(user)}
              >
                {user.status === "SUSPENDED" ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Ban className="size-4" />
                )}
                {user.status === "SUSPENDED" ? t.users.columns.reactivateUser : t.users.columns.suspendUser}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  });

  return columns;
}
