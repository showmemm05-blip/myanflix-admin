/**
 * Formatting shared by the three report screens (Watch Time, Searches,
 * Phone/IP). Every string it produces comes out of `t.tracking.*` — nothing
 * here hard-codes an "h" or an "m", because Burmese does not spell them that
 * way and a chart axis is as much UI copy as a paragraph is.
 */
import type { TranslationShape } from "@/lib/i18n/translations";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/**
 * `DateRangeFilter` emits a LOCAL calendar date; the API takes an instant.
 *
 * A bare "2026-08-20" is read as UTC midnight, so in Myanmar's +06:30 the
 * operator's chosen day would silently start at 06:30 and run into the next
 * one. Sending the local day's own boundaries makes the picked day the
 * picked day — and makes these three screens cover exactly the same window
 * as Comments and Feedback for the same pair of dates.
 */
export function startOfDayIso(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString();
}

export function endOfDayIso(day: string): string {
  return new Date(`${day}T23:59:59.999`).toISOString();
}

/**
 * Seconds as an operator reads them: the largest unit that still says
 * something. Under a minute stays in seconds (a 40-second cell is not "0m"),
 * under an hour in minutes, and above that hours-and-minutes.
 *
 * Negative or fractional input is clamped and rounded rather than rendered —
 * the wire only ever sends whole non-negative seconds, and a defensive
 * `Math.max` is cheaper than a "-1s" appearing on a chart axis.
 */
export function formatWatchDuration(seconds: number, t: TranslationShape): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < SECONDS_PER_MINUTE) return t.tracking.common.durationSeconds(total);

  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return t.tracking.common.durationMinutes(minutes);

  return t.tracking.common.durationHoursMinutes(
    Math.floor(minutes / MINUTES_PER_HOUR),
    minutes % MINUTES_PER_HOUR,
  );
}

/**
 * "8 PM – 9 PM" for hour bucket 20 — an hour bucket covers the hour that
 * FOLLOWS its label, and a peak card reading just "8 PM" invites the reader
 * to think of it as an instant rather than a 60-minute window.
 */
export function hourRangeLabel(hour: number, t: TranslationShape): string {
  const labels = t.tracking.watchTime.hourLabels;
  return t.tracking.watchTime.hourRange(labels[hour], labels[(hour + 1) % 24]);
}
