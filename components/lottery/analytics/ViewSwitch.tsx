"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/context/language-context";
import type { LotteryAnalyticsChartView } from "@/types/lottery-analytics";

const VIEWS: readonly LotteryAnalyticsChartView[] = ["hourly", "daily", "weekly"];

interface ViewSwitchProps {
  /**
   * The view actually DRAWN (effectiveChartView), so a greyed segment is
   * never the pressed one; the page keeps the view the user asked for on
   * its own and comes back to it when the period allows.
   */
  value: LotteryAnalyticsChartView;
  onChange: (view: LotteryAnalyticsChartView) => void;
  /** Daily needs more than one day, Weekly at least 14. */
  availability: { daily: boolean; weekly: boolean };
}

/** Hourly · Daily · Weekly as one segmented control, with the unavailable ones greyed and explained in their title. */
export function ViewSwitch({ value, onChange, availability }: ViewSwitchProps) {
  const { t } = useLanguage();
  const f = t.lottery.analytics.filters;
  const enabled = (view: LotteryAnalyticsChartView) =>
    view === "hourly" ? true : view === "daily" ? availability.daily : availability.weekly;

  return (
    <Tabs value={value} onValueChange={(v) => v && onChange(v as LotteryAnalyticsChartView)}>
      <TabsList className="h-8" aria-label={f.view}>
        {VIEWS.map((view) => {
          const on = enabled(view);
          return (
            <TabsTrigger
              key={view}
              value={view}
              disabled={!on}
              className="px-2 text-xs"
              title={on ? f.viewTitle(f.views[view]) : view === "hourly" ? undefined : f.viewHints[view]}
            >
              {f.views[view]}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
