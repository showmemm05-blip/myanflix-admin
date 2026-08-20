"use client";

import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/context/language-context";
import { formatWatchDuration, hourRangeLabel } from "@/components/tracking/trackingFormat";
import { cn } from "@/lib/utils";
import type { WatchTimeHeatmapCell } from "@/types/tracking";

const HOUR_COUNT = 24;
const WEEKDAY_COUNT = 7;

/**
 * Tint floor and ceiling, in `color-mix` percent.
 *
 * The floor is not zero on purpose: a cell with one minute in it and a cell
 * with none are different facts, and at 2% tint they would look identical.
 * Anything non-zero starts visibly above the empty ground.
 */
const MIN_TINT = 16;
const MAX_TINT = 92;

/**
 * Sqrt rather than linear, scaled to the busiest cell.
 *
 * Watch time is heavily peaked — one evening hour routinely holds ten times
 * a mid-morning one — and on a linear ramp that flattens every other cell to
 * near-invisible, which hides exactly the secondary pattern (the lunchtime
 * bump, the weekend morning) this grid exists to reveal. The busiest cell is
 * still the darkest; the quiet ones just stay readable.
 */
export function heatmapTint(seconds: number, max: number): number {
  if (seconds <= 0 || max <= 0) return 0;
  const ratio = Math.min(1, seconds / max);
  return Math.round(MIN_TINT + (MAX_TINT - MIN_TINT) * Math.sqrt(ratio));
}

function tintStyle(tint: number) {
  return { backgroundColor: `color-mix(in oklab, var(--chart-1) ${tint}%, transparent)` };
}

/** Legend swatches, chosen so `heatmapTint` spaces them evenly (sqrt of 0.04…1). */
const LEGEND_STEPS = [4, 16, 36, 64, 100];

/**
 * The 7x24 grid: weekday down, hour across, one cell per hour of the week.
 *
 * Recharts has no heatmap, and this is a plain CSS grid rather than an SVG
 * because 168 divs with a `title` each give every cell a native tooltip and
 * keep the whole thing selectable, zoomable and printable for free.
 *
 * The `cells` array is always all 168 entries — the backend fills the zeros —
 * so this indexes positionally without guarding for gaps, but it still writes
 * into a pre-zeroed grid rather than trusting the order they arrive in.
 */
export function WatchTimeHeatmap({ cells }: { cells: WatchTimeHeatmapCell[] }) {
  const { t } = useLanguage();
  const w = t.tracking.watchTime;

  const grid: number[][] = Array.from({ length: WEEKDAY_COUNT }, () =>
    Array.from({ length: HOUR_COUNT }, () => 0),
  );
  let max = 0;
  for (const cell of cells) {
    if (cell.weekday < 0 || cell.weekday >= WEEKDAY_COUNT) continue;
    if (cell.hour < 0 || cell.hour >= HOUR_COUNT) continue;
    grid[cell.weekday][cell.hour] = cell.seconds;
    if (cell.seconds > max) max = cell.seconds;
  }

  const weekdays = Array.from({ length: WEEKDAY_COUNT }, (_, i) => i);
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => i);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{w.heatmap.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{w.heatmap.description}</p>
      </CardHeader>
      <CardContent>
        {max === 0 ? (
          // Said in words rather than drawn as 168 empty squares, which a
          // reader would otherwise have to decode as "nothing happened".
          <p className="py-8 text-center text-sm text-muted-foreground">{w.heatmap.empty}</p>
        ) : (
          <>
            {/* 24 columns need room; the page must never scroll sideways, so
                the grid carries its own scroller and a minimum width. */}
            <div className="overflow-x-auto pb-1">
              <div
                className="grid min-w-[46rem] gap-[3px]"
                style={{ gridTemplateColumns: `2.75rem repeat(${HOUR_COUNT}, minmax(0, 1fr))` }}
              >
                <div aria-hidden="true" />
                {hours.map((hour) => (
                  <div
                    key={`head-${hour}`}
                    className="pb-1 text-center text-[10px] tabular-nums text-muted-foreground"
                  >
                    {w.hours[hour]}
                  </div>
                ))}

                {weekdays.map((weekday) => (
                  <Fragment key={weekday}>
                    <div className="flex items-center pr-2 text-[11px] text-muted-foreground">
                      {w.weekdaysShort[weekday]}
                    </div>
                    {hours.map((hour) => {
                      const seconds = grid[weekday][hour];
                      const tint = heatmapTint(seconds, max);
                      return (
                        <div
                          key={`${weekday}-${hour}`}
                          // Native tooltip: 168 React-rendered popovers would
                          // cost far more than this says.
                          title={w.heatmap.cellLabel(
                            w.weekdays[weekday],
                            hourRangeLabel(hour, t),
                            formatWatchDuration(seconds, t),
                          )}
                          className={cn(
                            "h-7 rounded-[3px] border border-border/40",
                            tint === 0 && "bg-muted-foreground/10",
                          )}
                          style={tint > 0 ? tintStyle(tint) : undefined}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
              <span>{w.heatmap.legendLess}</span>
              {LEGEND_STEPS.map((step) => (
                <span
                  key={step}
                  aria-hidden="true"
                  className="size-3 rounded-[3px] border border-border/40"
                  style={tintStyle(heatmapTint(step, 100))}
                />
              ))}
              <span>{w.heatmap.legendMore}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
