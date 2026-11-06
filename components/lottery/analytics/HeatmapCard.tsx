"use client";

import { Fragment, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/ErrorState";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { LotteryAnalyticsHeatmap, LotteryAnalyticsHeatmapMeasure } from "@/types/lottery-analytics";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { csvFileName, downloadCsv } from "@/components/lottery/analytics/csv";
import { formatCount, hourRangeLabel } from "@/components/lottery/analytics/format";
import { type DateRange, weekdayCounts } from "@/components/lottery/analytics/period";

const WEEKDAYS = 7;
const HOURS = 24;
/** The five one-hue steps of the legend, as color-mix percentages of --chart-1. */
const LEVEL_TINTS = [18, 36, 54, 72, 92];
const MEASURES: readonly LotteryAnalyticsHeatmapMeasure[] = ["tickets", "purchasingUsers"];

function tintStyle(level: number) {
  return { backgroundColor: `color-mix(in oklab, var(--chart-1) ${LEVEL_TINTS[level - 1]}%, transparent)` };
}

/** 1–5 for a non-zero value against the busiest cell, 0 for nothing. */
export function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((value / max) * 5)));
}

interface HeatmapCardProps {
  data: LotteryAnalyticsHeatmap | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  range: DateRange | null;
  drawText: string;
  rangeText: string;
}

/**
 * 7 weekdays × 24 hours (MMT), one measure at a time (tickets sold or
 * purchasing users — both come in every cell, the toggle is local). Cells
 * are 44 px buttons with a native tooltip (168 popovers would cost far
 * more than they say), the busiest one ringed; the legend gives the five
 * steps' value ranges. With no period (all time) the "across n Mondays"
 * count is unknown and left out.
 */
export function HeatmapCard({ data, isLoading, error, onRetry, range, drawText, rangeText }: HeatmapCardProps) {
  const { t } = useLanguage();
  const a = t.lottery.analytics;
  const h = a.reports.heatmap;
  const [measure, setMeasure] = useState<LotteryAnalyticsHeatmapMeasure>("tickets");
  const measureName = h.measures[measure];
  const counts = range ? weekdayCounts(range) : null;

  const grid: number[][] = Array.from({ length: WEEKDAYS }, () => Array.from({ length: HOURS }, () => 0));
  let max = 0;
  let maxDay = -1;
  let maxHour = -1;
  for (const cell of data?.cells ?? []) {
    if (cell.weekday < 0 || cell.weekday >= WEEKDAYS || cell.hour < 0 || cell.hour >= HOURS) continue;
    const value = measure === "tickets" ? cell.ticketsSold : cell.purchasingUsers;
    grid[cell.weekday][cell.hour] = value;
    if (value > max) {
      max = value;
      maxDay = cell.weekday;
      maxHour = cell.hour;
    }
  }
  const measureWord = measureName.toLowerCase();
  // All time has no day count ("across 3 Mondays"), so its sentences leave it out.
  const cellWords = (weekday: number, hour: number, value: number) =>
    counts
      ? h.cell(a.weekdays[weekday], hourRangeLabel(t, hour), formatCount(value), measureWord, a.days.inPeriod(counts[weekday], a.weekdays[weekday]))
      : h.cellAllTime(a.weekdays[weekday], hourRangeLabel(t, hour), formatCount(value), measureWord);
  const insight =
    maxDay === -1
      ? h.insightNone
      : counts
        ? h.insight(a.weekdays[maxDay], hourRangeLabel(t, maxHour), formatCount(max), measureWord, a.days.inPeriod(counts[maxDay], a.weekdays[maxDay]))
        : h.insightAllTime(a.weekdays[maxDay], hourRangeLabel(t, maxHour), formatCount(max), measureWord);
  // The five steps' value ranges match heatLevel's thresholds; with a small max some steps hold no
  // whole number at all (hi < lo) and no cell ever takes them, so they are left off the legend.
  const step = max / 5;
  const legend = [1, 2, 3, 4, 5]
    .map((level) => {
      const lo = Math.floor(step * (level - 1)) + 1;
      const hi = level === 5 ? max : Math.floor(step * level);
      return { level, lo, hi };
    })
    .filter((s) => s.hi >= s.lo)
    .map((s) => ({ level: s.level, label: s.hi === s.lo ? formatCount(s.lo) : `${formatCount(s.lo)}–${formatCount(s.hi)}` }));

  const exportCsv = () => {
    const file = csvFileName(h.csvStem, range, measure);
    downloadCsv(
      file,
      ["weekday", ...Array.from({ length: HOURS }, (_, i) => `h${String(i).padStart(2, "0")}`)],
      grid.map((row, weekday) => [["mon", "tue", "wed", "thu", "fri", "sat", "sun"][weekday], ...row]),
    );
    return file;
  };

  const toggle = (
    <Tabs value={measure} onValueChange={(v) => v && setMeasure(v as LotteryAnalyticsHeatmapMeasure)}>
      <TabsList className="h-8">
        {MEASURES.map((m) => (
          <TabsTrigger key={m} value={m} className="px-2 text-xs">
            {h.measures[m]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <AnalyticsCard
      title={h.title}
      description={h.sub(measureName, drawText, rangeText)}
      actions={
        <>
          {toggle}
          <ExportButton onExport={exportCsv} disabled={!data} />
        </>
      }
      refreshing={isLoading && data !== null}
    >
      {error ? (
        <ErrorState description={a.states.cardError} onRetry={onRetry} />
      ) : !data ? (
        <Skeleton className="h-80 rounded-lg" />
      ) : (
        <>
          <div className="overflow-x-auto pb-1">
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `3rem repeat(${HOURS}, 44px)`, minWidth: `${3 * 16 + HOURS * 47}px` }}
            >
              <div aria-hidden="true" />
              {Array.from({ length: HOURS }, (_, hour) => (
                <div key={`head-${hour}`} className="pb-1 text-center text-[10px] tabular-nums text-muted-foreground">
                  {String(hour).padStart(2, "0")}
                </div>
              ))}
              {grid.map((row, weekday) => (
                <Fragment key={weekday}>
                  <div className="flex items-center pr-2 text-[11px] text-muted-foreground">{a.weekdaysShort[weekday]}</div>
                  {row.map((value, hour) => {
                    const level = heatLevel(value, max);
                    const isMax = weekday === maxDay && hour === maxHour;
                    const hasDays = !counts || counts[weekday] > 0;
                    const title = hasDays ? cellWords(weekday, hour, value) : h.cellNoData(a.weekdays[weekday], hourRangeLabel(t, hour));
                    return (
                      <button
                        key={`${weekday}-${hour}`}
                        type="button"
                        title={title}
                        aria-label={title}
                        className={cn(
                          "h-11 w-11 rounded-[4px] border border-border/40 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          level === 0 && (hasDays ? "bg-muted-foreground/10" : "bg-transparent"),
                          isMax && "ring-2 ring-foreground/70",
                        )}
                        style={level > 0 ? tintStyle(level) : undefined}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] border border-border/40 bg-muted-foreground/10" />
              {h.noData}
            </span>
            {max > 0 &&
              legend.map((l) => (
                <span key={l.level} className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-[3px] border border-border/40" style={tintStyle(l.level)} />
                  {l.label}
                </span>
              ))}
            {max > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] ring-2 ring-foreground/70" style={tintStyle(5)} />
                {h.busiestCell}
              </span>
            )}
          </div>
          <p className="text-sm">{insight}</p>
          <p className="text-[11px] text-muted-foreground">{h.footer}</p>
        </>
      )}
    </AnalyticsCard>
  );
}
