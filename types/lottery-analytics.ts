/**
 * Wire types for the Lottery analytics pages (2026-10-23) — the staff side
 * of GET /lottery/admin/analytics/* (docs/lottery-analytics-2026-10-23/
 * CONTRACT.md §5). Every endpoint is LOTTERY.VIEW; every response comes
 * through the global `{ success, data }` envelope the apiClient unwraps.
 *
 * Every figure is in Myanmar time (MMT, UTC+6:30): a period is a pair of MMT
 * calendar dates `from`..`to` (YYYY-MM-DD, inclusive), the admin works them
 * out in the browser (components/lottery/analytics/period.ts) and the backend
 * converts them to UTC instants. Numbers are six-digit STRINGS with leading
 * zeros — never cast to int anywhere. Kyat amounts arrive as decimal strings
 * ("0.00") because they are SUM()s of a numeric column.
 */

import type { LotteryDrawStatus } from "@/types/lottery";

/** The backend refuses a span over this many days (400 LOTTERY_ANALYTICS_RANGE_TOO_LONG). */
export const LOTTERY_ANALYTICS_MAX_RANGE_DAYS = 366;

/** The popular-numbers CSV export fetches one page of this size — the backend's pageSize cap. */
export const LOTTERY_ANALYTICS_EXPORT_PAGE_SIZE = 1000;

/** The query every period endpoint takes. Both dates or neither; absent = the backend's default (all time on the reports endpoints). */
export interface LotteryAnalyticsPeriodQuery {
  from?: string;
  to?: string;
  /** Restricts purchases and tickets to one draw. Activity (the ping) is never draw-scoped. */
  drawId?: string;
}

export interface LotteryAnalyticsRange {
  from: string;
  to: string;
  /** The same number of days immediately before `from`. */
  previousFrom: string;
  previousTo: string;
}

export interface LotteryAnalyticsPopularNumber {
  number: string;
  tickets: number;
}

/** The hour-of-day (MMT, 0–23) with the most tickets sold; ties go to the earlier hour. */
export interface LotteryAnalyticsPeakHour {
  hour: number;
  ticketsSold: number;
  purchasingUsers: number;
  /** Null while the activity log has no rows inside the range. */
  activeUsers: number | null;
}

/** The totals of one period — the current one and the comparison one share the shape. */
export interface LotteryAnalyticsTotals {
  ticketsSold: number;
  purchases: number;
  /** COUNT(DISTINCT userId) over the period's purchases. */
  buyers: number;
  /** SUM(total) of the paid purchases, as a decimal string. */
  revenueKs: string;
  popularNumber: LotteryAnalyticsPopularNumber | null;
  peakHour: LotteryAnalyticsPeakHour | null;
  /** ticketsSold / purchases; null when there were no purchases. */
  avgTicketsPerPurchase: number | null;
}

/** GET /lottery/admin/analytics/overview */
export interface LotteryAnalyticsOverview {
  range: LotteryAnalyticsRange;
  current: LotteryAnalyticsTotals;
  previous: LotteryAnalyticsTotals;
  /** The first PAID purchase ever (ISO, UTC); null when nothing was ever sold. */
  firstPurchaseAt: string | null;
  activity: {
    /** The earliest activity row (ISO, UTC); null before the apps start pinging. */
    trackedSince: string | null;
    /** True when at least one activity row falls inside the range. */
    trackedInRange: boolean;
  };
}

export const LOTTERY_ANALYTICS_VIEWS = ["hourly", "daily", "weekly", "weekday"] as const;
export type LotteryAnalyticsView = (typeof LOTTERY_ANALYTICS_VIEWS)[number];

/** The three views the dashboard's segmented control offers (weekday feeds the "Busiest days" card). */
export type LotteryAnalyticsChartView = Exclude<LotteryAnalyticsView, "weekday">;

export interface LotteryAnalyticsActivityQuery extends LotteryAnalyticsPeriodQuery {
  view: LotteryAnalyticsView;
}

/**
 * One bucket of the activity series. `key` is "00".."23" (hourly, always 24),
 * "YYYY-MM-DD" (daily, every day in the range; weekly, the Monday) or
 * "mon".."sun" (weekday, 7). Zero-filled.
 */
export interface LotteryAnalyticsBucket {
  key: string;
  ticketsSold: number;
  purchases: number;
  purchasingUsers: number;
  /** Null in EVERY bucket when `activeUsersTracked` is false. */
  activeUsers: number | null;
}

/** GET /lottery/admin/analytics/activity */
export interface LotteryAnalyticsActivity {
  view: LotteryAnalyticsView;
  buckets: LotteryAnalyticsBucket[];
  /** False when no activity row falls inside the range — the apps had not started pinging. */
  activeUsersTracked: boolean;
}

/** The weekday keys as the wire sends them, Monday first. */
export const LOTTERY_ANALYTICS_WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type LotteryAnalyticsWeekdayKey = (typeof LOTTERY_ANALYTICS_WEEKDAY_KEYS)[number];

export const LOTTERY_ANALYTICS_NUMBER_SORTS = ["tickets", "buyers", "repeat"] as const;
export type LotteryAnalyticsNumberSort = (typeof LOTTERY_ANALYTICS_NUMBER_SORTS)[number];

export type LotteryAnalyticsSortOrder = "asc" | "desc";

export interface LotteryAnalyticsNumbersQuery extends LotteryAnalyticsPeriodQuery {
  sort?: LotteryAnalyticsNumberSort;
  order?: LotteryAnalyticsSortOrder;
  page?: number;
  /** At most 1000 (the CSV export); the backend's default is 10. */
  pageSize?: number;
}

/** How a number did against the comparison period. */
export interface LotteryAnalyticsNumberTrend {
  /** Tickets of the same number in the comparison period; null = "No earlier data". */
  previousTickets: number | null;
  /** (cur − prev) / prev; null when prev is 0 or unknown. */
  changePct: number | null;
  /** True when prev = 0 and the first purchase ever is at or before previousFrom. */
  isNew: boolean;
}

/** One row of GET /lottery/admin/analytics/numbers. */
export interface LotteryAnalyticsNumberRow {
  /** Position in the tickets-desc order, whatever sort was asked for. */
  rank: number;
  number: string;
  tickets: number;
  buyers: number;
  /** tickets / totalTickets, 0–1. */
  share: number;
  /** Buyers who bought this number more than once in the selection. */
  repeatBuyers: number;
  trend: LotteryAnalyticsNumberTrend;
}

export interface LotteryAnalyticsNumbersPage {
  items: LotteryAnalyticsNumberRow[];
  /** Distinct numbers played in the selection. */
  total: number;
  /** Every ticket in the selection — the share's denominator. */
  totalTickets: number;
  page: number;
  pageSize: number;
}

export const LOTTERY_ANALYTICS_ACROSS_SORTS = ["tickets", "buyers", "draws"] as const;
export type LotteryAnalyticsAcrossSort = (typeof LOTTERY_ANALYTICS_ACROSS_SORTS)[number];

/** GET …/numbers/across takes NO drawId — it is never limited by the draw select. */
export interface LotteryAnalyticsAcrossQuery {
  from?: string;
  to?: string;
  sort?: LotteryAnalyticsAcrossSort;
  order?: LotteryAnalyticsSortOrder;
  page?: number;
  pageSize?: number;
}

export interface LotteryAnalyticsAcrossRow {
  rank: number;
  number: string;
  tickets: number;
  buyers: number;
  share: number;
  /** Draws (in the period) in which the number was bought at least once. */
  drawsPlayed: number;
  /** Its best per-draw rank and the draw it was reached in; null when it never ranked. */
  bestRank: { rank: number; drawNo: number } | null;
}

export interface LotteryAnalyticsAcrossPage {
  items: LotteryAnalyticsAcrossRow[];
  total: number;
  totalTickets: number;
  page: number;
  pageSize: number;
}

export const LOTTERY_ANALYTICS_FREQUENCY_KEYS = ["1", "2-3", "4-9", "10+"] as const;
export type LotteryAnalyticsFrequencyKey = (typeof LOTTERY_ANALYTICS_FREQUENCY_KEYS)[number];

/** Buyers bucketed by how many purchases they made in the selection. */
export interface LotteryAnalyticsFrequencyBin {
  key: LotteryAnalyticsFrequencyKey;
  users: number;
  /** users / totalBuyers, 0–1. */
  share: number;
}

/**
 * How the backend told first-time from returning buyers: by the earliest
 * PAID purchase ever falling inside the selection (a window and/or a draw),
 * or — with no window AND no draw, where that rule makes everyone
 * first-time — by draws played (returning = bought in two or more draws).
 */
export type LotteryAnalyticsRepeatDefinition = "earliest-purchase" | "draws-played";

/** GET /lottery/admin/analytics/frequency */
export interface LotteryAnalyticsFrequency {
  bins: LotteryAnalyticsFrequencyBin[];
  totalBuyers: number;
  /** See LotteryAnalyticsRepeatDefinition. */
  firstTime: number;
  returning: number;
  definition: LotteryAnalyticsRepeatDefinition;
}

export const LOTTERY_ANALYTICS_HEATMAP_MEASURES = ["tickets", "purchasingUsers"] as const;
export type LotteryAnalyticsHeatmapMeasure = (typeof LOTTERY_ANALYTICS_HEATMAP_MEASURES)[number];

/** One of the 168 cells; weekday 0 = Monday, hour 0–23 MMT. Both measures always come. */
export interface LotteryAnalyticsHeatmapCell {
  weekday: number;
  hour: number;
  ticketsSold: number;
  purchasingUsers: number;
}

/** GET /lottery/admin/analytics/heatmap */
export interface LotteryAnalyticsHeatmap {
  cells: LotteryAnalyticsHeatmapCell[];
}

export const LOTTERY_ANALYTICS_BEFORE_CLOSE_KEYS = ["72-48h", "48-24h", "24-12h", "12-6h", "6-1h", "last-1h"] as const;
export type LotteryAnalyticsBeforeCloseKey = (typeof LOTTERY_ANALYTICS_BEFORE_CLOSE_KEYS)[number];

/** Tickets bought in one stretch before the draw's closing time; `hours` is the stretch's length. */
export interface LotteryAnalyticsBeforeCloseBin {
  key: LotteryAnalyticsBeforeCloseKey;
  tickets: number;
  hours: number;
}

/** The draw a before-close report is about — a slice of the admin draw shape. */
export interface LotteryAnalyticsBeforeCloseDraw {
  id: string;
  drawNo: number;
  thaiDrawDate: string;
  status: LotteryDrawStatus;
  salesCloseAt: string;
}

/** GET /lottery/admin/analytics/before-close */
export interface LotteryAnalyticsBeforeClose {
  draw: LotteryAnalyticsBeforeCloseDraw;
  /** False for an open / paused / scheduled draw: the bins are what has been sold so far. */
  closed: boolean;
  bins: LotteryAnalyticsBeforeCloseBin[];
  /** Tickets bought more than 72 hours before close. */
  earlier: number;
  total: number;
}

/** One row of GET /lottery/admin/analytics/draws — a whole sales window, never limited by the period. */
export interface LotteryAnalyticsDrawRow {
  id: string;
  drawNo: number;
  thaiDrawDate: string;
  status: LotteryDrawStatus;
  openedAt: string | null;
  salesCloseAt: string;
  tickets: number;
  buyers: number;
  revenueKs: string;
  /** The hour (MMT) with the most tickets over the whole window; null when nothing was sold. */
  peakHour: number | null;
  /** Null until published. */
  winnersCount: number | null;
  prizesPaidKs: string | null;
}

export interface LotteryAnalyticsDrawsQuery {
  page?: number;
  /** At most 100; the backend's default is 25. */
  pageSize?: number;
}

export interface LotteryAnalyticsDrawsPage {
  items: LotteryAnalyticsDrawRow[];
  total: number;
  page: number;
  pageSize: number;
}
