/**
 * Where the ad breaks of one movie fall — for "What viewers will get" in the
 * Ad settings card (2026-11-04), worked out from the values the admin is
 * still typing.
 *
 * The same rule the players' scheduler follows
 * (userwebsite/lib/player/midroll.ts, docs/in-movie-ads-2026-11-04/
 * SCHEDULER-SPEC.md): break k ≥ 1 sits at k × interval of MOVIE time, and
 * plays only when it is at or before duration − end guard; an interval under
 * one minute means no breaks. Pure and import-free, so the node test loads
 * it as it is.
 */

/** Below this (or not a number) there are no breaks — the scheduler's MIDROLL_MIN_INTERVAL_SECONDS. */
export const BREAK_MIN_INTERVAL_SECONDS = 60;

/**
 * The movie seconds of every break, ascending: `[1800, 3600, 5400]` for a
 * 2-hour movie, a 30-minute interval and the 120-second end guard. Empty when
 * breaks are off or the movie is too short for even one.
 */
export function breakPositions(movieSeconds: number, intervalSeconds: number, endGuardSeconds: number): number[] {
  if (!Number.isFinite(movieSeconds) || movieSeconds <= 0) return [];
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < BREAK_MIN_INTERVAL_SECONDS) return [];
  const interval = Math.floor(intervalSeconds);
  const guard = Number.isFinite(endGuardSeconds) && endGuardSeconds > 0 ? endGuardSeconds : 0;
  const limit = movieSeconds - guard;
  const positions: number[] = [];
  for (let at = interval; at <= limit; at += interval) positions.push(at);
  return positions;
}

/**
 * A movie position or length as whole hours and minutes, for the words
 * "30 min", "1 h", "1 h 30 min" (2026-11-04: a movie time is never written
 * "0:30" / "1:00", which read as a clock). Floored to the minute (a break
 * always sits on a whole minute); nothing readable or below zero is 0.
 */
export function movieTimeParts(seconds: number): { hours: number; minutes: number } {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds / 60) : 0;
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
