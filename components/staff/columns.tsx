"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, KeyRound, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import type { StaffMember, StaffStatus } from "@/types/staff";

const STATUS_TONE: Record<StaffStatus, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
};

interface GetStaffColumnsOptions {
  currentUserId: string;
  onEdit: (staff: StaffMember) => void;
  onResetPassword: (staff: StaffMember) => void;
  onToggleStatus: (staff: StaffMember) => void;
  onDelete: (staff: StaffMember) => void;
}

export function getStaffColumns({
  currentUserId,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
}: GetStaffColumnsOptions): ColumnDef<StaffMember>[] {
  return [
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.username}
          {row.original.id === currentUserId && (
            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
          )}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.status === "ACTIVE" ? "Active" : "Inactive"}
          tone={STATUS_TONE[row.original.status]}
        />
      ),
    },
    {
      accessorKey: "lastLoginAt",
      header: "Last Login",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.lastLoginAt
            ? format(new Date(row.original.lastLoginAt), "MMM d, yyyy HH:mm")
            : "Never"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const staff = row.original;
        const isSelf = staff.id === currentUserId;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(staff)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResetPassword(staff)}>
                <KeyRound className="size-4" />
                Reset Password
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isSelf}
                variant={staff.status === "SUSPENDED" ? undefined : "destructive"}
                onClick={() => onToggleStatus(staff)}
              >
                {staff.status === "SUSPENDED" ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Ban className="size-4" />
                )}
                {staff.status === "SUSPENDED" ? "Activate" : "Deactivate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={isSelf} variant="destructive" onClick={() => onDelete(staff)}>
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
