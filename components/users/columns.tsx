"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Power, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { LevelBadge } from "@/components/levels/LevelBadge";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import { USER_STATUS_TONE as STATUS_TONE } from "@/lib/status-tones";
import { formatLocalPhone } from "@/lib/phone";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { AppUser } from "@/types/user";

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
            {/* The rank rides with the identity, not in a column of its own —
                a full column was a lot of width for what one glyph says. It
                sits AFTER the name (the verified-checkmark idiom) and is
                shrink-0, so a long truncated name can never push it out of
                the cell. The badge SVG is aria-hidden, so the wrapper carries
                the accessible name and the hover title — without them the
                rank would be invisible to a screen reader and unreadable to
                anyone who doesn't know the six glyphs by heart. Unranked
                users get nothing: a placeholder dash inside an identity cell
                would read as part of the name. */}
            {user.level && (
              <span
                role="img"
                aria-label={user.level.name}
                title={user.level.name}
                className="flex shrink-0 items-center"
              >
                <LevelBadge icon={user.level.icon} color={user.level.color} size={18} />
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: t.users.columns.phone,
      // Masking is render-only shoulder-surfing cover — the accessor still
      // holds the raw phone (client search matches it), and the full local
      // number stays one hover away in the title.
      cell: ({ row }) => (
        <span
          className="text-sm tabular-nums text-muted-foreground"
        >
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
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatKyat(row.original.balance)}</span>
      ),
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
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">{formatKyat(row.original.totalSpent)}</span>
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
      const suspended = user.status === "SUSPENDED";
      return (
        <RowActions>
          <RowActionButton icon={Eye} label={t.users.columns.viewProfile} href={`/users/${user.id}`} />
          {canEditRole && (
            <RowActionButton
              icon={ShieldCheck}
              label={t.users.columns.editRole}
              onClick={() => onEditRole(user)}
            />
          )}
          {canSuspend && (
            <RowActionButton
              icon={Power}
              label={suspended ? t.users.columns.reactivateUser : t.users.columns.suspendUser}
              destructive={!suspended}
              onClick={() => onToggleSuspend(user)}
            />
          )}
        </RowActions>
      );
    },
  });

  return columns;
}
