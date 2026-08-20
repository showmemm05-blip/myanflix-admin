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
import type { TranslationShape } from "@/lib/i18n/translations";
import type { StaffMember, StaffStatus } from "@/types/staff";

const STATUS_TONE: Record<StaffStatus, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
};

interface GetStaffColumnsOptions {
  t: TranslationShape;
  currentUserId: string;
  /** STAFF.EDIT — edit, password reset and activate/deactivate. */
  canEdit: boolean;
  /** STAFF.DELETE. */
  canDelete: boolean;
  onEdit: (staff: StaffMember) => void;
  onResetPassword: (staff: StaffMember) => void;
  onToggleStatus: (staff: StaffMember) => void;
  onDelete: (staff: StaffMember) => void;
}

export function getStaffColumns({
  t,
  currentUserId,
  canEdit,
  canDelete,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
}: GetStaffColumnsOptions): ColumnDef<StaffMember>[] {
  return [
    {
      accessorKey: "username",
      header: t.staff.columns.username,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.username}
          {row.original.id === currentUserId && (
            <span className="ml-2 text-xs text-muted-foreground">{t.staff.columns.you}</span>
          )}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: t.staff.columns.role,
      // The badge colour still comes from the account kind, but the text is
      // the assigned role's own name so a custom role reads correctly.
      cell: ({ row }) => (
        <RoleBadge role={row.original.role} label={row.original.appRoleName ?? undefined} />
      ),
    },
    {
      accessorKey: "status",
      header: t.staff.columns.status,
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.status === "ACTIVE" ? t.common.active : t.common.inactive}
          tone={STATUS_TONE[row.original.status]}
        />
      ),
    },
    {
      accessorKey: "lastLoginAt",
      header: t.staff.columns.lastLogin,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.lastLoginAt
            ? format(new Date(row.original.lastLoginAt), "d MMM yyyy, HH:mm:ss")
            : t.common.never}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t.staff.columns.created,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const staff = row.original;
        const isSelf = staff.id === currentUserId;
        if (!canEdit && !canDelete) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(staff)}>
                    <Pencil className="size-4" />
                    {t.common.edit}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onResetPassword(staff)}>
                    <KeyRound className="size-4" />
                    {t.staff.columns.resetPassword}
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
                    {staff.status === "SUSPENDED" ? t.staff.activate : t.staff.deactivate}
                  </DropdownMenuItem>
                </>
              )}
              {canEdit && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem disabled={isSelf} variant="destructive" onClick={() => onDelete(staff)}>
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
