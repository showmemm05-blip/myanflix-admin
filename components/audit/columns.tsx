"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PlatformChip } from "@/components/tracking/PlatformChip";
import { relativeActivity } from "@/components/tracking/activeUserColumns";
import { ChangesSummary } from "@/components/audit/ChangesSummary";
import {
  AUDIT_CATEGORY_TONE,
  actionLabel,
  categoryLabel,
  isSystemEntry,
  targetHref,
  targetTypeLabel,
} from "@/components/audit/auditFormat";
import { userLabel } from "@/lib/user-label";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { AuditLogEntry } from "@/types/audit";

export function getAuditColumns({
  t,
  onViewDetails,
}: {
  t: TranslationShape;
  onViewDetails: (entry: AuditLogEntry) => void;
}): ColumnDef<AuditLogEntry>[] {
  const a = t.audit;

  return [
    {
      accessorKey: "createdAt",
      header: a.columns.when,
      cell: ({ row }) => (
        <span
          className="whitespace-nowrap text-sm text-muted-foreground"
          title={relativeActivity(row.original.createdAt, t)}
        >
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm:ss")}
        </span>
      ),
    },
    {
      id: "staff",
      header: a.columns.staff,
      cell: ({ row }) => {
        const entry = row.original;
        if (isSystemEntry(entry)) {
          return (
            <Badge
              variant="outline"
              className="bg-muted-foreground/15 font-medium text-muted-foreground border-muted-foreground/25"
            >
              {a.system}
            </Badge>
          );
        }
        // The snapshot columns, not the joined `actor`: the row must still
        // name who did it after the account is renamed or deleted.
        const name = userLabel({
          displayName: entry.actorDisplayName,
          username: entry.actorUsername,
        });
        return (
          <div className="flex max-w-44 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">@{entry.actorUsername}</span>
            {entry.actorRole && (
              <RoleBadge
                role={entry.actorRole}
                label={entry.actorAppRoleName ?? undefined}
                className="w-fit"
              />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "action",
      header: a.columns.action,
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <div className="flex max-w-52 flex-col items-start gap-1">
            <span className="text-sm font-medium" title={entry.action}>
              {actionLabel(t, entry.action)}
            </span>
            <StatusBadge
              label={categoryLabel(t, entry.category)}
              tone={AUDIT_CATEGORY_TONE[entry.category] ?? "neutral"}
            />
          </div>
        );
      },
    },
    {
      id: "target",
      header: a.columns.target,
      cell: ({ row }) => {
        const entry = row.original;
        const href = targetHref(entry);
        const label = entry.targetLabel ?? entry.targetId ?? a.details.none;
        return (
          <div className="flex max-w-56 flex-col" title={entry.targetId ?? undefined}>
            <span className="text-xs text-muted-foreground">
              {targetTypeLabel(t, entry.targetType)}
            </span>
            {href ? (
              <Link
                href={href}
                className="truncate text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                {label}
              </Link>
            ) : (
              <span className="truncate text-sm font-medium">{label}</span>
            )}
            {!entry.targetLabel && entry.targetId && (
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {entry.targetId}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "changes",
      header: a.columns.changes,
      cell: ({ row }) => <ChangesSummary entry={row.original} t={t} />,
    },
    {
      id: "device",
      header: a.columns.device,
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <div className="flex flex-col items-start gap-1">
            <PlatformChip platform={entry.platform} />
            {entry.ip && (
              <span className="font-mono text-xs text-muted-foreground">{entry.ip}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: a.columns.actions,
      cell: ({ row }) => (
        <RowActions>
          <RowActionButton
            icon={Eye}
            label={a.viewDetails}
            onClick={() => onViewDetails(row.original)}
          />
        </RowActions>
      ),
    },
  ];
}
