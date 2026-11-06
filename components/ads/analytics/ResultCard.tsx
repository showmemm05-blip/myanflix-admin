"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HelpTip } from "@/components/ads/HelpTip";
import { cn } from "@/lib/utils";

/** The foot line of a card: the change against the period before, or "Nothing to compare with yet". */
export interface ResultTrend {
  /** The change as a ratio (0.12 = +12%); null when the period before had nothing to compare with. */
  change: number | null;
  /** The whole line, already worded: "+12% compared with the 7 days before". */
  text: string;
}

export interface ResultFigure {
  key: string;
  /** "Times played" — also the (?)'s heading. */
  label: string;
  /** The (?)'s explanation: what the number counts and what its percentage is out of. */
  help: ReactNode;
  /** "4,120", "8.6%". */
  value: string;
  /** "Website 1,610 · Phone app 2,510"; empty for none. */
  note: string;
  trend: ResultTrend;
}

interface ResultCardProps {
  figure: ResultFigure;
  /**
   * "card" stands on its own in the row of four; "plain" sits inside a
   * group's panel (the corner pictures next to the video cards) with no
   * border of its own.
   */
  variant?: "card" | "plain";
}

/**
 * One number on the Ad results page (2026-11-04, the `Results` board): its
 * name with a (?) that says what it counts, the number, its note and the
 * change against the period before. The change is never coloured good or
 * bad — more skips is worse, more plays is better — so its sign is text and
 * an arrow, and the reader judges.
 */
export function ResultCard({ figure, variant = "card" }: ResultCardProps) {
  const { label, help, value, note, trend } = figure;
  // The arrow follows the whole percent the text shows, so "0%" never carries an up or down arrow.
  const percent = trend.change === null ? null : Math.round(trend.change * 100);
  const direction = percent === null ? null : percent > 0 ? "up" : percent < 0 ? "down" : "flat";

  const body = (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-start justify-between gap-1">
        <span className="pt-0.5 text-sm text-muted-foreground">{label}</span>
        {/* The button sits on the card's right edge: the popover opens leftwards so it stays on screen. */}
        <HelpTip title={label} align="end" className="-mr-1 -mt-0.5">
          {help}
        </HelpTip>
      </div>
      <p className={cn("truncate font-heading font-bold tracking-tight tabular-nums", variant === "card" ? "text-2xl" : "text-xl")}>
        {value}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <p className="mt-auto flex items-start gap-1 pt-1 text-xs text-muted-foreground">
        {direction === "up" && <ArrowUpRight className="mt-px size-3.5 shrink-0" aria-hidden />}
        {direction === "down" && <ArrowDownRight className="mt-px size-3.5 shrink-0" aria-hidden />}
        {direction === "flat" && <Minus className="mt-px size-3.5 shrink-0" aria-hidden />}
        <span>{trend.text}</span>
      </p>
    </div>
  );

  if (variant === "plain") return body;
  return (
    <Card className="glass-card py-0">
      <CardContent className="flex h-full flex-col p-4">{body}</CardContent>
    </Card>
  );
}
