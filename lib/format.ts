/** Rendered where a runtime slot must stay visible but the value is unknown (labelled cells, episode rows). Meta lines omit the runtime instead. */
export const UNKNOWN_DURATION = "—";

/**
 * Runtime in minutes -> "45m" / "1h 32m". Returns null when the runtime is
 * unknown: 0 is the API's not-measured sentinel (a bulk-uploaded title whose
 * probe failed), and it must never surface as "0m".
 */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  // Guard the ROUNDED value: 0.4 min rounds to 0 and must be unknown, not "0m".
  const whole = Math.round(minutes);
  if (whole <= 0) return null;
  const hours = Math.floor(whole / 60);
  const remainingMinutes = whole % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  return `${hours}h ${remainingMinutes}m`;
}
