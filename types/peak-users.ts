export interface PeakUsersAdminView {
  /** Highest tracked concurrent USER count — never faked. */
  actualPeak: number;
  /** When the tracked peak was recorded; null until a peak has ever been recorded. */
  actualPeakAt: string | null;
  /** Admin-set amount added on top of the tracked peak (>= 0). */
  additionalPeak: number;
  /** actualPeak + additionalPeak — what the public site displays. */
  displayedPeak: number;
}
