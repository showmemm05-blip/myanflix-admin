/**
 * Whether an ad can reach viewers right now, and if not, why — the list's
 * visible status and the "Will it show?" checker (2026-11-04,
 * docs/ads-admin-ux-2026-11-04/SPEC.md §1).
 *
 * The backend's own `liveState` (ads-admin.service.ts `adLiveStateOf`:
 * NO_VIDEO → OFF → ENDED → SCHEDULED → LIVE) ignores four things that stop
 * an ad all the same: the master switch, "ad breaks off" for an ad that only
 * plays at breaks, the ad's hours of the day, and chosen movies of which not
 * one is left to watch. The decision service (ad-decision.service.ts) applies
 * all of them on every open — `rules.adsEnabled` first, then `candidates()`
 * (on, its video or picture, inside its dates, aimed at the title,
 * `inDailyWindow`), then the slot (`midrollIntervalMinutes` > 0 for breaks).
 * This file reads the same rules on the admin side, so a badge never says
 * "Showing" for an ad no viewer can get.
 *
 * Data only, no words: adWords.ts and the copy modules turn these codes into
 * sentences. Pure and with type imports only, so Node's test runner loads it
 * as it is (adHealth.test.ts) — every constant it needs is copied below with
 * the name of its source.
 */
import type { StatusTone } from "@/components/shared/StatusBadge";
import type { Ad, AdFormat, AdLiveState, AdPlacement, AdSettings } from "@/types/ad";
import type { AdStepId } from "./adSteps";

/** No break and no corner picture this close to the end — backend BREAK_END_GUARD_SECONDS, userwebsite corner.ts CORNER_END_GUARD_SECONDS. */
const END_GUARD_SECONDS = 120;
/** The corner picture first shows after this much real watching — backend CORNER_FIRST_SHOW_AFTER_SECONDS. */
const CORNER_FIRST_SHOW_AFTER_SECONDS = 60;
/** A played break stays done for one viewer and movie this long — backend BREAK_MEMORY_MS (12 h). */
const BREAK_MEMORY_HOURS = 12;
/**
 * How much longer than the first break (or than the corner's 1 minute + the
 * 2-minute end guard) a movie should be to test an ad with: a few minutes of
 * room, so neither the end guard nor a slow start hides it (SPEC §1 "How to
 * test it yourself": 5 min, or the break interval + 5 min).
 */
export const TEST_MOVIE_EXTRA_MINUTES = 5;

const MINUTES_PER_DAY = 24 * 60;

type NoParams = Record<string, never>;

/**
 * The visible status of one ad, in the order the checks run (the first that
 * matches wins). NEEDS_MEDIA = "Needs a video / a picture", ALL_ADS_OFF and
 * BREAKS_OFF = "Paused by settings", STARTS_LATER = "Starts later",
 * NO_MOVIES = "No movie to show in".
 */
export const AD_SHOW_STATES = [
  "NEEDS_MEDIA",
  "OFF",
  "ENDED",
  "STARTS_LATER",
  "NO_MOVIES",
  "ALL_ADS_OFF",
  "BREAKS_OFF",
  "OUTSIDE_HOURS",
  "SHOWING",
] as const;
export type AdShowState = (typeof AD_SHOW_STATES)[number];

/**
 * One hue per status (the `Statuses` board): green while viewers can get
 * it, blue while it only waits (its hours, its start date), amber where the
 * admin has to act (a missing video or picture, no movie left to show in, a
 * setting that pauses it), grey once it is over or switched off.
 */
export const AD_SHOW_STATE_TONES: Record<AdShowState, StatusTone> = {
  NEEDS_MEDIA: "warning",
  OFF: "neutral",
  ENDED: "neutral",
  STARTS_LATER: "info",
  NO_MOVIES: "warning",
  ALL_ADS_OFF: "warning",
  BREAKS_OFF: "warning",
  OUTSIDE_HOURS: "info",
  SHOWING: "success",
};

/**
 * The backend's `liveState` read as a visible status, for rows that carry
 * nothing else (an Ad results row whose whole ad could not be read). The
 * master switch stops every ad, so it applies here too once the settings
 * are known (the same place in the order as adShowState); the rest needs the
 * whole ad, so this can never say "Outside its hours" or "ad breaks are
 * off" — the caller must not present its "Showing" as checked.
 */
export function showStateOfLiveState(
  liveState: AdLiveState,
  settings: Pick<AdSettings, "adsEnabled"> | null = null,
): AdShowState {
  switch (liveState) {
    case "NO_VIDEO":
      return "NEEDS_MEDIA";
    case "OFF":
      return "OFF";
    case "ENDED":
      return "ENDED";
    case "SCHEDULED":
      return "STARTS_LATER";
    case "LIVE":
      return settings && !settings.adsEnabled ? "ALL_ADS_OFF" : "SHOWING";
  }
}

/** What the status needs to know about the ad. */
export type AdShowStateInput = Pick<
  Ad,
  | "format"
  | "videoUrl"
  | "imageUrl"
  | "isActive"
  | "startsAt"
  | "endsAt"
  | "dailyStartTime"
  | "dailyEndTime"
  | "tzOffsetMinutes"
  | "playsBeforeMovie"
  | "playsAtBreaks"
  | "targetType"
  | "targetMovies"
>;

/** What the status needs to know about the Ad settings (null while they load). */
export type AdShowStateSettings = Pick<AdSettings, "adsEnabled" | "midrollIntervalMinutes">;

/** An ISO instant as milliseconds; null for none (or an unreadable one, which the backend never sends). */
function instantMs(iso: string | null): number | null {
  if (iso === null) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * The video for a video ad, the picture for a corner ad — the backend's
 * NO_VIDEO test (`videoKey` / `imageKey`; the view's URL is null exactly
 * when the key is). The decision also wants a video's length, but the
 * attach stores the length with the key in one write (ad-video.service.ts),
 * so a video without one does not exist.
 */
function hasMedia(ad: Pick<Ad, "format" | "videoUrl" | "imageUrl">): boolean {
  return ad.format === "CORNER" ? ad.imageUrl !== null : ad.videoUrl !== null;
}

/** Past its end date — `endsAt <= now`, as adLiveStateOf and `candidates()` read it. */
function hasEnded(ad: Pick<Ad, "endsAt">, nowMs: number): boolean {
  const end = instantMs(ad.endsAt);
  return end !== null && end <= nowMs;
}

/** Before its start date — `startsAt > now`. */
function startsLater(ad: Pick<Ad, "startsAt">, nowMs: number): boolean {
  const start = instantMs(ad.startsAt);
  return start !== null && start > nowMs;
}

/** A video ad that plays at ad breaks and nowhere else. */
function onlyAtBreaks(ad: Pick<Ad, "format" | "playsBeforeMovie" | "playsAtBreaks">): boolean {
  return ad.format === "VIDEO" && ad.playsAtBreaks && !ad.playsBeforeMovie;
}

/**
 * Aimed at chosen movies, and not one of them can be watched: they were all
 * deleted (the row goes with the movie, so an empty list is the usual case)
 * or none is published. `candidates()` then never picks the ad, because
 * viewers can't open those movies at all (`assertVisible`) — one published
 * movie is enough for it to show.
 */
function noWatchableMovie(ad: Pick<Ad, "targetType" | "targetMovies">): boolean {
  return ad.targetType === "SELECTED" && ad.targetMovies.every((movie) => movie.missing || !movie.isVisible);
}

/** "HH:mm" → minutes after midnight (the backend's `timeOfDayToMinutes`); null for no time or a malformed one. */
export function timeOfDayMinutes(text: string | null): number | null {
  const match = text === null ? null : /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** Minutes after midnight at `nowMs`, read in a fixed UTC offset (0..1439) — ad-eligibility.ts `minuteOfDay`. */
export function minuteOfDay(nowMs: number, tzOffsetMinutes: number): number {
  const now = new Date(nowMs);
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (((utcMinutes + tzOffsetMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** "14:05" — the wall clock at `nowMs` in the ad's own offset (Myanmar time for every ad the admin makes). */
export function clockAt(nowMs: number, tzOffsetMinutes: number): string {
  const minute = minuteOfDay(nowMs, tzOffsetMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/**
 * Inside the ad's hours of the day — ad-eligibility.ts `inDailyWindow`,
 * line for line: both bounds missing = all day; otherwise [start, end) in
 * the ad's own offset, and a start AFTER the end wraps past midnight
 * (22:00–02:00 is 22:00 to midnight and midnight to 02:00, 02:00 itself
 * outside).
 */
export function inDailyWindow(
  ad: Pick<Ad, "dailyStartTime" | "dailyEndTime" | "tzOffsetMinutes">,
  nowMs: number,
): boolean {
  const start = timeOfDayMinutes(ad.dailyStartTime);
  const end = timeOfDayMinutes(ad.dailyEndTime);
  if (start === null || end === null) return true;
  const minute = minuteOfDay(nowMs, ad.tzOffsetMinutes);
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

/**
 * The ad's hours of the day when it has them (both times readable), and
 * whether they run past midnight; null = any time of day.
 */
function dailyHoursOf(
  ad: Pick<Ad, "dailyStartTime" | "dailyEndTime">,
): { start: string; end: string; overnight: boolean } | null {
  const start = timeOfDayMinutes(ad.dailyStartTime);
  const end = timeOfDayMinutes(ad.dailyEndTime);
  if (start === null || end === null || ad.dailyStartTime === null || ad.dailyEndTime === null) return null;
  return { start: ad.dailyStartTime, end: ad.dailyEndTime, overnight: end < start };
}

/**
 * The ad's visible status at `nowMs`. The first four checks are the
 * backend's `adLiveStateOf` in its own order; then chosen movies with none
 * left to show in (the ad's own problem, so before the settings); then the
 * master switch and "ad breaks off" (skipped while the settings are unknown
 * — null), then the hours of the day. "Breaks off" only stops a video ad that
 * plays at breaks and NOT before the movie: one that plays in both still
 * plays before it.
 */
export function adShowState(
  ad: AdShowStateInput,
  settings: AdShowStateSettings | null,
  nowMs: number,
): AdShowState {
  if (!hasMedia(ad)) return "NEEDS_MEDIA";
  if (!ad.isActive) return "OFF";
  if (hasEnded(ad, nowMs)) return "ENDED";
  if (startsLater(ad, nowMs)) return "STARTS_LATER";
  if (noWatchableMovie(ad)) return "NO_MOVIES";
  if (settings && !settings.adsEnabled) return "ALL_ADS_OFF";
  if (settings && onlyAtBreaks(ad) && settings.midrollIntervalMinutes === 0) return "BREAKS_OFF";
  if (!inDailyWindow(ad, nowMs)) return "OUTSIDE_HOURS";
  return "SHOWING";
}

/**
 * "Showing", but the Ad settings were never read (or the whole ad wasn't, for
 * an Ad results row), so the master switch and the breaks went unchecked:
 * the ad itself is ready, which is all that may be said — the checker reads
 * the same case as UNKNOWN, not yes.
 */
export function showingUnchecked(state: AdShowState, settings: AdShowStateSettings | null): boolean {
  return state === "SHOWING" && settings === null;
}

// ------------------------------------------------------------ "Will it show?"

/** What a fix button does: open the Ad settings card, switch the ad on, open the wizard at a step, or add "before the movie". */
export type AdFix =
  | { kind: "OPEN_SETTINGS" }
  | { kind: "TURN_ON" }
  /** `openMore`: the thing to change sits under "More options" on that step, so it opens with the section open. */
  | { kind: "EDIT"; step: AdStepId; openMore?: boolean }
  /** PATCH `playsBeforeMovie: true` — a breaks-only ad then plays before the movie while breaks are off. */
  | { kind: "ALSO_BEFORE_MOVIE" };

/**
 * The "Your settings" checks, each ✓ or ✗ — the same rules as adShowState,
 * one line each. BREAKS is a video ad's "where it plays" against the break
 * interval; a corner picture has none.
 */
export interface AdCheckParams {
  /** The master switch in Ad settings. */
  ALL_ADS: NoParams;
  /** The ad's own switch. */
  AD_SWITCH: NoParams;
  /** Its video (with its length) or its picture (with its size). */
  MEDIA: {
    format: AdFormat;
    durationSeconds: number | null;
    imageWidth: number | null;
    imageHeight: number | null;
  };
  /** Null = no start date: it can show right away. */
  START: { startsAt: string | null };
  /** Null = no end date. */
  END: { endsAt: string | null };
  /** Only for an ad in chosen movies: at least one must exist and be published. `missing` were deleted, `hidden` are not published. */
  MOVIES_OK: { count: number; missing: number; hidden: number };
  /** No hours (start/end null) = any time of day; `now` is the ad's own clock right now. */
  HOURS: { start: string | null; end: string | null; overnight: boolean; now: string };
  /** 0 = ad breaks are off. */
  BREAKS: { playsBeforeMovie: boolean; playsAtBreaks: boolean; intervalMinutes: number };
}
export type AdCheckCode = keyof AdCheckParams;
export type AdCheck = {
  [C in AdCheckCode]: { code: C; ok: boolean; params: AdCheckParams[C]; fixes: AdFix[] };
}[AdCheckCode];

/**
 * The notes. Info about this ad's own choices (MOVIES, AUDIENCE, WAIT,
 * PER_DAY, SHARING — shown under the checks, only when they apply), and the
 * rules that depend on the viewer and the movie (the rest).
 */
export interface AdNoteParams {
  /** Only in the chosen movies — never in other movies or series episodes. `missing` were deleted, `hidden` are not published. */
  MOVIES: { count: number; missing: number; hidden: number };
  /** "Only people without Premium" get ad breaks and corner pictures; the ad before the movie still plays for everyone. */
  AUDIENCE: { format: AdFormat; playsBeforeMovie: boolean };
  /** "Make each viewer wait before seeing it again", in minutes. Test views count too. */
  WAIT: { minutes: number };
  /** "Limit how many times one viewer sees it in a day"; for a corner picture each movie it appears in counts once. */
  PER_DAY: { times: number; format: AdFormat };
  /** Other live ads in the same places — they take turns unless one has a higher "goes first" number. */
  SHARING: { slots: { slot: AdPlacement; others: number }[]; priority: number };
  /** Each break plays once per viewer per movie for this long. */
  BREAK_MEMORY: { hours: number };
  /** No ads in the last minutes; a movie needs `minMovieMinutes` (interval + guard) for even one break — null while the interval is unknown. */
  LAST_MINUTES: { guardMinutes: number; intervalMinutes: number | null; minMovieMinutes: number | null };
  /** Skipping forward past several breaks plays just one ad. */
  JUMP: NoParams;
  /** First after this much real watching (skipping doesn't count); movies this long or shorter never show it. */
  CORNER_FIRST: { afterMinutes: number; neverUpToMinutes: number };
  /** Hidden while paused or loading, during video ads, in the last minutes, and on phones while the play buttons are up. */
  CORNER_HIDES: { guardMinutes: number };
  /** ✕ hides it for the rest of that viewing (readViewerState: only the last 10 minutes' corner row speaks for a viewing). */
  CORNER_CLOSE: NoParams;
  /** Most changes reach viewers the next time they open a movie; turning an ad or breaks off also applies to the breaks still to come. */
  NEXT_OPEN: NoParams;
}
export type AdNoteCode = keyof AdNoteParams;
export type AdNote = { [C in AdNoteCode]: { code: C; params: AdNoteParams[C] } }[AdNoteCode];

/** Yes, it can show now · no, something to fix · not known yet (the Ad settings are still loading). */
export type AdVerdict = "CAN_SHOW" | "NOT_NOW" | "UNKNOWN";

/** "How to test it yourself", as data. */
export interface AdTestPlan {
  /** Fix this many things first (the failing checks); 0 = nothing. */
  fixFirst: number;
  /** "Open any movie — the ad plays before it starts": it only plays before the movie (or breaks are off). */
  anyMovie: boolean;
  /** Sign in with an account that has no Premium (breaks / corner for people without Premium, or the settings still unknown). */
  needsNonPremium: boolean;
  /** Open a movie longer than this many minutes; null with `anyMovie`, or for a break test while the interval is unknown or breaks are off. */
  movieLongerThanMinutes: number | null;
  /** One not watched in the last this-many hours (the break memory); null when it does not play at breaks. */
  notWatchedWithinHours: number | null;
  /** Between these times (its hours of the day); null = any time. */
  hours: { start: string; end: string } | null;
  /** One of its N chosen movies; null = any movie. */
  chosenMovies: number | null;
  /** Watch without skipping forward (breaks and the corner count real watching). */
  noSkipping: boolean;
}

export interface AdDiagnosis {
  verdict: AdVerdict;
  /** The list's status for the same moment. */
  state: AdShowState;
  /** How many checks fail — "2 things to fix". */
  problems: number;
  checks: AdCheck[];
  infoNotes: AdNote[];
  viewerNotes: AdNote[];
  /**
   * The note to single out as "most likely reason you didn't see it" when
   * the ad CAN show (the owner's case: it had played, but each break plays
   * once per viewer per movie for 12 hours). Always one of the notes, or null.
   */
  likelyReason: AdNoteCode | null;
  /** Times it has started playing (a corner picture: viewings it appeared in), all time. */
  played: number;
  test: AdTestPlan;
}

/** How many movies an ad is aimed at, and how many of them are out of reach. */
function moviesCountOf(ad: Pick<Ad, "targetMovies">): AdCheckParams["MOVIES_OK"] {
  return {
    count: ad.targetMovies.length,
    missing: ad.targetMovies.filter((movie) => movie.missing).length,
    hidden: ad.targetMovies.filter((movie) => !movie.missing && !movie.isVisible).length,
  };
}

/** The checks, in the checker's order: Ad settings, the ad's switch, its media, its dates, its chosen movies, its hours, where it plays. */
function checksOf(ad: Ad, settings: AdSettings | null, nowMs: number): AdCheck[] {
  const checks: AdCheck[] = [];
  const media = hasMedia(ad);
  if (settings) {
    checks.push({
      code: "ALL_ADS",
      ok: settings.adsEnabled,
      params: {},
      fixes: settings.adsEnabled ? [] : [{ kind: "OPEN_SETTINGS" }],
    });
  }
  // Switching on needs the video or picture first (the backend refuses it
  // without): then the MEDIA line carries the fix.
  checks.push({
    code: "AD_SWITCH",
    ok: ad.isActive,
    params: {},
    fixes: ad.isActive || !media ? [] : [{ kind: "TURN_ON" }],
  });
  checks.push({
    code: "MEDIA",
    ok: media,
    params: {
      format: ad.format,
      durationSeconds: ad.durationSeconds,
      imageWidth: ad.imageWidth,
      imageHeight: ad.imageHeight,
    },
    fixes: media ? [] : [{ kind: "EDIT", step: "media" }],
  });
  const started = !startsLater(ad, nowMs);
  checks.push({
    code: "START",
    ok: started,
    params: { startsAt: ad.startsAt },
    fixes: started ? [] : [{ kind: "EDIT", step: "when" }],
  });
  const ended = hasEnded(ad, nowMs);
  checks.push({
    code: "END",
    ok: !ended,
    params: { endsAt: ad.endsAt },
    fixes: ended ? [{ kind: "EDIT", step: "when" }] : [],
  });
  if (ad.targetType === "SELECTED") {
    const watchable = !noWatchableMovie(ad);
    checks.push({
      code: "MOVIES_OK",
      ok: watchable,
      params: moviesCountOf(ad),
      fixes: watchable ? [] : [{ kind: "EDIT", step: "movies" }],
    });
  }
  const inHours = inDailyWindow(ad, nowMs);
  const hours = dailyHoursOf(ad);
  checks.push({
    code: "HOURS",
    ok: inHours,
    params: {
      start: hours?.start ?? null,
      end: hours?.end ?? null,
      overnight: hours?.overnight ?? false,
      now: clockAt(nowMs, ad.tzOffsetMinutes),
    },
    // The hours sit under More options on the "When" step, so that opens too.
    fixes: inHours ? [] : [{ kind: "EDIT", step: "when", openMore: true }],
  });
  if (settings && ad.format === "VIDEO") {
    const blocked = onlyAtBreaks(ad) && settings.midrollIntervalMinutes === 0;
    checks.push({
      code: "BREAKS",
      ok: !blocked,
      params: {
        playsBeforeMovie: ad.playsBeforeMovie,
        playsAtBreaks: ad.playsAtBreaks,
        intervalMinutes: settings.midrollIntervalMinutes,
      },
      fixes: blocked ? [{ kind: "OPEN_SETTINGS" }, { kind: "ALSO_BEFORE_MOVIE" }] : [],
    });
  }
  return checks;
}

/** A video ad whose breaks can happen: it plays at breaks and they are not known to be off. */
function breaksMatter(ad: Ad, settings: AdSettings | null): boolean {
  return ad.format === "VIDEO" && ad.playsAtBreaks && (settings === null || settings.midrollIntervalMinutes > 0);
}

/**
 * Other live ads sharing this ad's places, from `settings.liveCounts`
 * (ad-settings.service.ts `liveCounts`: on, with media, inside the dates —
 * the hours of the day are not applied). This ad is in those counts when it
 * meets the same test, so it is taken out of them.
 */
function sharingOf(ad: Ad, settings: AdSettings, nowMs: number): { slot: AdPlacement; others: number }[] {
  const counted = hasMedia(ad) && ad.isActive && !hasEnded(ad, nowMs) && !startsLater(ad, nowMs);
  const others = (live: number) => Math.max(0, live - (counted ? 1 : 0));
  const slots: { slot: AdPlacement; others: number }[] = [];
  if (ad.format === "CORNER") slots.push({ slot: "CORNER", others: others(settings.liveCounts.corner) });
  else {
    if (ad.playsBeforeMovie) slots.push({ slot: "PREROLL", others: others(settings.liveCounts.preroll) });
    if (breaksMatter(ad, settings)) slots.push({ slot: "MIDROLL", others: others(settings.liveCounts.breaks) });
  }
  return slots.filter((slot) => slot.others > 0);
}

function infoNotesOf(ad: Ad, settings: AdSettings | null, nowMs: number): AdNote[] {
  const notes: AdNote[] = [];
  const corner = ad.format === "CORNER";
  if (ad.targetType === "SELECTED") {
    notes.push({ code: "MOVIES", params: moviesCountOf(ad) });
  }
  if (settings?.duringMovieAudience === "NON_PREMIUM" && (corner || breaksMatter(ad, settings))) {
    notes.push({ code: "AUDIENCE", params: { format: ad.format, playsBeforeMovie: !corner && ad.playsBeforeMovie } });
  }
  if (ad.frequencyLimitMinutes !== null) notes.push({ code: "WAIT", params: { minutes: ad.frequencyLimitMinutes } });
  if (ad.maxImpressionsPerUserPerDay !== null) {
    notes.push({ code: "PER_DAY", params: { times: ad.maxImpressionsPerUserPerDay, format: ad.format } });
  }
  // With ads switched off nothing plays, so nothing is shared.
  if (settings && settings.adsEnabled) {
    const slots = sharingOf(ad, settings, nowMs);
    if (slots.length > 0) notes.push({ code: "SHARING", params: { slots, priority: ad.priority } });
  }
  return notes;
}

function viewerNotesOf(ad: Ad, settings: AdSettings | null): AdNote[] {
  const notes: AdNote[] = [];
  const guardMinutes = END_GUARD_SECONDS / 60;
  if (breaksMatter(ad, settings)) {
    const interval = settings ? settings.midrollIntervalMinutes : null;
    notes.push({ code: "BREAK_MEMORY", params: { hours: BREAK_MEMORY_HOURS } });
    notes.push({
      code: "LAST_MINUTES",
      params: {
        guardMinutes,
        intervalMinutes: interval,
        // breakSchedule.ts: a break at k × interval plays when it is at or
        // before the movie's length minus the guard.
        minMovieMinutes: interval === null ? null : interval + guardMinutes,
      },
    });
    notes.push({ code: "JUMP", params: {} });
  }
  if (ad.format === "CORNER") {
    const afterMinutes = CORNER_FIRST_SHOW_AFTER_SECONDS / 60;
    notes.push({ code: "CORNER_FIRST", params: { afterMinutes, neverUpToMinutes: afterMinutes + guardMinutes } });
    notes.push({ code: "CORNER_HIDES", params: { guardMinutes } });
    if (ad.cornerClosable) notes.push({ code: "CORNER_CLOSE", params: {} });
  }
  notes.push({ code: "NEXT_OPEN", params: {} });
  return notes;
}

/**
 * The likeliest reason an owner who tested it did not see it, among the
 * notes that apply: the 12-hour break memory first (the owner's own case),
 * then the limits he set (his test views count), then Premium, then other
 * ads taking turns, then the corner's minute of real watching.
 */
const LIKELY_REASON_ORDER: AdNoteCode[] = ["BREAK_MEMORY", "PER_DAY", "WAIT", "AUDIENCE", "SHARING", "CORNER_FIRST"];

function testPlanOf(ad: Ad, settings: AdSettings | null, fixFirst: number): AdTestPlan {
  const corner = ad.format === "CORNER";
  // A video ad in both places is tested before the movie while breaks are
  // off; a breaks-only one stays a break test (its fix turns them on).
  const breaks =
    ad.format === "VIDEO" &&
    ad.playsAtBreaks &&
    !(ad.playsBeforeMovie && settings !== null && settings.midrollIntervalMinutes === 0);
  const inMovie = corner || breaks;
  const interval = settings?.midrollIntervalMinutes ?? null;
  const hours = dailyHoursOf(ad);
  return {
    fixFirst,
    anyMovie: !inMovie,
    needsNonPremium: inMovie && settings?.duringMovieAudience !== "ALL",
    // A break test depends on the interval: with it unknown no number is
    // safe (a 10-minute movie never gets a 30-minute break), so the sentence
    // names the rule instead. The same with breaks off (0): the fix turns
    // them on first, at an interval nobody has picked yet.
    movieLongerThanMinutes: !inMovie
      ? null
      : !breaks
        ? TEST_MOVIE_EXTRA_MINUTES
        : !interval
          ? null
          : interval + TEST_MOVIE_EXTRA_MINUTES,
    notWatchedWithinHours: breaks ? BREAK_MEMORY_HOURS : null,
    hours: hours ? { start: hours.start, end: hours.end } : null,
    chosenMovies: ad.targetType === "SELECTED" ? ad.targetMovies.length : null,
    noSkipping: inMovie,
  };
}

/**
 * Everything the "Will it show?" checker says about one ad at `nowMs`:
 * the verdict, the ✓/✗ checks with their fix buttons, the notes, the
 * played count and how to test it. With the settings unknown (null) the two
 * settings checks are left out and a clean result reads UNKNOWN, not yes.
 */
export function diagnoseAd(ad: Ad, settings: AdSettings | null, nowMs: number): AdDiagnosis {
  const checks = checksOf(ad, settings, nowMs);
  const problems = checks.filter((check) => !check.ok).length;
  const infoNotes = infoNotesOf(ad, settings, nowMs);
  const viewerNotes = viewerNotesOf(ad, settings);
  const present = new Set<AdNoteCode>([...infoNotes, ...viewerNotes].map((note) => note.code));
  return {
    verdict: problems > 0 ? "NOT_NOW" : settings === null ? "UNKNOWN" : "CAN_SHOW",
    state: adShowState(ad, settings, nowMs),
    problems,
    checks,
    infoNotes,
    viewerNotes,
    likelyReason: LIKELY_REASON_ORDER.find((code) => present.has(code)) ?? null,
    played: ad.counters.impressions,
    test: testPlanOf(ad, settings, problems),
  };
}
