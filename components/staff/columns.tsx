"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, Pencil, Power, Trash2 } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
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
        const suspended = staff.status === "SUSPENDED";
        if (!canEdit && !canDelete) return null;
        return (
          <RowActions>
            {canEdit && (
              <>
                <RowActionButton icon={Pencil} label={t.common.edit} onClick={() => onEdit(staff)} />
                <RowActionButton
                  icon={KeyRound}
                  label={t.staff.columns.resetPassword}
                  onClick={() => onResetPassword(staff)}
                />
                <RowActionButton
                  icon={Power}
                  label={suspended ? t.staff.activate : t.staff.deactivate}
                  destructive={!suspended}
                  disabled={isSelf}
                  onClick={() => onToggleStatus(staff)}
                />
              </>
            )}
            {canDelete && (
              <RowActionButton
                icon={Trash2}
                label={t.common.delete}
                destructive
                disabled={isSelf}
                onClick={() => onDelete(staff)}
              />
            )}
          </RowActions>
        );
      },
    },
  ];
}
