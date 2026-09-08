/**
 * One rung of the subscription-spend membership ladder. A user's level is
 * never stored — the backend resolves it at read time from SUM(COMPLETED
 * SUBSCRIPTION transactions) against these thresholds, so editing a
 * threshold here re-ranks everyone.
 */
export interface AppLevel {
  id: string;
  name: string;
  /** Qualifying lifetime subscription spend (Ks) required to hold this level. */
  threshold: number;
  /** One key from the closed badge glyph set — drawn as inline SVG, never a URL. */
  icon: string;
  /** #RRGGBB badge tint; light/dark gradient shades are derived client-side. */
  color: string;
  /** Display position only — resolution math sorts by threshold, not this. */
  order: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /users/:id/level — a user's resolved standing on the ladder. `level`
 * is the held rung (null below the lowest enabled threshold), `nextLevel`
 * the one being progressed toward (null at the top, where progressPercent
 * is 100 — or 0 when no levels are enabled at all).
 */
export interface UserLevelStatus {
  /** SUM of the user's COMPLETED SUBSCRIPTION transactions (Ks) — the qualifying total. */
  qualifyingTotal: number;
  level: AppLevel | null;
  nextLevel: AppLevel | null;
  /** Ks of subscription spend still needed to reach `nextLevel`; null when there is none. */
  remaining: number | null;
  /** 0-100, already clamped and rounded server-side. */
  progressPercent: number;
  /** Enabled levels in display order, so no second call is ever needed. */
  ladder: AppLevel[];
}
