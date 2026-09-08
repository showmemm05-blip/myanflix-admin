/**
 * Wire types for the admin's Tracking section.
 *
 * Every shape here is transcribed from the backend's own exported view
 * interfaces in `backend/src/tracking/tracking-read.service.ts` — not guessed
 * from a screen. The one systematic difference is time: the service types its
 * timestamps as `Date`, and JSON turns every one of them into an ISO string,
 * so they are `string` on this side. Anything nullable there is nullable here.
 *
 * ## PII
 *
 * `phone` and `ipAddress` arrive **already masked** (`09*****369`,
 * `203.0.113.***`) unless the caller holds `TRACKING.PII_VIEW`. That decision
 * is the server's and is made before serialisation, so:
 *
 * - there is no unmasked value hiding in the response for the client to
 *   reveal, and no reason for a page to hide a column "for safety";
 * - a masked string is still a `string` — never test for a mask to decide
 *   what to render. If a page wants to explain why a value looks redacted,
 *   ask the permission (`can("TRACKING.PII_VIEW")`), not the value.
 *
 * `null` means the platform genuinely has no value on record (no phone on the
 * account, no IP captured for that session), which is a different thing from
 * masked and should read differently in the UI.
 */
import type { PaginatedResponse, PaginationParams } from "@/types/api";

// ---------------------------------------------------------------- enums

/** Prisma `ClientPlatform`. UNKNOWN = the request carried no platform signal. */
export type ClientPlatform = "WEB" | "MOBILE" | "UNKNOWN";

/** Prisma `CommentStatus`. HIDDEN rows still exist — they are just not served to users. */
export type CommentStatus = "VISIBLE" | "HIDDEN";

/** Prisma `FeedbackCategory`. */
export type FeedbackCategory =
  | "BUG"
  | "SUGGESTION"
  | "CONTENT"
  | "PAYMENT"
  | "OTHER";

/** Prisma `FeedbackStatus`, declared in triage order. */
export type FeedbackStatus = "NEW" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";

/**
 * Iteration order for filter dropdowns and summary cards. These exist so a
 * page never hand-writes the list of enum members (and so adding a member is
 * one edit here, in the same file as the union it mirrors).
 */
export const CLIENT_PLATFORMS = ["WEB", "MOBILE", "UNKNOWN"] as const;
export const COMMENT_STATUSES = ["VISIBLE", "HIDDEN"] as const;
export const FEEDBACK_CATEGORIES = [
  "BUG",
  "SUGGESTION",
  "CONTENT",
  "PAYMENT",
  "OTHER",
] as const;
/** Triage order — the order a status filter should offer them in. */
export const FEEDBACK_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "RESOLVED",
  "DISMISSED",
] as const;

// ------------------------------------------------------- shared row pieces

/** The account a tracked row belongs to, as every Tracking table renders it. */
export interface TrackedUser {
  id: string;
  /** The login identity — always present, machine-generated for phone signups. */
  username: string;
  /** What they chose to be called; null when they never set one. */
  displayName: string | null;
  /** Masked unless the caller holds `TRACKING.PII_VIEW`; null when the account has none. */
  phone: string | null;
}

export type TrackedTitleKind = "MOVIE" | "SERIES" | "BOOK";

/** The movie, series or book a comment is attached to. */
export interface TrackedTitle {
  id: string;
  kind: TrackedTitleKind;
  name: string;
}

/** The staff member who last triaged a feedback row. */
export interface FeedbackHandler {
  id: string;
  username: string;
  displayName: string | null;
}

// ------------------------------------------------------------- comments

/** One row of `GET /tracking/comments`. */
export interface TrackedComment {
  id: string;
  body: string;
  status: CommentStatus;
  platform: ClientPlatform;
  /** ISO timestamp, server-side. */
  createdAt: string;
  /** The thread root's id when this comment is a reply; null when it is a root. */
  parentId: string | null;
  user: TrackedUser;
  /**
   * Null only if the movie/series relation could not be resolved — a comment
   * always belongs to exactly one title.
   */
  title: TrackedTitle | null;
  /** Masked unless the caller holds `TRACKING.PII_VIEW`. */
  ipAddress: string | null;
}

/** What `PATCH /tracking/comments/:id` returns — the moved row, nothing more. */
export interface ModerateCommentResult {
  id: string;
  status: CommentStatus;
}

// ------------------------------------------------------------- feedback

/** One row of `GET /tracking/feedback`, and what `PATCH .../:id` returns. */
export interface TrackedFeedback {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  platform: ClientPlatform;
  createdAt: string;
  updatedAt: string;
  user: TrackedUser;
  /** Null while the row is still untouched (status NEW, never triaged). */
  handledBy: FeedbackHandler | null;
  handledAt: string | null;
  /** Internal triage note — never shown to the submitter. */
  adminNote: string | null;
  /** Masked unless the caller holds `TRACKING.PII_VIEW`. */
  ipAddress: string | null;
}

// ---------------------------------------------------------- active users

/** One row of `GET /tracking/active-users` — one row per USER, never per device. */
export interface ActiveUser {
  user: TrackedUser;
  /** The platform their most recent signal came from — what a single-value column shows. */
  platform: ClientPlatform;
  /** Every platform they are present on right now; web AND mobile is still one user. */
  platforms: ClientPlatform[];
  /** True while at least one live socket is open for them. */
  online: boolean;
  lastActivity: string;
  /** Masked unless the caller holds `TRACKING.PII_VIEW`. */
  ipAddress: string | null;
}

/**
 * The three summary cards. These describe the FULL active set — the server
 * does not narrow them when `platform` filters the rows, so the cards must
 * not be recomputed from `items`, which is one page of a filtered list.
 *
 * `web + mobile` can exceed `total`: a user on both is counted in each
 * platform but once in `total`.
 */
export interface ActiveUsersSummary {
  total: number;
  web: number;
  mobile: number;
}

/** `GET /tracking/active-users` — a page plus its always-unfiltered summary. */
export type ActiveUsersResponse = PaginatedResponse<ActiveUser> & {
  summary: ActiveUsersSummary;
};

// ------------------------------------------------------------ watch time

/** Seconds watched, split by the platform they were watched on. */
export interface PlatformSplit {
  web: number;
  mobile: number;
  unknown: number;
  /** web + mobile + unknown. */
  total: number;
}

/** One of 24 buckets, `hour` 0–23 in the SERVER's timezone. */
export type WatchTimeHourBucket = PlatformSplit & { hour: number };

/** One of 7 buckets, `weekday` 0–6 where **0 is Sunday** (`Date#getDay`). */
export type WatchTimeWeekdayBucket = PlatformSplit & { weekday: number };

/** One cell of the 7x24 grid. Always all 168, zeros included. */
export interface WatchTimeHeatmapCell {
  weekday: number;
  hour: number;
  seconds: number;
}

/** The single busiest cell. */
export interface WatchTimePeak {
  hour: number;
  weekday: number;
  seconds: number;
}

export type WatchTimeTotals = PlatformSplit & { heartbeats: number };

/**
 * `GET /tracking/watch-time` — WHEN people watch, never which titles.
 *
 * Both arrays are always full length (24 and 7) and the heatmap always holds
 * all 168 cells, so a page can index them positionally without guarding for
 * gaps. Empty windows come back as zeros with `peak: null` — that null is the
 * signal to render "no data yet" rather than a fabricated peak.
 *
 * Buckets are in the **backend server's local timezone**, not the browser's
 * and not UTC. Do not re-bucket these client-side.
 */
export interface WatchTimeReport {
  byHour: WatchTimeHourBucket[];
  byWeekday: WatchTimeWeekdayBucket[];
  heatmap: WatchTimeHeatmapCell[];
  peak: WatchTimePeak | null;
  totals: WatchTimeTotals;
}

// -------------------------------------------------------------- searches

/**
 * One row of `GET /tracking/searches` — TEXT USERS TYPED, grouped by its
 * normalised form. Not a watched title.
 */
export interface TopSearchTerm {
  /** The most common raw spelling actually typed, e.g. "Avengers". */
  term: string;
  /** The grouping key: trimmed, lowercased, inner spaces collapsed. */
  normalizedTerm: string;
  count: number;
  /**
   * Mean `resultCount` across the group, rounded to 2dp. A value near 0 is
   * the interesting case: demand the catalogue does not answer.
   */
  avgResults: number;
  lastSearchedAt: string | null;
  /** Every platform this term was searched from. */
  platforms: ClientPlatform[];
}

/** One row of `GET /tracking/searches/recent` — the raw log, newest first. */
export interface RecentSearch {
  id: string;
  term: string;
  normalizedTerm: string;
  /** How many results that search returned at the time it was made. */
  resultCount: number;
  platform: ClientPlatform;
  createdAt: string;
  /** Null for a signed-out search. */
  user: TrackedUser | null;
  /** Masked unless the caller holds `TRACKING.PII_VIEW`. */
  ipAddress: string | null;
}

// -------------------------------------------------------------- sessions

/** One row of `GET /tracking/sessions` — one row per user, their newest session. */
export interface UserSessionSummary {
  user: TrackedUser;
  /** From their most recent session. Masked unless the caller holds `TRACKING.PII_VIEW`. */
  ipAddress: string | null;
  platform: ClientPlatform;
  lastActive: string | null;
  sessionCount: number;
  /** That IP is used by more than one account — the reason this view exists. */
  sharedIp: boolean;
  /** That phone is on more than one account. Never expected; flagged if it ever happens. */
  sharedPhone: boolean;
}

/** One row of `GET /tracking/sessions/:userId` — that user's own session list. */
export interface UserSessionEntry {
  id: string;
  platform: ClientPlatform;
  /** Masked unless the caller holds `TRACKING.PII_VIEW`. */
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  /** Null while the session is still open. */
  endedAt: string | null;
}

// ----------------------------------------------------------------- queries

/**
 * The filter triple every Tracking report shares.
 *
 * `from`/`to` are calendar dates (`YYYY-MM-DD`, what `DateRangeFilter` emits)
 * or full ISO date-times. A date-only `to` covers the WHOLE of that day —
 * the backend expands it, so there is no off-by-one to compensate for here.
 * An empty string is not a valid date: pass `undefined` for "unbounded".
 */
export interface TrackingRangeParams {
  from?: string;
  to?: string;
  platform?: ClientPlatform;
}

/** Date window + platform + the house `page`/`limit` pair. */
export interface TrackingPagedRangeParams
  extends PaginationParams,
    TrackingRangeParams {}

export interface TrackingCommentsQuery extends TrackingPagedRangeParams {
  /** Matched against the comment body AND the commenter's username / display name / phone. */
  search?: string;
  /** Omitted returns both visible and hidden, so moderation stays reviewable. */
  status?: CommentStatus;
}

export interface TrackingFeedbackQuery extends TrackingPagedRangeParams {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  /** Message text, or the submitter's username / display name / phone. */
  search?: string;
}

/**
 * No date window: "active" is defined by the server's 5-minute presence
 * window, not by a range an operator picks.
 */
export interface ActiveUsersQuery extends PaginationParams {
  platform?: ClientPlatform;
}

/**
 * Watch-time takes NO pagination — the response is a fixed 24x7 grid.
 * The backend rejects unknown query props outright, so sending `page` or
 * `limit` here is a 400, not a harmless extra.
 */
export type WatchTimeQuery = TrackingRangeParams;

export interface TrackingSearchesQuery extends TrackingPagedRangeParams {
  /** Filters the SEARCHED TEXT, normalised the same way the stored terms are. */
  search?: string;
}

export interface TrackingSessionsQuery extends TrackingPagedRangeParams {
  /** Username, display name or phone. */
  search?: string;
  /**
   * Exact-ish phone / IP filters, kept separate from `search` so "who else is
   * on this address" cannot also match a username. Filtering by either does
   * NOT require `TRACKING.PII_VIEW` — the permission governs what is read
   * back in full, and you already know the value you typed.
   */
  phone?: string;
  ip?: string;
}

// ---------------------------------------------------------------- payloads

export interface UpdateFeedbackStatusPayload {
  status: FeedbackStatus;
  /**
   * Omit to leave any existing note untouched; send `""` to clear it.
   * Max 2000 characters.
   */
  adminNote?: string;
}
