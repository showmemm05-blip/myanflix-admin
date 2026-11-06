"use client";

import { ArrowDownRight, ArrowUpRight, Clock, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { OverviewCardModel } from "@/components/lottery/analytics/overviewModel";

const CARD_COUNT = 6;

/** The six-up grid: two columns on a phone, three on a tablet, six on a wide screen. */
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6";

/** Six card-shaped blanks while the overview loads. */
export function OverviewCardsSkeleton() {
  return (
    <div className={GRID}>
      {Array.from({ length: CARD_COUNT }).map((_, i) => (
        <Skeleton key={i} className="h-[112px] rounded-xl bg-secondary/60" />
      ))}
    </div>
  );
}

/**
 * Total tickets sold · Purchase transactions · Unique purchasing users ·
 * Most popular number · Peak activity hour · Average tickets per
 * transaction, each with its delta line. The delta direction is said by an
 * icon and the signed text; the colour only underlines it.
 */
export function OverviewCards({ cards }: { cards: OverviewCardModel[] }) {
  const { t } = useLanguage();
  const o = t.lottery.analytics.overview;
  return (
    <div className={GRID}>
      {cards.map((card) => {
        const d = card.delta.direction;
        return (
          <Card key={card.key} className="glass-card py-0">
            <CardContent className="flex h-full flex-col gap-2 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
              <p
                className={cn(
                  "truncate font-heading font-bold tracking-tight tabular-nums",
                  card.mono ? "font-mono text-2xl tracking-[0.12em]" : card.small ? "text-base" : "text-2xl",
                )}
              >
                {card.value}
              </p>
              <p
                className={cn(
                  "mt-auto flex items-center gap-1 text-xs",
                  d === "up" && "text-success",
                  d === "down" && "text-destructive",
                  (d === "flat" || d === "none" || d === "clock") && "text-muted-foreground",
                )}
              >
                {d === "up" && <ArrowUpRight className="size-3.5 shrink-0" aria-label={o.up} />}
                {d === "down" && <ArrowDownRight className="size-3.5 shrink-0" aria-label={o.down} />}
                {d === "flat" && <Minus className="size-3.5 shrink-0" aria-label={o.flat} />}
                {d === "clock" && <Clock className="size-3.5 shrink-0" aria-hidden="true" />}
                <span className="min-w-0 truncate" title={card.delta.text}>
                  {card.delta.text}
                </span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
