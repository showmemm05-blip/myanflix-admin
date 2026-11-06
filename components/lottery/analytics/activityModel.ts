/**
 * The activity chart's data, insight sentence and notes row, worked out
 * from GET …/activity (pure). One point per bucket, carrying the words the
 * axis, the tooltip and the table twin show, so the three can never say
 * different things about the same bucket.
 */
import type { TranslationShape } from "@/lib/i18n/translations";
import type {
  LotteryAnalyticsActivity,
  LotteryAnalyticsBucket,
  LotteryAnalyticsChartView,
} from "@/types/lottery-analytics";
import {
  clockLabel,
  formatCount,
  formatDay,
  formatShortDate,
  hourRangeLabel,
  weekdayNameFromKey,
} from "@/components/lottery/analytics/format";
import {
  type DashboardPeriodKey,
  type DateRange,
  type MmtClock,
  addDays,
  daySpan,
  ymdToDayNumber,
} from "@/components/lottery/analytics/period";

export interface ActivityPoint {
  key: string;
  /** The x-axis tick. */
  xLabel: string;
  /** The tooltip's and the table's first column. */
  title: string;
  ticketsSold: number;
  purchases: number;
  purchasingUsers: number;
  activeUsers: number | null;
  /** Today's hours after the current MMT hour: drawn empty, said so. */
  future: boolean;
}

/** Up to how many days the daily axis spells the weekday out ("Thu 16 Oct"); beyond, "16 Oct". */
const WEEKDAY_AXIS_DAYS = 7;

export function buildActivityPoints(
  t: TranslationShape,
  view: LotteryAnalyticsChartView,
  activity: LotteryAnalyticsActivity,
  range: DateRange,
  periodKey: DashboardPeriodKey,
  clock: MmtClock,
): ActivityPoint[] {
  const a = t.lottery.analytics.activity;
  const days = daySpan(range);
  return activity.buckets.map((bucket) => {
    const base = {
      key: bucket.key,
      ticketsSold: bucket.ticketsSold,
      purchases: bucket.purchases,
      purchasingUsers: bucket.purchasingUsers,
      activeUsers: bucket.activeUsers,
    };
    if (view === "hourly") {
      const hour = Number(bucket.key);
      const future = periodKey === "today" && hour > clock.hour;
      const title = `${hourRangeLabel(t, hour)} ${t.lottery.analytics.mmt}`;
      return { ...base, xLabel: bucket.key, title: future ? `${title} · ${a.stillToCome}` : title, future };
    }
    if (view === "daily") {
      return {
        ...base,
        xLabel: days > WEEKDAY_AXIS_DAYS ? formatShortDate(t, bucket.key) : formatDay(t, bucket.key),
        title: formatDay(t, bucket.key, true),
        future: false,
      };
    }
    // Weekly: the key is the Monday; a week cut by the range's edges says how much of it is inside.
    const first = Math.max(ymdToDayNumber(bucket.key), ymdToDayNumber(range.from));
    const last = Math.min(ymdToDayNumber(addDays(bucket.key, 6)), ymdToDayNumber(range.to));
    const inside = Math.max(0, last - first + 1);
    const title = a.weekOf(formatDay(t, bucket.key));
    return {
      ...base,
      xLabel: formatShortDate(t, bucket.key),
      title: inside < 7 ? `${title} · ${a.partialWeek(inside)}` : title,
      future: false,
    };
  });
}

/** The index of the largest `pick(point)` among the points `ok` admits, or -1. */
function argMax<T>(items: T[], pick: (item: T) => number, ok: (item: T) => boolean): number {
  let best = -1;
  let value = -Infinity;
  items.forEach((item, i) => {
    if (!ok(item)) return;
    const v = pick(item);
    if (v > value) {
      value = v;
      best = i;
    }
  });
  return best;
}

function argMin<T>(items: T[], pick: (item: T) => number, ok: (item: T) => boolean): number {
  let best = -1;
  let value = Infinity;
  items.forEach((item, i) => {
    if (!ok(item)) return;
    const v = pick(item);
    if (v < value) {
      value = v;
      best = i;
    }
  });
  return best;
}

/** A bucket with something in it; when active users are tracked they count as "something" too. */
function hasData(tracked: boolean) {
  return (b: Pick<LotteryAnalyticsBucket, "ticketsSold" | "activeUsers">) =>
    b.ticketsSold > 0 || (tracked && (b.activeUsers ?? 0) > 0);
}

/** The busiest bucket's measure: active users once tracked, tickets before. */
function busyMeasure(tracked: boolean) {
  return (b: Pick<LotteryAnalyticsBucket, "ticketsSold" | "activeUsers">) =>
    tracked ? (b.activeUsers ?? 0) : b.ticketsSold;
}

/** "2:00 PM–3:00 PM MMT is the busiest hour, with 418 unique active users and 740 tickets purchased." */
export function activityInsight(
  t: TranslationShape,
  view: LotteryAnalyticsChartView,
  points: ActivityPoint[],
  tracked: boolean,
): string {
  const a = t.lottery.analytics.activity;
  const i = argMax(points, busyMeasure(tracked), hasData(tracked));
  if (i === -1) return a.insightNone;
  const p = points[i];
  const tickets = formatCount(p.ticketsSold);
  const active = formatCount(p.activeUsers ?? 0);
  const buyers = formatCount(p.purchasingUsers);
  if (view === "hourly") {
    const hour = hourRangeLabel(t, Number(p.key));
    return tracked ? a.insightHour(hour, active, tickets) : a.insightHourUntracked(hour, buyers, tickets);
  }
  if (view === "daily") {
    const day = formatDay(t, p.key, false);
    return tracked ? a.insightDay(day, active, tickets) : a.insightDayUntracked(day, buyers, tickets);
  }
  const week = formatDay(t, p.key, false);
  return tracked ? a.insightWeek(week, active, tickets) : a.insightWeekUntracked(week, buyers, tickets);
}

export interface ActivityNotes {
  busiestHourLabel: string;
  busiestHour: string;
  quietestHour: string;
  busiestDay: string;
  highestPurchasing: string;
  lowestPurchasing: string;
}

/**
 * The notes row under the chart. The hours come from the HOURLY series
 * whatever view is drawn; the day from the weekday series (the "Busiest
 * days" card's data).
 */
export function activityNotes(
  t: TranslationShape,
  hourly: LotteryAnalyticsActivity | null,
  weekday: LotteryAnalyticsActivity | null,
  tracked: boolean,
): ActivityNotes {
  const a = t.lottery.analytics.activity;
  const none = t.lottery.analytics.none;
  const hours = hourly?.buckets ?? [];
  const ok = hasData(tracked);
  const busy = argMax(hours, busyMeasure(tracked), ok);
  const quiet = argMin(hours, busyMeasure(tracked), ok);
  const high = argMax(hours, (b) => b.purchases, (b) => b.ticketsSold > 0);
  const low = argMin(hours, (b) => b.purchases, (b) => b.ticketsSold > 0);
  const days = weekday?.buckets ?? [];
  const busyDay = argMax(days, (b) => b.ticketsSold, (b) => b.ticketsSold > 0);
  const hour = (i: number) => (i === -1 ? none : hourRangeLabel(t, Number(hours[i].key)));
  return {
    busiestHourLabel: tracked ? a.notes.busiestHour : a.notes.busiestHourByTickets,
    busiestHour: hour(busy),
    quietestHour: hour(quiet),
    busiestDay: busyDay === -1 ? none : weekdayNameFromKey(t, days[busyDay].key),
    highestPurchasing: hour(high),
    lowestPurchasing: hour(low),
  };
}

/** The line under the x-axis: what the buckets are and in which zone. */
export function activityAxisLabel(
  t: TranslationShape,
  view: LotteryAnalyticsChartView,
  range: DateRange,
  periodKey: DashboardPeriodKey,
  clock: MmtClock,
  rangeWords: string,
): string {
  const a = t.lottery.analytics.activity;
  if (view === "hourly") {
    return periodKey === "today"
      ? `${a.axisHourly} · ${a.axisHourlyToday(clockLabel(t, clock))}`
      : a.axisHourly;
  }
  if (view === "daily") return a.axisDaily(rangeWords);
  void range;
  return a.axisWeekly;
}
