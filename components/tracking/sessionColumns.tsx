"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PlatformChip } from "@/components/tracking/PlatformChip";
import { relativeActivity } from "@/components/tracking/activeUserColumns";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import { cn } from "@/lib/utils";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { UserSessionSummary } from "@/types/tracking";

/**
 * One row per account: who they are, the number and address on record, and
 * whether either of those is shared with somebody else.
 *
 * The IP cell is the point of the screen. When an address belongs to more
 * than one account it becomes a button that filters the table down to that
 * address — one click turns "this row looks suspicious" into "here is
 * everyone behind it", which is the question a shared-IP flag always
 * provokes and which no amount of badge colour can answer.
 */
export function getSessionColumns({
  t,
  canViewPii,
  onViewSessions,
  onFilterByIp,
}: {
  t: TranslationShape;
  /**
   * `TRACKING.PII_VIEW`. Not used to hide anything — every column renders
   * for everyone — only to decide whether the shared-IP shortcut is
   * OFFERED. A masked address (`203.0.113.***`) is not the value stored
   * against the session, so filtering by it would match nothing and the
   * click would silently empty the table. The permission is asked; the
   * value is never sniffed for asterisks.
   */
  canViewPii: boolean;
  onViewSessions: (row: UserSessionSummary) => void;
  /** Narrows the table to one address — the follow-up to a Shared IP flag. */
  onFilterByIp: (ip: string) => void;
}): ColumnDef<UserSessionSummary>[] {
  const p = t.tracking.phoneIp;

  return [
    {
      id: "user",
      header: p.columns.user,
      cell: ({ row }) => (
        <div className="flex max-w-44 flex-col">
          <span className="truncate text-sm font-medium">{userLabel(row.original.user)}</span>
          <span className="truncate text-xs text-muted-foreground">
            @{row.original.user.username}
          </span>
        </div>
      ),
    },
    {
      id: "phone",
      header: p.columns.phone,
      cell: ({ row }) => {
        // Masked (`09*****369`) is a value the caller is allowed to see and
        // renders as one; only `null` means no number on the account.
        const phone = formatLocalPhone(row.original.user.phone);
        return phone ? (
          <span className="font-mono text-xs">{phone}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t.tracking.common.noPhone}</span>
        );
      },
    },
    {
      id: "ipAddress",
      header: p.columns.ipAddress,
      cell: ({ row }) => {
        const { ipAddress, sharedIp } = row.original;
        if (!ipAddress) {
          return <span className="text-xs text-muted-foreground">{t.tracking.common.noIp}</span>;
        }
        if (!sharedIp || !canViewPii) {
          return (
            <span
              className={cn(
                "break-all font-mono text-xs",
                // Still marked when it is shared — only the shortcut goes,
                // never the fact.
                sharedIp && "font-medium text-warning",
              )}
              title={sharedIp ? p.flags.sharedIpHint : undefined}
            >
              {ipAddress}
            </span>
          );
        }
        return (
          <button
            type="button"
            onClick={() => onFilterByIp(ipAddress)}
            title={p.flags.sharedIpHint}
            className="break-all font-mono text-xs font-medium text-warning underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {ipAddress}
          </button>
        );
      },
    },
    {
      id: "platform",
      header: p.columns.platform,
      cell: ({ row }) => <PlatformChip platform={row.original.platform} />,
    },
    {
      accessorKey: "lastActive",
      header: p.columns.lastActive,
      cell: ({ row }) => {
        const lastActive = row.original.lastActive;
        if (!lastActive) {
          return <span className="text-sm text-muted-foreground">{t.tracking.common.none}</span>;
        }
        return (
          // Relative for scanning, exact on hover for the moment somebody
          // needs to line this up against another record.
          <span
            className="whitespace-nowrap text-sm text-muted-foreground"
            title={format(new Date(lastActive), "d MMM yyyy, HH:mm:ss")}
          >
            {relativeActivity(lastActive, t)}
          </span>
        );
      },
    },
    {
      accessorKey: "sessionCount",
      header: p.columns.sessions,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onViewSessions(row.original)}
          title={t.tracking.common.viewDetails}
          className="whitespace-nowrap text-sm text-primary underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {p.sessionCount(row.original.sessionCount)}
        </button>
      ),
    },
    {
      id: "flags",
      header: p.columns.flags,
      cell: ({ row }) => {
        const { sharedIp, sharedPhone } = row.original;
        if (!sharedIp && !sharedPhone) {
          return <span className="text-xs text-muted-foreground">{p.flags.none}</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1">
            {sharedIp && (
              <span title={p.flags.sharedIpHint}>
                <StatusBadge label={p.flags.sharedIp} tone="warning" />
              </span>
            )}
            {/* `User.phone` is unique, so this should never appear. It is
                rendered in the loudest tone precisely because if it ever
                does, something is wrong at the database level. */}
            {sharedPhone && (
              <span title={p.flags.sharedPhoneHint}>
                <StatusBadge label={p.flags.sharedPhone} tone="danger" />
              </span>
            )}
          </div>
        );
      },
    },
  ];
}
