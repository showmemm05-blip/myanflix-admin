"use client";

/**
 * The five-up summary above the canvas: how wide the network turned out to be
 * and how much money moved through it.
 *
 * Every figure comes from the backend's `stats` block rather than being
 * re-derived from the node lists — a truncated response would otherwise report
 * counts that quietly disagree with what the graph drew.
 */

import type { LucideIcon } from "lucide-react";
import { ArrowDownToLine, ArrowUpFromLine, Layers, Phone, TriangleAlert, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { RelationshipNetworkStats } from "@/types/user-relationship";

interface StatTileProps {
  title: string;
  value: string;
  /** Screen-reader-only description; see the note at its render site. */
  hint: string;
  icon: LucideIcon;
  /** Accent for the icon chip — keeps phone/finance tiles legible apart from the user tile. */
  accentClassName?: string;
}

function StatTile({ title, value, hint, icon: Icon, accentClassName }: StatTileProps) {
  return (
    <Card className="glass-card py-0">
      <CardContent className="flex items-start justify-between gap-2.5 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</p>
          <p className="mt-1 truncate font-heading text-xl font-bold tracking-tight tabular-nums">{value}</p>
          {/* Not drawn: at five tiles across it truncated to "Con…" / "Acro…",
              and the label above already says what the number counts. Kept for
              screen readers, where there is no width to run out of. */}
          <span className="sr-only">{hint}</span>
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary",
            accentClassName,
          )}
        >
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatTileSkeleton() {
  return (
    <Card className="glass-card py-0">
      <CardContent className="flex items-start justify-between gap-2.5 p-3">
        <div className="w-full space-y-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        <Skeleton className="size-9 rounded-lg" />
      </CardContent>
    </Card>
  );
}

export interface StatsBarProps {
  /** Null while the first search is still running — renders skeleton tiles. */
  stats: RelationshipNetworkStats | null;
  className?: string;
}

export function StatsBar({ stats, className }: StatsBarProps) {
  const { t } = useLanguage();
  const s = t.userRelationships.stats;

  const format = (value: number) => value.toLocaleString("en-US");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        {stats === null ? (
          <>
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </>
        ) : (
          <>
            <StatTile
              title={s.totalUsers}
              value={format(stats.totalUsers)}
              hint={s.totalUsersHint}
              icon={Users}
              accentClassName="bg-[var(--chart-5)]/15 text-[var(--chart-5)]"
            />
            <StatTile
              title={s.totalPhones}
              value={format(stats.totalPhones)}
              hint={s.totalPhonesHint}
              icon={Phone}
              accentClassName="bg-[var(--chart-3)]/15 text-[var(--chart-3)]"
            />
            <StatTile
              title={s.totalDeposits}
              value={format(stats.totalDeposits)}
              hint={s.totalDepositsHint}
              icon={ArrowDownToLine}
              accentClassName="bg-success/15 text-success"
            />
            <StatTile
              title={s.totalWithdrawals}
              value={format(stats.totalWithdrawals)}
              hint={s.totalWithdrawalsHint}
              icon={ArrowUpFromLine}
              accentClassName="bg-warning/15 text-warning"
            />
            <StatTile
              title={s.maxDepth}
              value={format(stats.maxDepth)}
              hint={s.maxDepthHint}
              icon={Layers}
            />
          </>
        )}
      </div>

      {stats?.truncated && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/10 px-3.5 py-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-warning">{s.truncatedTitle}</p>
            <p className="text-muted-foreground">{s.truncatedDescription}</p>
          </div>
        </div>
      )}
    </div>
  );
}
