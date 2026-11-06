/**
 * The ad form's state, its checks and its conversion to the wire — kept
 * apart from the wizard so the rules read as one list. The checks mirror
 * the backend's (ads-admin.service.ts + AD_LIMITS), so a mistake is
 * explained in the form, in the admin's language, before any request; the
 * backend still re-checks everything.
 *
 * One form for both formats (2026-11-04): a VIDEO ad has the video, its
 * slots (before the movie / at breaks) and the skip rule; a CORNER ad has the
 * picture, the link and its timing. The state keeps both sets so switching
 * the type while creating loses nothing, but only the ad's own format's
 * fields ever reach the wire — the backend refuses the others
 * (AD_FORMAT_MISMATCH).
 *
 * Every date and time here is MYANMAR time: the inputs show and take MMT
 * wall-clock values (lib/myanmar-time.ts), the daily window is "HH:mm" in
 * the ad's own offset, and every create sends that offset (390) along.
 *
 * The step-by-step wizard (components/ads/wizard, 2026-11-04) reads the
 * checks as codes (`formIssues`, placed on steps by adSteps.ts), says them
 * with `issueText`, and reads its last step's summary from `reviewSummary`.
 */
import { ApiError } from "@/services/api/apiClient";
import type { TranslationShape } from "@/lib/i18n/translations";
import { fromMmtInputValue, toMmtInputValue } from "@/lib/myanmar-time";
import { formatBytes } from "@/lib/upload/format";
import {
  AD_IMAGE_MAX_ASPECT,
  AD_IMAGE_MAX_BYTES,
  AD_IMAGE_MIME_TYPES,
  AD_IMAGE_MIN_SIDE,
  AD_LIMITS,
  AD_TZ_OFFSET_MINUTES,
  AD_VIDEO_MAX_BYTES,
  AD_VIDEO_MAX_SECONDS,
  AD_VIDEO_MIN_SECONDS,
  type Ad,
  type AdCommonFields,
  type AdCornerFields,
  type AdFields,
  type AdFormat,
  type AdTargetMovie,
  type AdTargetType,
  type AdVideoFields,
} from "@/types/ad";

/** A picture's size in pixels. */
export interface AdImageSize {
  width: number;
  height: number;
}

/** What a new corner ad starts with: on screen for 10 seconds, back every 15 minutes of watching. */
export const CORNER_DEFAULTS = { showSeconds: 10, repeatMinutes: 15 } as const;

/**
 * An http(s) address with a host and no spaces — exactly the backend's rule
 * (and the players' `safeAdLink`; a regex, as the phone app cannot rely on
 * `new URL`), so a link the form lets through is one the server accepts and
 * both players will open. Any host works (an IP, a port, a one-word intranet
 * name); a `user@` part before the host is refused, as it hides where the
 * link really goes.
 */
export const AD_LINK_PATTERN = /^https?:\/\/[^\s/?#@]+(?:[/?#]\S*)?$/i;

export interface AdFormState {
  /** Chosen on create; an edited ad keeps its own (the backend never changes it). */
  format: AdFormat;
  title: string;
  description: string;
  /** `datetime-local` values read as Myanmar time ("YYYY-MM-DDTHH:mm"), "" = not set. */
  startsAt: string;
  endsAt: string;
  /** `type="time"` values ("HH:mm"), "" = not set. Both or neither. */
  dailyStartTime: string;
  dailyEndTime: string;
  targetType: AdTargetType;
  /** The chosen movies, with what the picker needs to show them as chips. */
  movies: AdTargetMovie[];
  /**
   * The number fields are kept as typed: an emptied box stays empty (= not
   * set) instead of silently becoming 0, and a half-typed value is explained
   * rather than coerced.
   */
  priority: string;
  /** VIDEO */
  isSkippable: boolean;
  skipAfterSeconds: string;
  playsBeforeMovie: boolean;
  playsAtBreaks: boolean;
  /** CORNER: "" = no link. */
  linkUrl: string;
  /** "Until the viewer closes it" instead of a number of seconds. */
  cornerUntilClosed: boolean;
  cornerShowSeconds: string;
  /** "Only once" instead of coming back. */
  cornerOnce: boolean;
  cornerRepeatMinutes: string;
  cornerClosable: boolean;
  frequencyLimitMinutes: string;
  maxImpressionsPerUserPerDay: string;
  isActive: boolean;
  /** A picked file that is uploaded on save. */
  videoFile: File | null;
  /** The picked file's length as the browser read it; null while probing or when it could not. */
  videoFileDurationSeconds: number | null;
  /** A picked corner picture, uploaded on save. */
  imageFile: File | null;
  /** The picked picture's size as the browser read it; null while reading, "unreadable" when it could not. */
  imageFileSize: AdImageSize | "unreadable" | null;
}

export function emptyForm(): AdFormState {
  return {
    format: "VIDEO",
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    dailyStartTime: "",
    dailyEndTime: "",
    targetType: "ALL",
    movies: [],
    priority: "0",
    isSkippable: false,
    skipAfterSeconds: "",
    // A new video ad plays in both slots; the backend keeps ads made
    // before breaks existed at "before the movie" only.
    playsBeforeMovie: true,
    playsAtBreaks: true,
    linkUrl: "",
    cornerUntilClosed: false,
    cornerShowSeconds: String(CORNER_DEFAULTS.showSeconds),
    cornerOnce: false,
    cornerRepeatMinutes: String(CORNER_DEFAULTS.repeatMinutes),
    cornerClosable: true,
    frequencyLimitMinutes: "",
    maxImpressionsPerUserPerDay: "",
    // On, like a new promo: pick a video (or a picture), save, and it
    // plays. Without one the form says to upload it or switch this off.
    isActive: true,
    videoFile: null,
    videoFileDurationSeconds: null,
    imageFile: null,
    imageFileSize: null,
  };
}

const numberText = (value: number | null) => (value === null ? "" : String(value));

export function formFromAd(ad: Ad): AdFormState {
  const corner = ad.format === "CORNER";
  return {
    format: ad.format,
    title: ad.title,
    description: ad.description ?? "",
    startsAt: ad.startsAt ? toMmtInputValue(ad.startsAt) : "",
    endsAt: ad.endsAt ? toMmtInputValue(ad.endsAt) : "",
    dailyStartTime: ad.dailyStartTime ?? "",
    dailyEndTime: ad.dailyEndTime ?? "",
    targetType: ad.targetType,
    movies: ad.targetMovies,
    priority: String(ad.priority),
    isSkippable: ad.isSkippable,
    skipAfterSeconds: numberText(ad.skipAfterSeconds),
    // A corner ad stores both slots false; the form's (unused) video half
    // keeps the new-ad default rather than a choice nobody made.
    playsBeforeMovie: corner || ad.playsBeforeMovie,
    playsAtBreaks: corner || ad.playsAtBreaks,
    linkUrl: ad.linkUrl ?? "",
    cornerUntilClosed: corner && ad.cornerShowSeconds === null,
    cornerShowSeconds: String(ad.cornerShowSeconds ?? CORNER_DEFAULTS.showSeconds),
    cornerOnce: corner && ad.cornerRepeatMinutes === null,
    cornerRepeatMinutes: String(ad.cornerRepeatMinutes ?? CORNER_DEFAULTS.repeatMinutes),
    cornerClosable: !corner || ad.cornerClosable,
    frequencyLimitMinutes: numberText(ad.frequencyLimitMinutes),
    maxImpressionsPerUserPerDay: numberText(ad.maxImpressionsPerUserPerDay),
    isActive: ad.isActive,
    videoFile: null,
    videoFileDurationSeconds: null,
    imageFile: null,
    imageFileSize: null,
  };
}

/** A typed whole number: null for an empty box, "invalid" for anything that is not digits only. */
export function parseWhole(value: string): number | null | "invalid" {
  const text = value.trim();
  if (text === "") return null;
  return /^\d+$/.test(text) ? Number(text) : "invalid";
}

const orNull = (value: string) => {
  const text = value.trim();
  return text === "" ? null : text;
};

/** The whole number a box holds, or null — for the wire, where an unreadable value never gets (the form refuses it first). */
const wholeOrNull = (value: string): number | null => {
  const parsed = parseWhole(value);
  return parsed === "invalid" ? null : parsed;
};

/** Whether a daily window runs past midnight: "22:00"–"02:00" does, "09:00"–"17:00" does not. */
export function isOvernight(start: string, end: string): boolean {
  return end < start;
}

/** Is this file an MP4, as far as the browser can tell before uploading it? */
export function isMp4File(file: File): boolean {
  return file.type === "video/mp4" || /\.mp4$/i.test(file.name);
}

/** A PNG, JPG, WebP or GIF, as far as the browser can tell (the backend reads the bytes). */
export function isAdImageFile(file: File): boolean {
  return (AD_IMAGE_MIME_TYPES as readonly string[]).includes(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

export function isGifFile(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

/** Whether a picture's shape passes the backend's check: each side ≥ 16 px, the long side ≤ 8 × the short one. */
export function isAdImageShapeOk({ width, height }: AdImageSize): boolean {
  const short = Math.min(width, height);
  return short >= AD_IMAGE_MIN_SIDE && Math.max(width, height) <= short * AD_IMAGE_MAX_ASPECT;
}

/**
 * The fields one save sends: every ad's own, plus ONLY its format's (the
 * backend refuses the other format's with AD_FORMAT_MISMATCH). Never
 * `format` — that goes on the create alone.
 */
export type AdFormFields = AdCommonFields & Partial<AdVideoFields> & Partial<AdCornerFields>;

/** The wire fields. The chosen movies are sent only for SELECTED, so a list typed before switching to All never reaches the server. */
export function toFields(state: AdFormState): AdFormFields {
  const daily = state.dailyStartTime && state.dailyEndTime;
  const common: AdCommonFields = {
    title: state.title.trim(),
    description: orNull(state.description),
    isActive: state.isActive,
    startsAt: state.startsAt ? fromMmtInputValue(state.startsAt) : null,
    endsAt: state.endsAt ? fromMmtInputValue(state.endsAt) : null,
    dailyStartTime: daily ? state.dailyStartTime : null,
    dailyEndTime: daily ? state.dailyEndTime : null,
    tzOffsetMinutes: AD_TZ_OFFSET_MINUTES,
    targetType: state.targetType,
    movieIds: state.targetType === "SELECTED" ? state.movies.map((movie) => movie.id) : [],
    priority: wholeOrNull(state.priority) ?? 0,
    frequencyLimitMinutes: wholeOrNull(state.frequencyLimitMinutes),
    maxImpressionsPerUserPerDay: wholeOrNull(state.maxImpressionsPerUserPerDay),
  };
  if (state.format === "CORNER") {
    // Until closed = no repeat and always closable (the backend's rule):
    // the hidden choices are not sent as they were last typed.
    const untilClosed = state.cornerUntilClosed;
    return {
      ...common,
      linkUrl: orNull(state.linkUrl),
      cornerShowSeconds: untilClosed ? null : wholeOrNull(state.cornerShowSeconds),
      cornerRepeatMinutes: untilClosed || state.cornerOnce ? null : wholeOrNull(state.cornerRepeatMinutes),
      cornerClosable: untilClosed || state.cornerClosable,
    };
  }
  return {
    ...common,
    isSkippable: state.isSkippable,
    skipAfterSeconds: state.isSkippable ? wholeOrNull(state.skipAfterSeconds) : null,
    playsBeforeMovie: state.playsBeforeMovie,
    playsAtBreaks: state.playsAtBreaks,
  };
}

/** The stored ad as the same field shape, so a diff compares like with like. */
function fieldsOfAd(ad: Ad): AdFields {
  return {
    title: ad.title,
    description: ad.description,
    isActive: ad.isActive,
    startsAt: ad.startsAt,
    endsAt: ad.endsAt,
    dailyStartTime: ad.dailyStartTime,
    dailyEndTime: ad.dailyEndTime,
    tzOffsetMinutes: ad.tzOffsetMinutes,
    targetType: ad.targetType,
    movieIds: ad.targetMovies.map((movie) => movie.id),
    priority: ad.priority,
    isSkippable: ad.isSkippable,
    skipAfterSeconds: ad.skipAfterSeconds,
    playsBeforeMovie: ad.playsBeforeMovie,
    playsAtBreaks: ad.playsAtBreaks,
    linkUrl: ad.linkUrl,
    cornerShowSeconds: ad.cornerShowSeconds,
    cornerRepeatMinutes: ad.cornerRepeatMinutes,
    cornerClosable: ad.cornerClosable,
    frequencyLimitMinutes: ad.frequencyLimitMinutes,
    maxImpressionsPerUserPerDay: ad.maxImpressionsPerUserPerDay,
  };
}

/**
 * Only the fields that differ from the stored ad — PATCH semantics (absent =
 * keep). Only `next`'s keys are compared, so the other format's fields (and
 * `format`, which is no field at all) never ride along.
 */
export function changedFields(ad: Ad, next: AdFormFields): Partial<AdFields> {
  const before = fieldsOfAd(ad);
  const changed: Partial<AdFields> = {};
  const sameInstant = (a: string | null, b: string | null) =>
    a === b || (!!a && !!b && new Date(a).getTime() === new Date(b).getTime());
  const sameIds = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().every((id, i) => id === [...b].sort()[i]);
  (Object.keys(next) as (keyof AdFormFields)[]).forEach((key) => {
    let same: boolean;
    if (key === "startsAt" || key === "endsAt") same = sameInstant(before[key], next[key]);
    else if (key === "movieIds") same = sameIds(before.movieIds, next.movieIds);
    else same = before[key] === next[key];
    if (!same) (changed as Record<string, unknown>)[key] = next[key];
  });
  return changed;
}

/** Whether a save would leave the ad with a video: one already stored, or one picked now. */
export function hasVideo(state: AdFormState, ad: Ad | null): boolean {
  return state.videoFile !== null || !!ad?.videoUrl;
}

/** Whether a save would leave a corner ad with its picture: one already stored, or one picked now. */
export function hasPicture(state: AdFormState, ad: Ad | null): boolean {
  return state.imageFile !== null || !!ad?.imageUrl;
}

/** The video for a video ad, the picture for a corner ad — what "show to viewers" needs. */
export function hasMedia(state: AdFormState, ad: Ad | null): boolean {
  return state.format === "CORNER" ? hasPicture(state, ad) : hasVideo(state, ad);
}

/** Whether a STORED ad can be switched on (and previewed): its video, or its picture. */
export function adHasMedia(ad: Pick<Ad, "format" | "videoUrl" | "imageUrl">): boolean {
  return ad.format === "CORNER" ? !!ad.imageUrl : !!ad.videoUrl;
}

/**
 * The video length the skip-after rule is checked against: the picked
 * file's (as the browser read it) when one is picked, else the stored one.
 * Null = unknown, and then only the backend can check it. ROUNDED, because
 * the backend stores `Math.round(ffprobe)` and checks against that — a
 * 9.4 s clip with skip-after 9 must be refused here as it is there.
 */
export function effectiveDurationSeconds(state: AdFormState, ad: Ad | null): number | null {
  if (state.videoFile) {
    return state.videoFileDurationSeconds === null ? null : Math.round(state.videoFileDurationSeconds);
  }
  return ad?.durationSeconds ?? null;
}

/** "0:12", "1:30", "10:00" — an ad is at most ten minutes, so minutes:seconds is enough. */
export function formatAdDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * A corner ad's timing: seconds per showing (null = until closed) and
 * watched minutes before it comes back (null = once). NaN stands for a box
 * still being typed in, and reads as "…".
 */
export interface CornerTiming {
  showSeconds: number | null;
  repeatMinutes: number | null;
}

/** The timing as typed in the form, for the live preview — not a check (formIssues is). */
export function cornerTimingOf(state: AdFormState): CornerTiming {
  const typed = (value: string) => {
    const parsed = parseWhole(value);
    return typeof parsed === "number" ? parsed : Number.NaN;
  };
  if (state.cornerUntilClosed) return { showSeconds: null, repeatMinutes: null };
  return {
    showSeconds: typed(state.cornerShowSeconds),
    repeatMinutes: state.cornerOnce ? null : typed(state.cornerRepeatMinutes),
  };
}

/** "example.com" — the host a corner link opens, for the chips; null for no (or no readable) link. */
export function linkHost(url: string | null | undefined): string | null {
  const match = url ? /^https?:\/\/([^\s/?#]+)/i.exec(url.trim()) : null;
  return match ? match[1].replace(/^www\./i, "") : null;
}

/** An issue that needs no number to be explained. */
type NoParams = Record<string, never>;

/**
 * What each issue carries for its sentence (2026-11-04, the step-by-step
 * form): the limit it broke, never the words — the wizard's copy turns a
 * code into a sentence, and adSteps.ts says which step it belongs to.
 */
export interface AdIssueParams {
  TITLE_REQUIRED: NoParams;
  TITLE_TOO_LONG: { max: number };
  DESCRIPTION_TOO_LONG: { max: number };
  VIDEO_NOT_MP4: NoParams;
  VIDEO_TOO_LARGE: { maxBytes: number };
  /** The text names the range as "1 second to 10 minutes". */
  VIDEO_DURATION: { minSeconds: number; maxSeconds: number };
  TARGET_MOVIES_REQUIRED: NoParams;
  TARGET_TOO_MANY: { max: number };
  TARGET_DELETED: NoParams;
  WINDOW_INVALID: NoParams;
  DAILY_WINDOW_INCOMPLETE: NoParams;
  DAILY_WINDOW_SAME: NoParams;
  PRIORITY_RANGE: { min: number; max: number };
  SKIP_AFTER_REQUIRED: NoParams;
  SKIP_AFTER_RANGE: { min: number; max: number };
  /** The (rounded) video length the skip time has to stay under. */
  SKIP_AFTER_TOO_LONG: { durationSeconds: number };
  FREQUENCY_RANGE: { min: number; max: number };
  MAX_PER_DAY_RANGE: { min: number; max: number };
  SLOTS_REQUIRED: NoParams;
  VIDEO_REQUIRED: NoParams;
  PICTURE_TYPE: NoParams;
  PICTURE_TOO_LARGE: { maxBytes: number };
  PICTURE_UNREADABLE: NoParams;
  PICTURE_SHAPE: { minSide: number; maxAspect: number };
  LINK_TOO_LONG: { max: number };
  LINK_INVALID: NoParams;
  CORNER_SHOW_RANGE: { min: number; max: number };
  CORNER_REPEAT_RANGE: { min: number; max: number };
  CORNER_REPEAT_TOO_SHORT: NoParams;
  PICTURE_REQUIRED: NoParams;
}

/** One code per distinct rule the form checks ("too long" is split per field, as each sits on its own step). */
export type AdIssueCode = keyof AdIssueParams;

/** One rule the form breaks: its code and the numbers its sentence needs. */
export type AdIssue = { [C in AdIssueCode]: { code: C; params: AdIssueParams[C] } }[AdIssueCode];

/**
 * Every rule the form breaks right now, as codes — empty means Save may be
 * pressed. `ad` is the stored row when editing (its video or picture counts
 * as present, its length is the fallback for the skip-after check). Only the
 * ad's own format's fields are checked. The wizard says each one with
 * `issueText` and places it on its step with adSteps.ts.
 */
export function formIssues(state: AdFormState, ad: Ad | null): AdIssue[] {
  const issues: AdIssue[] = [];

  if (state.title.trim() === "") issues.push({ code: "TITLE_REQUIRED", params: {} });
  if (state.title.trim().length > AD_LIMITS.title) issues.push({ code: "TITLE_TOO_LONG", params: { max: AD_LIMITS.title } });
  if (state.description.trim().length > AD_LIMITS.description) {
    issues.push({ code: "DESCRIPTION_TOO_LONG", params: { max: AD_LIMITS.description } });
  }

  const corner = state.format === "CORNER";
  const file = corner ? null : state.videoFile;
  if (file) {
    if (!isMp4File(file)) issues.push({ code: "VIDEO_NOT_MP4", params: {} });
    else if (file.size > AD_VIDEO_MAX_BYTES) issues.push({ code: "VIDEO_TOO_LARGE", params: { maxBytes: AD_VIDEO_MAX_BYTES } });
    // Only a length the browser could read is checked (rounded, as the
    // server rounds ffprobe's); an unreadable one is left to the server.
    const seconds = state.videoFileDurationSeconds === null ? null : Math.round(state.videoFileDurationSeconds);
    if (seconds !== null && (seconds < AD_VIDEO_MIN_SECONDS || seconds > AD_VIDEO_MAX_SECONDS)) {
      issues.push({ code: "VIDEO_DURATION", params: { minSeconds: AD_VIDEO_MIN_SECONDS, maxSeconds: AD_VIDEO_MAX_SECONDS } });
    }
  }

  if (state.targetType === "SELECTED") {
    if (state.movies.length === 0) issues.push({ code: "TARGET_MOVIES_REQUIRED", params: {} });
    else if (state.movies.length > AD_LIMITS.movies) issues.push({ code: "TARGET_TOO_MANY", params: { max: AD_LIMITS.movies } });
    // The backend re-checks every chosen movie on every save.
    if (state.movies.some((movie) => movie.missing)) issues.push({ code: "TARGET_DELETED", params: {} });
  }

  const start = state.startsAt ? fromMmtInputValue(state.startsAt) : null;
  const end = state.endsAt ? fromMmtInputValue(state.endsAt) : null;
  if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
    issues.push({ code: "WINDOW_INVALID", params: {} });
  }

  if (!!state.dailyStartTime !== !!state.dailyEndTime) issues.push({ code: "DAILY_WINDOW_INCOMPLETE", params: {} });
  else if (state.dailyStartTime && state.dailyStartTime === state.dailyEndTime) {
    issues.push({ code: "DAILY_WINDOW_SAME", params: {} });
  }

  const inRange = (value: string, min: number, max: number) => {
    const parsed = parseWhole(value);
    return parsed === null || (parsed !== "invalid" && parsed >= min && parsed <= max);
  };
  const priority = AD_LIMITS.priority;
  if (parseWhole(state.priority) === null || !inRange(state.priority, priority.min, priority.max)) {
    issues.push({ code: "PRIORITY_RANGE", params: { min: priority.min, max: priority.max } });
  }
  if (!corner && state.isSkippable) {
    const skip = parseWhole(state.skipAfterSeconds);
    const { min, max } = AD_LIMITS.skipAfterSeconds;
    if (skip === null) issues.push({ code: "SKIP_AFTER_REQUIRED", params: {} });
    else if (skip === "invalid" || skip < min || skip > max) issues.push({ code: "SKIP_AFTER_RANGE", params: { min, max } });
    else {
      const duration = effectiveDurationSeconds(state, ad);
      if (duration !== null && skip >= duration) {
        issues.push({ code: "SKIP_AFTER_TOO_LONG", params: { durationSeconds: duration } });
      }
    }
  }
  const frequency = AD_LIMITS.frequencyLimitMinutes;
  if (!inRange(state.frequencyLimitMinutes, frequency.min, frequency.max)) {
    issues.push({ code: "FREQUENCY_RANGE", params: { min: frequency.min, max: frequency.max } });
  }
  const perDay = AD_LIMITS.maxImpressionsPerUserPerDay;
  if (!inRange(state.maxImpressionsPerUserPerDay, perDay.min, perDay.max)) {
    issues.push({ code: "MAX_PER_DAY_RANGE", params: { min: perDay.min, max: perDay.max } });
  }

  if (corner) issues.push(...cornerIssues(state, ad));
  else {
    if (!state.playsBeforeMovie && !state.playsAtBreaks) issues.push({ code: "SLOTS_REQUIRED", params: {} });
    if (state.isActive && !hasVideo(state, ad)) issues.push({ code: "VIDEO_REQUIRED", params: {} });
  }

  return issues;
}

/** The corner half of formIssues: the picked picture, the link, the timing, and a picture to switch it on. */
function cornerIssues(state: AdFormState, ad: Ad | null): AdIssue[] {
  const issues: AdIssue[] = [];

  const image = state.imageFile;
  if (image) {
    if (!isAdImageFile(image)) issues.push({ code: "PICTURE_TYPE", params: {} });
    else if (image.size > AD_IMAGE_MAX_BYTES) issues.push({ code: "PICTURE_TOO_LARGE", params: { maxBytes: AD_IMAGE_MAX_BYTES } });
    else if (state.imageFileSize === "unreadable") issues.push({ code: "PICTURE_UNREADABLE", params: {} });
    else if (state.imageFileSize && !isAdImageShapeOk(state.imageFileSize)) {
      issues.push({ code: "PICTURE_SHAPE", params: { minSide: AD_IMAGE_MIN_SIDE, maxAspect: AD_IMAGE_MAX_ASPECT } });
    }
  }

  const link = state.linkUrl.trim();
  if (link.length > AD_LIMITS.linkUrl) issues.push({ code: "LINK_TOO_LONG", params: { max: AD_LIMITS.linkUrl } });
  else if (link !== "" && !AD_LINK_PATTERN.test(link)) issues.push({ code: "LINK_INVALID", params: {} });

  if (!state.cornerUntilClosed) {
    const typed = parseWhole(state.cornerShowSeconds);
    const showRange = AD_LIMITS.cornerShowSeconds;
    const show = typeof typed === "number" && typed >= showRange.min && typed <= showRange.max ? typed : null;
    if (show === null) issues.push({ code: "CORNER_SHOW_RANGE", params: { min: showRange.min, max: showRange.max } });
    if (!state.cornerOnce) {
      const repeat = parseWhole(state.cornerRepeatMinutes);
      const repeatRange = AD_LIMITS.cornerRepeatMinutes;
      if (typeof repeat !== "number" || repeat < repeatRange.min || repeat > repeatRange.max) {
        issues.push({ code: "CORNER_REPEAT_RANGE", params: { min: repeatRange.min, max: repeatRange.max } });
      } else if (show !== null && repeat * 60 <= show) {
        // The backend's rule: it must come back later than it stays up.
        issues.push({ code: "CORNER_REPEAT_TOO_SHORT", params: {} });
      }
    }
  }

  if (state.isActive && !hasPicture(state, ad)) issues.push({ code: "PICTURE_REQUIRED", params: {} });
  return issues;
}

/**
 * Whether the form holds anything the admin typed or picked since it was
 * opened — what "Close without saving?" asks about. The chosen movies
 * compare as a set (adding one and taking it out again is no change); a
 * picked file compares by identity, and the length / size the browser
 * reads from it later are not changes of their own.
 */
export function formIsDirty(initial: AdFormState, current: AdFormState): boolean {
  const movieIds = (state: AdFormState) =>
    state.movies
      .map((movie) => movie.id)
      .sort()
      .join("\n");
  return (Object.keys(current) as (keyof AdFormState)[]).some((key) => {
    if (key === "movies") return movieIds(initial) !== movieIds(current);
    if (key === "videoFileDurationSeconds" || key === "imageFileSize") return false;
    return initial[key] !== current[key];
  });
}

/**
 * One problem in the admin's language (lib/i18n/ads/wizard.ts `issues`) —
 * the red box over a wizard step, the Summary's "Fix" rows. Sizes read as
 * "200 MB", a video length as "0:15" (an ad clip's own length, not a
 * position in a movie).
 */
export function issueText(t: TranslationShape, issue: AdIssue): string {
  const s = t.adsUi.wizard.issues;
  switch (issue.code) {
    case "TITLE_REQUIRED":
      return s.TITLE_REQUIRED;
    case "TITLE_TOO_LONG":
      return s.TITLE_TOO_LONG(issue.params.max);
    case "DESCRIPTION_TOO_LONG":
      return s.DESCRIPTION_TOO_LONG(issue.params.max);
    case "VIDEO_NOT_MP4":
      return s.VIDEO_NOT_MP4;
    case "VIDEO_TOO_LARGE":
      return s.VIDEO_TOO_LARGE(formatBytes(issue.params.maxBytes));
    case "VIDEO_DURATION":
      return s.VIDEO_DURATION(issue.params.minSeconds, Math.round(issue.params.maxSeconds / 60));
    case "TARGET_MOVIES_REQUIRED":
      return s.TARGET_MOVIES_REQUIRED;
    case "TARGET_TOO_MANY":
      return s.TARGET_TOO_MANY(issue.params.max);
    case "TARGET_DELETED":
      return s.TARGET_DELETED;
    case "WINDOW_INVALID":
      return s.WINDOW_INVALID;
    case "DAILY_WINDOW_INCOMPLETE":
      return s.DAILY_WINDOW_INCOMPLETE;
    case "DAILY_WINDOW_SAME":
      return s.DAILY_WINDOW_SAME;
    case "PRIORITY_RANGE":
      return s.PRIORITY_RANGE(issue.params.min, issue.params.max);
    case "SKIP_AFTER_REQUIRED":
      return s.SKIP_AFTER_REQUIRED;
    case "SKIP_AFTER_RANGE":
      return s.SKIP_AFTER_RANGE(issue.params.min, issue.params.max);
    case "SKIP_AFTER_TOO_LONG":
      return s.SKIP_AFTER_TOO_LONG(formatAdDuration(issue.params.durationSeconds));
    case "FREQUENCY_RANGE":
      return s.FREQUENCY_RANGE(issue.params.min, issue.params.max);
    case "MAX_PER_DAY_RANGE":
      return s.MAX_PER_DAY_RANGE(issue.params.min, issue.params.max);
    case "SLOTS_REQUIRED":
      return s.SLOTS_REQUIRED;
    case "VIDEO_REQUIRED":
      return s.VIDEO_REQUIRED;
    case "PICTURE_TYPE":
      return s.PICTURE_TYPE;
    case "PICTURE_TOO_LARGE":
      return s.PICTURE_TOO_LARGE(formatBytes(issue.params.maxBytes));
    case "PICTURE_UNREADABLE":
      return s.PICTURE_UNREADABLE;
    case "PICTURE_SHAPE":
      return s.PICTURE_SHAPE(issue.params.minSide, issue.params.maxAspect);
    case "LINK_TOO_LONG":
      return s.LINK_TOO_LONG(issue.params.max);
    case "LINK_INVALID":
      return s.LINK_INVALID;
    case "CORNER_SHOW_RANGE":
      return s.CORNER_SHOW_RANGE(issue.params.min, issue.params.max);
    case "CORNER_REPEAT_RANGE":
      return s.CORNER_REPEAT_RANGE(issue.params.min, issue.params.max);
    case "CORNER_REPEAT_TOO_SHORT":
      return s.CORNER_REPEAT_TOO_SHORT;
    case "PICTURE_REQUIRED":
      return s.PICTURE_REQUIRED;
  }
}

/**
 * How many of the "More options" (the hours of the day, the wait, the
 * daily limit, "which ad goes first") hold something other than the
 * default — the "{n} set" on the closed section's header.
 */
export function moreOptionsSet(state: AdFormState): number {
  const typed = (value: string) => value.trim() !== "";
  return [
    typed(state.dailyStartTime) || typed(state.dailyEndTime),
    typed(state.frequencyLimitMinutes),
    typed(state.maxImpressionsPerUserPerDay),
    typed(state.priority) && state.priority.trim() !== "0",
  ].filter(Boolean).length;
}

/**
 * What a save would leave on the ad, as data for the wizard's last step
 * ("Check and save" / "Summary") — read through `toFields`, so the summary
 * describes exactly what goes to the server (dates as ISO instants, the
 * hours only when both are set, a hidden choice not as it was last typed),
 * plus the file a save would upload. No words here: ReviewStep says it.
 */
export interface AdReviewSummary {
  format: AdFormat;
  title: string;
  /** The video (VIDEO) or the picture (CORNER) a save leaves on the ad. */
  media: { source: "picked"; fileName: string } | { source: "stored" } | { source: "none" };
  /** VIDEO: whole seconds, the picked file's as the browser read it or the stored one's; null = not known. */
  durationSeconds: number | null;
  /** CORNER: the picture's size, when known. */
  pictureSize: AdImageSize | null;
  /** VIDEO */
  playsBeforeMovie: boolean;
  playsAtBreaks: boolean;
  /** VIDEO: seconds before Skip shows; null = it can't be skipped. */
  skipAfterSeconds: number | null;
  /** CORNER: the host a tap opens; null = a tap does nothing. */
  linkHost: string | null;
  /** CORNER: as typed (NaN = a box still being typed in). */
  timing: CornerTiming;
  closable: boolean;
  targetType: AdTargetType;
  /** SELECTED: the chosen movies' titles in order, null for a deleted one. */
  movieTitles: (string | null)[];
  startsAt: string | null;
  endsAt: string | null;
  daily: { start: string; end: string; overnight: boolean } | null;
  waitMinutes: number | null;
  perDay: number | null;
  priority: number;
  isActive: boolean;
  note: string | null;
}

export function reviewSummary(state: AdFormState, ad: Ad | null): AdReviewSummary {
  const fields = toFields(state);
  const corner = state.format === "CORNER";
  const pickedFile = corner ? state.imageFile : state.videoFile;
  const stored = corner ? !!ad?.imageUrl : !!ad?.videoUrl;
  const measured = typeof state.imageFileSize === "object" ? state.imageFileSize : null;
  const storedSize =
    ad && ad.imageWidth !== null && ad.imageHeight !== null ? { width: ad.imageWidth, height: ad.imageHeight } : null;
  return {
    format: state.format,
    title: fields.title,
    media: pickedFile
      ? { source: "picked", fileName: pickedFile.name }
      : stored
        ? { source: "stored" }
        : { source: "none" },
    durationSeconds: corner ? null : effectiveDurationSeconds(state, ad),
    pictureSize: !corner ? null : state.imageFile ? measured : ad?.imageUrl ? storedSize : null,
    playsBeforeMovie: state.playsBeforeMovie,
    playsAtBreaks: state.playsAtBreaks,
    skipAfterSeconds: fields.isSkippable ? (fields.skipAfterSeconds ?? null) : null,
    linkHost: linkHost(fields.linkUrl),
    timing: cornerTimingOf(state),
    closable: state.cornerUntilClosed || state.cornerClosable,
    targetType: fields.targetType,
    movieTitles:
      fields.targetType === "SELECTED"
        ? state.movies.map((movie) => (movie.missing || !movie.title ? null : movie.title))
        : [],
    startsAt: fields.startsAt,
    endsAt: fields.endsAt,
    daily:
      fields.dailyStartTime && fields.dailyEndTime
        ? {
            start: fields.dailyStartTime,
            end: fields.dailyEndTime,
            overnight: isOvernight(fields.dailyStartTime, fields.dailyEndTime),
          }
        : null,
    waitMinutes: fields.frequencyLimitMinutes,
    perDay: fields.maxImpressionsPerUserPerDay,
    priority: fields.priority,
    isActive: fields.isActive,
    note: fields.description,
  };
}

/**
 * The words for a refused request: a known backend `code` in the admin's
 * language, otherwise the backend's own sentence. A refusal that matches a
 * form check reads exactly as that check does in the wizard (`issueText`).
 */
export function adErrorMessage(err: unknown, t: TranslationShape): string {
  if (!(err instanceof ApiError)) return t.common.somethingWentWrong;
  const text = (issue: AdIssue) => issueText(t, issue);
  const server = t.adsUi.wizard.server;
  const byCode: Record<string, string> = {
    ...t.ads.serverErrors,
    AD_TITLE_REQUIRED: text({ code: "TITLE_REQUIRED", params: {} }),
    AD_WINDOW_INVALID: text({ code: "WINDOW_INVALID", params: {} }),
    AD_DAILY_WINDOW_INVALID: text({ code: "DAILY_WINDOW_INCOMPLETE", params: {} }),
    AD_TARGET_MOVIES_REQUIRED: text({ code: "TARGET_MOVIES_REQUIRED", params: {} }),
    AD_SKIP_AFTER_REQUIRED: text({ code: "SKIP_AFTER_REQUIRED", params: {} }),
    // The server does not say the length it checked against.
    AD_SKIP_AFTER_TOO_LONG: server.skipTooLong,
    AD_SLOTS_REQUIRED: text({ code: "SLOTS_REQUIRED", params: {} }),
    // Also the list's switch, where "Not yet — save it turned off" means nothing.
    AD_IMAGE_REQUIRED: server.pictureRequired,
    AD_IMAGE_TOO_LARGE: text({ code: "PICTURE_TOO_LARGE", params: { maxBytes: AD_IMAGE_MAX_BYTES } }),
    AD_IMAGE_UNSUPPORTED: text({ code: "PICTURE_TYPE", params: {} }),
    AD_IMAGE_SHAPE_INVALID: text({
      code: "PICTURE_SHAPE",
      params: { minSide: AD_IMAGE_MIN_SIDE, maxAspect: AD_IMAGE_MAX_ASPECT },
    }),
    AD_LINK_INVALID: text({ code: "LINK_INVALID", params: {} }),
  };
  return (err.code && byCode[err.code]) || err.message;
}
