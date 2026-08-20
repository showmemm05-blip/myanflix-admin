"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PlatformChips } from "@/components/tracking/PlatformChip";
import { formatLocalPhone } from "@/lib/phone";
import { userLabel } from "@/lib/user-label";
import { cn } from "@/lib/utils";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { ActiveUser } from "@/types/tracking";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * "Last activity" as an operator reads it — a live list is about how stale a
 * row is, not about what o'clock it happened.
 *
 * Computed at render, which is exactly right here: the page re-renders on
 * every poll, so the ages tick along with the data instead of freezing at
 * whatever they were when the row first arrived. A future timestamp (clock
 * skew between server and browser) falls into the "just now" branch rather
 * than rendering a negative age.
 */
export function relativeActivity(iso: string, t: TranslationShape): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  if (elapsed < MINUTE_MS) return t.tracking.common.justNow;
  if (elapsed < HOUR_MS) return t.tracking.common.minutesAgo(Math.floor(elapsed / MINUTE_MS));
  if (elapsed < DAY_MS) return t.tracking.common.hoursAgo(Math.floor(elapsed / HOUR_MS));
  return t.tracking.common.daysAgo(Math.floor(elapsed / DAY_MS));
}

export function getActiveUserColumns({ t }: { t: TranslationShape }): ColumnDef<ActiveUser>[] {
  const a = t.tracking.activeUsers;

  return [
    {
      accessorKey: "online",
      header: a.columns.status,
      cell: ({ row }) => {
        const online = row.original.online;
        return (
          <span
            className="flex items-center gap-2 whitespace-nowrap"
            title={online ? a.onlineHint : a.recentHint}
          >
            {/* The pulse is reserved for a socket that is open this instant;
                a merely-recent row gets the same dot, still. */}
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                online ? "animate-pulse bg-success" : "bg-muted-foreground",
              )}
            />
            <span className={cn("text-sm", online ? "font-medium" : "text-muted-foreground")}>
              {online ? a.status.online : a.status.recent}
            </span>
          </span>
        );
      },
    },
    {
      id: "user",
      header: a.columns.user,
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
      header: a.columns.phone,
      cell: ({ row }) => {
        const phone = formatLocalPhone(row.original.user.phone);
        // A masked number (`09*****369`) is shown as-is — it is what this
        // caller is allowed to see, not a missing value. Only `null` means
        // the account genuinely has no number on it.
        return phone ? (
          <span className="font-mono text-xs">{phone}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t.tracking.common.noPhone}</span>
        );
      },
    },
    {
      id: "platform",
      header: a.columns.platform,
      // Every platform they are present on, not just the newest signal — one
      // person on web AND mobile is this one row with two chips.
      cell: ({ row }) => <PlatformChips platforms={row.original.platforms} />,
    },
    {
      accessorKey: "lastActivity",
      header: a.columns.lastActivity,
      cell: ({ row }) => (
        <span
          className="whitespace-nowrap text-sm text-muted-foreground"
          title={new Date(row.original.lastActivity).toLocaleString()}
        >
          {relativeActivity(row.original.lastActivity, t)}
        </span>
      ),
    },
    {
      id: "ipAddress",
      header: a.columns.ipAddress,
      cell: ({ row }) =>
        row.original.ipAddress ? (
          <span className="break-all font-mono text-xs">{row.original.ipAddress}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t.tracking.common.noIp}</span>
        ),
    },
  ];
}
