"use client";

import { useState } from "react";
import { Activity, CalendarClock, CalendarDays, Clock, Globe, RotateCw, Smartphone, Timer } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { DateRangeFilter, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { DashboardCard } from "@/components/cards/DashboardCard";
import { PlatformFilter } from "@/components/tracking/PlatformFilter";
import { WatchTimeHeatmap } from "@/components/tracking/WatchTimeHeatmap";
import {
  WatchTimeHourChart,
  WatchTimeWeekdayChart,
} from "@/components/tracking/WatchTimeCharts";
import {
  endOfDayIso,
  formatWatchDuration,
  hourRangeLabel,
  startOfDayIso,
} from "@/components/tracking/trackingFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { trackingService } from "@/services/api/trackingService";
import type { ClientPlatform } from "@/types/tracking";

/**
 * The busiest bucket in a set, or null when every one of them is empty.
 *
 * The `> 0` test is the whole point: `byHour` and `byWeekday` always arrive
 * full length, so a plain max over 24 zeroes would confidently report midnight
 * as the busiest hour of a period in which nobody watched anything.
 */
function busiest<T extends { total: number }>(buckets: T[]): T | null {
  let best: T | null = null;
  for (const bucket of buckets) {
    if (bucket.total > 0 && (best === null || bucket.total > best.total)) best = bucket;
  }
  return best;
}

export default function TrackingWatchTimePage() {
  const { t } = useLanguage();
  const w = t.tracking.watchTime;

  // All dates by default: the shape of a week only emerges over weeks, and a
  // report that opens on today would show one thin column of the heatmap.
  const [range, setRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [platform, setPlatform] = useState<ClientPlatform | "">("");

  const { data, isLoading, error, refetch } = useAsyncData(
    () =>
      // No page/limit anywhere near this call — the route rejects unknown
      // query props outright, and the service destructures the three it
      // accepts precisely so a stray one cannot ride along.
      trackingService.getWatchTime({
        from: range.from ? startOfDayIso(range.from) : undefined,
        to: range.to ? endOfDayIso(range.to) : undefined,
        platform: platform || undefined,
      }),
    [range, platform],
  );

  const isFiltered = !!range.from || !!range.to || !!platform;
  /**
   * `peak` is null exactly when every one of the 168 cells is zero — the
   * backend sets it only from a cell with seconds in it. That null is the
   * "no data yet" signal; deriving a peak from the zeros would invent one.
   */
  const peak = data?.peak ?? null;
  const hasData = peak !== null;

  const peakHour = data ? busiest(data.byHour) : null;
  const peakDay = data ? busiest(data.byWeekday) : null;

  const filters = (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-3">
      <PlatformFilter
        value={platform}
        onChange={setPlatform}
        label={w.filters.platformLabel}
        allLabel={w.filters.platformAll}
      />
      <DateRangeFilter value={range} onChange={setRange} />
    </div>
  );

  /**
   * Card VALUES stay short and the precision goes in the caption underneath.
   *
   * A value is `text-2xl` and truncates; a caption wraps. In Burmese an hour
   * label is "မွန်းတည့် ၁၂ နာရီ" and a full range is twice that, so putting
   * the range in the value would cut the peak of the week off mid-word on
   * exactly the card that matters most.
   */
  const headCards = [
    {
      key: "peak",
      title: w.cards.peak,
      value: peak
        ? `${w.weekdaysShort[peak.weekday]} · ${w.hourLabels[peak.hour]}`
        : t.tracking.common.none,
      hint: peak
        ? `${w.weekdays[peak.weekday]} · ${hourRangeLabel(peak.hour, t)} · ${formatWatchDuration(peak.seconds, t)}`
        : w.cards.peakEmpty,
      icon: CalendarClock,
      iconClassName: "bg-primary/15 text-primary",
    },
    {
      key: "busiestHour",
      // Across every weekday, unlike `peak`, which is one specific cell.
      title: w.cards.busiestHour,
      value: peakHour ? w.hourLabels[peakHour.hour] : t.tracking.common.none,
      hint: peakHour
        ? `${hourRangeLabel(peakHour.hour, t)} · ${formatWatchDuration(peakHour.total, t)}`
        : w.cards.peakEmpty,
      icon: Clock,
      iconClassName: "bg-info/15 text-info",
    },
    {
      key: "busiestDay",
      title: w.cards.busiestDay,
      value: peakDay ? w.weekdays[peakDay.weekday] : t.tracking.common.none,
      hint: peakDay ? formatWatchDuration(peakDay.total, t) : w.cards.peakEmpty,
      icon: CalendarDays,
      iconClassName: "bg-chart-5/15 text-chart-5",
    },
  ];

  const splitCards = [
    {
      key: "totalWatched",
      title: w.cards.totalWatched,
      value: data ? formatWatchDuration(data.totals.total, t) : t.tracking.common.none,
      hint: w.timezoneNote,
      icon: Timer,
      iconClassName: "bg-success/15 text-success",
    },
    {
      key: "web",
      title: w.cards.web,
      value: data ? formatWatchDuration(data.totals.web, t) : t.tracking.common.none,
      hint: t.tracking.platform.WEB,
      icon: Globe,
      iconClassName: "bg-chart-2/15 text-chart-2",
    },
    {
      key: "mobile",
      title: w.cards.mobile,
      value: data ? formatWatchDuration(data.totals.mobile, t) : t.tracking.common.none,
      hint: t.tracking.platform.MOBILE,
      icon: Smartphone,
      iconClassName: "bg-chart-3/15 text-chart-3",
    },
    {
      key: "heartbeats",
      title: w.cards.heartbeats,
      value: data ? data.totals.heartbeats.toLocaleString() : t.tracking.common.none,
      hint: w.cards.heartbeatsHint,
      icon: Activity,
      iconClassName: "bg-muted-foreground/15 text-muted-foreground",
    },
  ];

  return (
    <RequirePermission permission="TRACKING.VIEW" title={w.title} description={w.subtitle}>
      <div>
        <PageHeader
          title={w.title}
          description={w.subtitle}
          actions={
            <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
              <RotateCw className="size-4" />
              {isLoading ? t.tracking.common.refreshing : t.tracking.common.refresh}
            </Button>
          }
        />

        <div className="flex flex-col gap-6">
          {/* "Most watched" reads as "most watched titles" to almost everyone.
              Said once, at the top, before anyone draws the wrong conclusion
              from a chart. */}
          <Alert>
            <Clock />
            <AlertTitle>{w.notTitlesNote}</AlertTitle>
            <AlertDescription>{w.timezoneNote}</AlertDescription>
          </Alert>

          {filters}

          {error ? (
            <ErrorState description={t.tracking.common.loadError} onRetry={refetch} />
          ) : isLoading || !data ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl bg-secondary/60" />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl bg-secondary/60" />
                ))}
              </div>
              <Skeleton className="h-72 rounded-xl bg-secondary/60" />
              <Skeleton className="h-72 rounded-xl bg-secondary/60" />
            </>
          ) : !hasData && !isFiltered ? (
            // Nothing recorded at all, ever — the honest empty state, not a
            // grid of zeroes. With a filter on, the report stays rendered so
            // the filter that emptied it can be undone.
            <EmptyState icon={Clock} title={w.empty.title} description={w.empty.description} />
          ) : (
            <>
              {/* Three wide cards for the wordy answers (a weekday, an hour),
                  four narrower ones for the numeric ones. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {headCards.map((card) => (
                  <div key={card.key} className="flex flex-col gap-1">
                    <DashboardCard
                      title={card.title}
                      value={card.value}
                      icon={card.icon}
                      iconClassName={card.iconClassName}
                    />
                    <p className="px-1 text-[11px] text-muted-foreground">{card.hint}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {splitCards.map((card) => (
                  <div key={card.key} className="flex flex-col gap-1">
                    <DashboardCard
                      title={card.title}
                      value={card.value}
                      icon={card.icon}
                      iconClassName={card.iconClassName}
                    />
                    <p className="px-1 text-[11px] text-muted-foreground">{card.hint}</p>
                  </div>
                ))}
              </div>

              <WatchTimeHeatmap cells={data.heatmap} />
              <WatchTimeHourChart report={data} />
              <WatchTimeWeekdayChart report={data} />
            </>
          )}
        </div>
      </div>
    </RequirePermission>
  );
}
