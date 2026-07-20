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
import type { AppUser, UserStatus } from "@/types/user";

const STATUS_TONE: Record<UserStatus, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BANNED: "danger",
};

interface GetUserColumnsOptions {
  canManage: boolean;
  onEditRole: (user: AppUser) => void;
  onToggleSuspend: (user: AppUser) => void;
}

export function getUserColumns({
  canManage,
  onEditRole,
  onToggleSuspend,
}: GetUserColumnsOptions): ColumnDef<AppUser>[] {
  const columns: ColumnDef<AppUser>[] = [
    {
      accessorKey: "name",
      header: "Username",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8 border border-border">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="max-w-36 truncate font-medium">{user.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="max-w-48 truncate text-sm text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: "balance",
      header: "Balance",
      cell: ({ row }) => <span className="tabular-nums">{formatKyat(row.original.balance)}</span>,
    },
    {
      accessorKey: "moviesPurchased",
      header: "Purchased",
      cell: ({ row }) => <span className="tabular-nums">{row.original.moviesPurchased}</span>,
    },
    {
      accessorKey: "totalSpent",
      header: "Total Spending",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatKyat(row.original.totalSpent)}</span>
      ),
    },
    {
      accessorKey: "joinDate",
      header: "Join Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.joinDate), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
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
              View Profile
            </DropdownMenuItem>
            {canManage && (
              <>
                <DropdownMenuItem onClick={() => onEditRole(user)}>
                  <ShieldCheck className="size-4" />
                  Edit Role
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant={user.status === "SUSPENDED" ? undefined : "destructive"}
                  onClick={() => onToggleSuspend(user)}
                >
                  {user.status === "SUSPENDED" ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                  {user.status === "SUSPENDED" ? "Reactivate User" : "Suspend User"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  });

  return columns;
}
