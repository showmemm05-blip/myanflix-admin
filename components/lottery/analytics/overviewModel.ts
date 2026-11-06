/**
 * The six overview cards, worked out from GET …/overview (pure, so the
 * delta rules can be read in one place):
 *
 * - "+18% vs previous 7 days" when the comparison period has a value > 0;
 * - "No earlier data" when the first purchase ever is later than the start
 *   of the comparison window (it is not fully covered), or unknown;
 * - "—" otherwise (covered, but nothing happened then);
 * - Today: the backend compares a part-day with ALL of yesterday, which is
 *   no percentage, so the card gives yesterday's whole-day figure in words
 *   ("Yesterday, whole day: 1,240") instead of a misleading "−72%".
 *
 * The deltas are an icon plus signed text, never colour alone.
 */
import type { TranslationShape } from "@/lib/i18n/translations";
import type { LotteryAnalyticsOverview, LotteryAnalyticsTotals } from "@/types/lottery-analytics";
import {
  type ComparisonWords,
  formatAverage,
  formatCount,
  formatSignedPct,
  hourRangeLabel,
} from "@/components/lottery/analytics/format";
import { ymdToDayNumber } from "@/components/lottery/analytics/period";

export type DeltaDirection = "up" | "down" | "flat" | "none" | "clock";

export interface OverviewCardModel {
  key: "ticketsSold" | "purchases" | "buyers" | "popularNumber" | "peakHour" | "avgTickets";
  label: string;
  value: string;
  /** The number card: monospace, letter-spaced. */
  mono?: boolean;
  /** The hour card: a range of words, so a smaller size than a count. */
  small?: boolean;
  delta: { text: string; direction: DeltaDirection };
}

/** True when the comparison window lies entirely after the first sale ever (so its figures are real). */
export function comparisonCovered(firstSaleDate: string | null, previousFrom: string): boolean {
  return firstSaleDate !== null && ymdToDayNumber(firstSaleDate) <= ymdToDayNumber(previousFrom);
}

function numericDelta(
  t: TranslationShape,
  current: number,
  previous: number,
  covered: boolean,
  words: ComparisonWords,
  format: (value: number) => string = formatCount,
): OverviewCardModel["delta"] {
  const o = t.lottery.analytics.overview;
  const hasPrevious = previous > 0 || covered;
  // Today so far against all of yesterday: the earlier figure in words, no arrow.
  if (words.partialDay) {
    return { text: hasPrevious ? o.todayPrevious(format(previous)) : o.noEarlierData, direction: "none" };
  }
  if (previous > 0) {
    const change = (current - previous) / previous;
    const rounded = Math.round(change * 100);
    return {
      text: o.delta(formatSignedPct(change), words.vs),
      direction: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat",
    };
  }
  return { text: covered ? t.lottery.analytics.none : o.noEarlierData, direction: "none" };
}

function average(totals: LotteryAnalyticsTotals): number {
  if (totals.avgTicketsPerPurchase !== null) return totals.avgTicketsPerPurchase;
  return totals.purchases > 0 ? totals.ticketsSold / totals.purchases : 0;
}

/**
 * @param words the comparison period in its grammatical shapes (format.ts comparisonWords).
 * @param covered whether the comparison window lies after the first sale (comparisonCovered).
 */
export function buildOverviewCards(
  t: TranslationShape,
  overview: LotteryAnalyticsOverview,
  words: ComparisonWords,
  covered: boolean,
): OverviewCardModel[] {
  const o = t.lottery.analytics.overview;
  const none = t.lottery.analytics.none;
  const { current, previous } = overview;
  const tracked = overview.activity.trackedInRange;

  const popular: OverviewCardModel["delta"] = !covered
    ? { text: o.noEarlierData, direction: "none" }
    : previous.popularNumber === null || current.popularNumber === null
      ? { text: none, direction: "none" }
      : previous.popularNumber.number === current.popularNumber.number
        ? { text: o.numberAlsoFirst(words.in), direction: "flat" }
        : { text: o.numberWas(previous.popularNumber.number, words.in), direction: "none" };

  const peak: OverviewCardModel = tracked
    ? {
        key: "peakHour",
        label: o.peakHour,
        value: current.peakHour ? hourRangeLabel(t, current.peakHour.hour) : none,
        small: true,
        delta: !covered
          ? { text: o.noEarlierData, direction: "none" }
          : previous.peakHour === null || current.peakHour === null
            ? { text: none, direction: "none" }
            : previous.peakHour.hour === current.peakHour.hour
              ? { text: o.peakSame(words.same), direction: "flat" }
              : { text: o.peakWas(hourRangeLabel(t, previous.peakHour.hour), words.in), direction: "none" },
      }
    : {
        key: "peakHour",
        label: o.peakHour,
        value: none,
        small: true,
        delta: { text: o.trackingStarts, direction: "clock" },
      };

  return [
    {
      key: "ticketsSold",
      label: o.ticketsSold,
      value: formatCount(current.ticketsSold),
      delta: numericDelta(t, current.ticketsSold, previous.ticketsSold, covered, words),
    },
    {
      key: "purchases",
      label: o.purchases,
      value: formatCount(current.purchases),
      delta: numericDelta(t, current.purchases, previous.purchases, covered, words),
    },
    {
      key: "buyers",
      label: o.buyers,
      value: formatCount(current.buyers),
      delta: numericDelta(t, current.buyers, previous.buyers, covered, words),
    },
    {
      key: "popularNumber",
      label: o.popularNumber,
      value: current.popularNumber?.number ?? none,
      mono: true,
      delta: popular,
    },
    peak,
    {
      key: "avgTickets",
      label: o.avgTickets,
      value: current.purchases > 0 ? formatAverage(average(current)) : none,
      delta: numericDelta(t, average(current), average(previous), covered, words, (v) =>
        previous.purchases > 0 ? formatAverage(v) : none,
      ),
    },
  ];
}
