"use client";

import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { PlatformChip, PlatformChips } from "@/components/tracking/PlatformChip";
import { userLabel } from "@/lib/user-label";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { RecentSearch, TopSearchTerm } from "@/types/tracking";

/**
 * A search that returned nothing is the single most actionable row on this
 * screen — somebody wanted something the catalogue does not have — so it is
 * flagged rather than printed as a quiet "0".
 */
function ZeroResults({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="bg-warning/15 font-medium text-warning border-warning/25"
    >
      {label}
    </Badge>
  );
}

/**
 * The grouped view: one row per normalised term, ordered by how often it was
 * typed. The rank column is `row.index + 1` — TanStack's `index` is the
 * position in the ORIGINAL data array, so a rank survives client-side
 * pagination and any column re-sort instead of renumbering per page.
 */
export function getTopSearchColumns({ t }: { t: TranslationShape }): ColumnDef<TopSearchTerm>[] {
  const s = t.tracking.searches;

  return [
    {
      id: "rank",
      header: s.columns.rank,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">{row.index + 1}</span>
      ),
    },
    {
      accessorKey: "term",
      header: s.columns.term,
      cell: ({ row }) => {
        const { term, normalizedTerm } = row.original;
        return (
          // The spelling people actually typed, not a lowercased
          // reconstruction of it. The grouping key rides along as a tooltip:
          // it explains why "Avengers" and "AVENGERS " are one row, without
          // putting a near-duplicate of every term on screen twice.
          <span className="block max-w-xs truncate text-sm font-medium" title={normalizedTerm}>
            {term}
          </span>
        );
      },
    },
    {
      accessorKey: "count",
      header: s.columns.count,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium">
          {row.original.count.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "avgResults",
      header: s.columns.avgResults,
      cell: ({ row }) => {
        const average = row.original.avgResults;
        if (average <= 0) return <ZeroResults label={s.zeroResults} />;
        return (
          <span className="tabular-nums text-sm">
            {average.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      id: "platforms",
      header: s.columns.platforms,
      cell: ({ row }) => <PlatformChips platforms={row.original.platforms} />,
    },
    {
      accessorKey: "lastSearchedAt",
      header: s.columns.lastSearched,
      cell: ({ row }) => {
        const last = row.original.lastSearchedAt;
        return last ? (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {format(new Date(last), "d MMM yyyy, HH:mm")}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{t.tracking.common.none}</span>
        );
      },
    },
  ];
}

/** The raw log, newest first — every individual search as it was made. */
export function getRecentSearchColumns({
  t,
}: {
  t: TranslationShape;
}): ColumnDef<RecentSearch>[] {
  const s = t.tracking.searches;

  return [
    {
      accessorKey: "term",
      header: s.columns.term,
      cell: ({ row }) => (
        <span className="block max-w-xs truncate text-sm font-medium">{row.original.term}</span>
      ),
    },
    {
      id: "user",
      header: s.columns.user,
      cell: ({ row }) => {
        const user = row.original.user;
        // Search is open to signed-out visitors, so a null user is a normal
        // row and not a missing relation.
        if (!user) {
          return <span className="text-sm text-muted-foreground">{s.signedOut}</span>;
        }
        return (
          <div className="flex max-w-40 flex-col">
            <span className="truncate text-sm font-medium">{userLabel(user)}</span>
            <span className="truncate text-xs text-muted-foreground">@{user.username}</span>
          </div>
        );
      },
    },
    {
      id: "platform",
      header: s.columns.platform,
      cell: ({ row }) => <PlatformChip platform={row.original.platform} />,
    },
    {
      accessorKey: "resultCount",
      header: s.columns.results,
      cell: ({ row }) => {
        const count = row.original.resultCount;
        if (count <= 0) return <ZeroResults label={s.zeroResults} />;
        return <span className="tabular-nums text-sm">{count.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "createdAt",
      header: s.columns.date,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "d MMM yyyy, HH:mm")}
        </span>
      ),
    },
  ];
}
