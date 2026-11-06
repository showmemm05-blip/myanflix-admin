/**
 * Wire types for the "Advertisements" admin pages (2026-11-03) — the staff
 * side of `backend/src/ads` (GET/POST/PATCH/DELETE /ads/admin,
 * POST /ads/admin/:id/video/attach, POST /ads/admin/:id/image,
 * GET /ads/admin/analytics/*).
 *
 * An ad is either a short MP4 (VIDEO) that plays before a movie starts
 * and/or at the breaks during it, or a small picture (CORNER) shown in the
 * player's top-right corner while the movie plays (2026-11-04,
 * docs/in-movie-ads-2026-11-04/CONTRACT.md). The backend decides which ad a
 * viewer gets; the admin only describes the ads (video or picture, text,
 * schedule, which movies, delivery rules) and reads the counts back.
 *
 * Timestamps are ISO strings (JSON), never `Date`. Anything nullable on the
 * backend view is nullable here.
 */
import type { PaginationParams } from "@/types/api";

/** Whether the ad can play right now, and if not, why. */
export const AD_LIVE_STATES = ["LIVE", "SCHEDULED", "ENDED", "OFF", "NO_VIDEO"] as const;
export type AdLiveState = (typeof AD_LIVE_STATES)[number];

/** Which movies the ad plays with: every movie (episodes included) or a chosen list. */
export const AD_TARGET_TYPES = ["ALL", "SELECTED"] as const;
export type AdTargetType = (typeof AD_TARGET_TYPES)[number];

/** What the ad is: an MP4 (before the movie / at breaks) or a corner picture. Chosen on create, fixed afterwards. */
export const AD_FORMATS = ["VIDEO", "CORNER"] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

/** Where one play happened — the analytics filter (a VIDEO ad can have PREROLL and MIDROLL plays). */
export const AD_PLACEMENTS = ["PREROLL", "MIDROLL", "CORNER"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

/** Who gets the breaks and the corner ads. The ad before the movie plays for everyone either way. */
export const AD_AUDIENCES = ["ALL", "NON_PREMIUM"] as const;
export type AdAudience = (typeof AD_AUDIENCES)[number];

/**
 * Field limits — the backend's AD_LIMITS, copied so the form can stop a
 * wrong value before the request instead of after it.
 */
export const AD_LIMITS = {
  title: 120,
  description: 1000,
  movies: 500,
  priority: { min: 0, max: 1000 },
  skipAfterSeconds: { min: 1, max: 600 },
  frequencyLimitMinutes: { min: 1, max: 10080 },
  maxImpressionsPerUserPerDay: { min: 1, max: 100 },
  /** The corner picture's optional link, in characters. */
  linkUrl: 500,
  /** How long one showing of a corner picture lasts; null (not in range) = until the viewer closes it. */
  cornerShowSeconds: { min: 3, max: 600 },
  /** Watched minutes before a corner picture comes back; null = only once. Must be longer than the showing. */
  cornerRepeatMinutes: { min: 1, max: 240 },
} as const;

/** The most bytes a corner picture may have (413 AD_IMAGE_TOO_LARGE past it). */
export const AD_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

/** A GIF heavier than this still uploads, but the form warns that it is slow on phones. */
export const AD_IMAGE_GIF_WARN_BYTES = 1024 * 1024;

/** The picture types the image route takes (it checks the bytes, not the name). */
export const AD_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/** The backend's shape check (400 AD_IMAGE_SHAPE_INVALID): each side at least this many pixels… */
export const AD_IMAGE_MIN_SIDE = 16;
/** …and the long side at most this many times the short one. */
export const AD_IMAGE_MAX_ASPECT = 8;

/**
 * The corner picture's first showing comes after this many seconds of
 * watching. The players take the number from each session (the backend's
 * constant); the admin only uses it to describe the timing.
 */
export const CORNER_FIRST_SHOW_AFTER_SECONDS = 60;

/** The most bytes an ad video may have (backend UPLOAD_MAX_AD_VIDEO_BYTES, 200 MB). */
export const AD_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

/** How long an ad video may run, in seconds — the backend's ffprobe check. */
export const AD_VIDEO_MIN_SECONDS = 1;
export const AD_VIDEO_MAX_SECONDS = 600;

/**
 * Every ad is scheduled in Myanmar time (UTC+6:30). The backend stores an
 * offset per ad, but the admin never offers another one: this value is sent
 * with every create and shown as a fixed label in the form.
 */
export const AD_TZ_OFFSET_MINUTES = 390;

/** The backend refuses an analytics span over this many days (400 AD_ANALYTICS_RANGE_TOO_LONG). */
export const AD_ANALYTICS_MAX_RANGE_DAYS = 366;

export interface AdStaffRef {
  id: string;
  username: string;
}

/**
 * The one "Playback rules" row (GET/PUT /ads/admin/settings): the master
 * switch; the break interval in movie minutes (0 = no breaks); who gets the
 * breaks and the corner ads. The ad before the movie plays on every open. Mirrors the backend's AD_SETTINGS_LIMITS.
 */
export const AD_SETTINGS_LIMITS = {
  /** When breaks are on; 0 (off) sits outside this range on purpose. */
  midrollIntervalMinutes: { min: 1, max: 240 },
} as const;

/** The break intervals offered as one tap; anything else in range is "Custom". */
export const MIDROLL_INTERVAL_PRESETS = [15, 30, 45, 60] as const;

/** No break when it would fall within this many seconds of the end — the backend sends the same 120 to the players. */
export const MIDROLL_END_GUARD_SECONDS = 120;

export interface AdSettings {
  /** Off = no ads of any kind, anywhere. */
  adsEnabled: boolean;
  /** 0 = no breaks; else a break every N minutes of movie time. */
  midrollIntervalMinutes: number;
  duringMovieAudience: AdAudience;
  /** null until the first save (the backend default is in use). */
  updatedAt: string | null;
  updatedBy: (AdStaffRef & { displayName: string | null }) | null;
  /** How many ads are live right now for each slot — for the card's warnings. */
  liveCounts: { preroll: number; breaks: number; corner: number };
}

/** The whole row, replaced: every field is required (a forgotten one would be reset). */
export type UpdateAdSettingsInput = Pick<
  AdSettings,
  "adsEnabled" | "midrollIntervalMinutes" | "duringMovieAudience"
>;

/** One chosen movie as the staff list shows it — deleted and hidden titles included. */

export interface AdTargetMovie {
  id: string;
  /** Null when the movie no longer exists. */
  title: string | null;
  imageUrl: string | null;
  /** False when the apps would not show it (not published / deleted). */
  isVisible: boolean;
  missing: boolean;
}

/** All-time counts of this ad's plays, from the playback rows. */
export interface AdCounters {
  /** Plays that started (a video's first frame, or a corner picture first seen in a viewing). */
  impressions: number;
  completions: number;
  skips: number;
  /** CORNER: showings (first ones and every come-back). */
  shows: number;
  /** CORNER: taps on the link. */
  clicks: number;
  /** CORNER: closed with the ✕. */
  closes: number;
}

export interface Ad {
  id: string;
  /** Fixed on create. */
  format: AdFormat;
  title: string;
  description: string | null;
  isActive: boolean;
  /** NO_VIDEO also stands for a corner ad without its picture. */
  liveState: AdLiveState;
  /** VIDEO: a signed URL, fresh on every request and good for 4 hours; null until a video is attached. */
  videoUrl: string | null;
  durationSeconds: number | null;
  videoBytes: number | null;
  /** VIDEO: the slots it plays in (both false for CORNER). */
  playsBeforeMovie: boolean;
  playsAtBreaks: boolean;
  /** CORNER: the picture's public URL, null until one is uploaded; the size fields go with it. */
  imageUrl: string | null;
  imageBytes: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  /** CORNER: an http(s) page a tap opens, or null. */
  linkUrl: string | null;
  /** CORNER: seconds per showing; null = until the viewer closes it. */
  cornerShowSeconds: number | null;
  /** CORNER: watched minutes before it comes back; null = only once. */
  cornerRepeatMinutes: number | null;
  /** CORNER: the ✕ shows (always true when it stays until closed). */
  cornerClosable: boolean;
  targetType: AdTargetType;
  /** The chosen movies (empty for ALL). */
  targetMovies: AdTargetMovie[];
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  /** "HH:mm" in the ad's own offset; an end before the start runs past midnight. */
  dailyStartTime: string | null;
  dailyEndTime: string | null;
  tzOffsetMinutes: number;
  isSkippable: boolean;
  skipAfterSeconds: number | null;
  /** Minimum minutes between two plays of THIS ad for one viewer. */
  frequencyLimitMinutes: number | null;
  maxImpressionsPerUserPerDay: number | null;
  counters: AdCounters;
  createdBy: AdStaffRef | null;
  createdAt: string;
  updatedAt: string;
}

/** The editable fields every ad has. */
export interface AdCommonFields {
  title: string;
  description: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  dailyStartTime: string | null;
  dailyEndTime: string | null;
  tzOffsetMinutes: number;
  targetType: AdTargetType;
  movieIds: string[];
  priority: number;
  frequencyLimitMinutes: number | null;
  maxImpressionsPerUserPerDay: number | null;
}

/** VIDEO only — sent for a corner ad they are refused (400 AD_FORMAT_MISMATCH). At least one slot. */
export interface AdVideoFields {
  isSkippable: boolean;
  skipAfterSeconds: number | null;
  playsBeforeMovie: boolean;
  playsAtBreaks: boolean;
}

/** CORNER only — sent for a video ad they are refused. The picture itself comes from the image route. */
export interface AdCornerFields {
  linkUrl: string | null;
  cornerShowSeconds: number | null;
  cornerRepeatMinutes: number | null;
  cornerClosable: boolean;
}

/**
 * The editable fields. On create `title` and `targetType` are required; on
 * update every field is optional (absent = keep, null = clear). Only the
 * ad's own format's fields may ride along.
 */
export type AdFields = AdCommonFields & AdVideoFields & AdCornerFields;

/** `format` only here: a PATCH carrying it is a 400. Absent = VIDEO. */
export type CreateAdInput = Pick<AdFields, "title" | "targetType"> & Partial<AdFields> & { format?: AdFormat };
export type UpdateAdInput = Partial<AdFields>;

/**
 * `POST /ads/admin/:id/video/attach` — the staged file to verify and keep.
 * The skip fields ride along so the backend checks skip-after against the
 * NEW video's length in the same transaction that stores it: sent in a
 * later PATCH, a lowered skip-after could never reach a server that still
 * refused the attach against the old value.
 */
export interface AttachAdVideoInput {
  relativePath: string;
  isSkippable?: boolean;
  skipAfterSeconds?: number | null;
}

/**
 * Exactly the backend DTO's keys. The backend rejects unknown query params
 * with a 400, so nothing else may ride along on this object.
 */
export interface AdQuery extends PaginationParams {
  /** Matches the title (ILIKE). */
  search?: string;
  /** The computed live state. */
  status?: AdLiveState;
  format?: AdFormat;
}

/** The `code` values the backend sends with a refused ad change. */
export type AdErrorCode =
  | "AD_NOT_FOUND"
  | "AD_TITLE_REQUIRED"
  | "AD_WINDOW_INVALID"
  | "AD_DAILY_WINDOW_INVALID"
  | "AD_TARGET_MOVIES_REQUIRED"
  | "AD_TARGET_MOVIE_NOT_FOUND"
  | "AD_SKIP_AFTER_REQUIRED"
  | "AD_SKIP_AFTER_TOO_LONG"
  | "AD_VIDEO_REQUIRED"
  | "AD_VIDEO_MISSING"
  | "AD_VIDEO_NOT_MP4"
  | "AD_VIDEO_TOO_LARGE"
  | "AD_VIDEO_TOO_LONG"
  | "AD_VIDEO_UNREADABLE"
  | "AD_VIDEO_ATTACH_CONFLICT"
  | "AD_FORMAT_MISMATCH"
  | "AD_SLOTS_REQUIRED"
  | "AD_IMAGE_REQUIRED"
  | "AD_IMAGE_TOO_LARGE"
  | "AD_IMAGE_UNSUPPORTED"
  | "AD_IMAGE_SHAPE_INVALID"
  | "AD_CORNER_TIMING_INVALID"
  | "AD_LINK_INVALID"
  | "AD_ANALYTICS_RANGE_INVALID"
  | "AD_ANALYTICS_RANGE_TOO_LONG";

// ------------------------------------------------------------- analytics

/**
 * The query every analytics endpoint takes: two Myanmar calendar dates
 * (YYYY-MM-DD, inclusive; both or neither — absent = the last 7 full days),
 * where supported one ad, and one placement (absent = all of them).
 */
export interface AdAnalyticsQuery {
  from?: string;
  to?: string;
  adId?: string;
  placement?: AdPlacement;
}

export interface AdAnalyticsRange {
  from: string;
  to: string;
  /** The same number of days immediately before `from`. */
  previousFrom: string;
  previousTo: string;
}

/** The totals of one period — the current one and the comparison one share the shape. */
export interface AdAnalyticsTotals {
  /** Every started play: videos before the movie and at breaks, and corner pictures (one per viewing). */
  impressions: number;
  /** Before the movie + at breaks only — the base of the video cards and rates. */
  videoImpressions: number;
  completions: number;
  /** Video skips only — a closed corner picture is a `close`. */
  skips: number;
  /** Plays that stopped partway: the video or picture failed AFTER its first frame (shown as "stopped partway"). */
  failures: number;
  /**
   * Ads that failed BEFORE their first frame — a video or a corner picture
   * that would not load — counted by `failedAt` in the period (shown as
   * "failed to load"). Never an impression, so no rate is built on it.
   */
  loadFailures: number;
  /** COUNT(DISTINCT userId) over the period's started plays. */
  viewers: number;
  /** completions / videoImpressions, 0–1 (0 when nothing played). */
  completionRate: number;
  /** skips / videoImpressions, 0–1. */
  skipRate: number;
  /** Corner showings: first ones and every come-back. */
  shows: number;
  /** Corner link taps. */
  clicks: number;
  /** Corner pictures closed with the ✕. */
  closes: number;
  /** clicks / corner impressions, 0–1. */
  tapRate: number;
  /** closes / corner impressions, 0–1. */
  closeRate: number;
  byPlatform: {
    web: number;
    mobile: number;
  };
  /** Impressions per placement. */
  byPlacement: {
    preroll: number;
    midroll: number;
    corner: number;
  };
}

/** GET /ads/admin/analytics/overview */
export interface AdAnalyticsOverview {
  range: AdAnalyticsRange;
  current: AdAnalyticsTotals;
  previous: AdAnalyticsTotals;
}

/** One row of GET /ads/admin/analytics/ads — every ad, zero rows included. */
export interface AdAnalyticsAdRow {
  id: string;
  title: string;
  format: AdFormat;
  liveState: AdLiveState;
  impressions: number;
  completions: number;
  skips: number;
  completionRate: number;
  /** CORNER rows; 0 for video ads. */
  shows: number;
  clicks: number;
  closes: number;
}

export interface AdAnalyticsAds {
  items: AdAnalyticsAdRow[];
}

/** One Myanmar calendar day of GET /ads/admin/analytics/by-date; every day in the range, zero-filled. */
export interface AdAnalyticsDateBucket {
  /** "YYYY-MM-DD" */
  key: string;
  impressions: number;
  completions: number;
  skips: number;
  /** Corner link taps. */
  clicks: number;
  /** Corner pictures closed. */
  closes: number;
}

export interface AdAnalyticsByDate {
  buckets: AdAnalyticsDateBucket[];
}
