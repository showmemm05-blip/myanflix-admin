/**
 * Small helpers that turn an ad's data into the words the Advertisements
 * pages show (2026-11-04, docs/ads-admin-ux-2026-11-04) — so the list, its
 * phone cards, the checker, the wizard and the results say the same thing
 * the same way. The copy is in lib/i18n/ads/shared.ts (`t.adsUi.shared`);
 * the rules are in adHealth.ts and breakSchedule.ts.
 */
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatMmt, formatMmtDate } from "@/lib/myanmar-time";
import type { StatusTone } from "@/components/shared/StatusBadge";
import { movieTimeParts } from "@/components/ads/breakSchedule";
import {
  AD_SHOW_STATE_TONES,
  adShowState,
  clockAt,
  showingUnchecked,
  type AdShowState,
  type AdShowStateInput,
  type AdShowStateSettings,
} from "@/components/ads/adHealth";
import type { Ad, AdFormat, AdPlacement } from "@/types/ad";

/**
 * A movie position or length in words: "30 min", "1 h", "1 h 30 min"
 * ("30 မိနစ်", "1 နာရီ 30 မိနစ်") — never "0:30" / "1:00", which read as a
 * clock. Whole minutes, floored (breakSchedule.ts `movieTimeParts`).
 */
export function movieTimeText(t: TranslationShape, seconds: number): string {
  const words = t.adsUi.shared.movieTime;
  const { hours, minutes } = movieTimeParts(seconds);
  if (hours === 0) return words.minutes(minutes);
  return minutes === 0 ? words.hours(hours) : words.hoursMinutes(hours, minutes);
}

/** "Video ad" / "Corner picture". */
export function formatLabel(t: TranslationShape, format: AdFormat): string {
  return t.adsUi.shared.formats[format];
}

/** "Before the movie" / "Ad breaks" / "Corner pictures" — the three places an ad can appear. */
export function placementLabel(t: TranslationShape, placement: AdPlacement): string {
  return t.adsUi.shared.placements[placement];
}

/** "Before the movie and at ad breaks" — where one video ad plays; "" for neither (a corner picture). */
export function slotsText(t: TranslationShape, ad: Pick<Ad, "playsBeforeMovie" | "playsAtBreaks">): string {
  const slots = t.adsUi.shared.slots;
  if (ad.playsBeforeMovie && ad.playsAtBreaks) return slots.both;
  if (ad.playsBeforeMovie) return slots.before;
  return ad.playsAtBreaks ? slots.breaks : "";
}

/** "All movies and episodes" / "12 chosen movies". */
export function moviesText(t: TranslationShape, ad: Pick<Ad, "targetType" | "targetMovies">): string {
  const movies = t.adsUi.shared.movies;
  return ad.targetType === "SELECTED" ? movies.chosen(ad.targetMovies.length) : movies.all;
}

/** The badge: "Showing", "Paused by settings", "Needs a video" (or "Needs a picture" for a corner picture)… */
export function statusLabel(t: TranslationShape, state: AdShowState, format: AdFormat): string {
  const labels = t.adsUi.shared.statusLabels;
  if (state === "NEEDS_MEDIA") return format === "CORNER" ? labels.NEEDS_PICTURE : labels.NEEDS_VIDEO;
  return labels[state];
}

/**
 * The badge's words and colour together. With the settings unknown (null) a
 * clean ad reads "Settings not checked", in grey: the checker says the same
 * thing (verdict UNKNOWN), and a green "Showing" could be untrue with every ad
 * switched off.
 */
export function statusBadge(
  t: TranslationShape,
  state: AdShowState,
  format: AdFormat,
  settings: AdShowStateSettings | null,
): { label: string; tone: StatusTone } {
  if (showingUnchecked(state, settings)) return { label: t.adsUi.shared.statusLabels.SHOWING_UNCHECKED, tone: "neutral" };
  return { label: statusLabel(t, state, format), tone: AD_SHOW_STATE_TONES[state] };
}

/**
 * The sentence under the badge (the `Statuses` board) — why the ad is or is
 * not reaching viewers at `nowMs`: "It only shows 18:00–23:00 each day. It's
 * 14:05 in Myanmar now." Dates and times in Myanmar time; with the settings
 * unknown (null) the two "Paused by settings" cases are not considered, as
 * in adShowState, and a clean ad says the settings aren't checked yet.
 */
export function statusSentence(
  t: TranslationShape,
  ad: AdShowStateInput,
  settings: AdShowStateSettings | null,
  nowMs: number,
): string {
  const s = t.adsUi.shared.statusSentences;
  const corner = ad.format === "CORNER";
  switch (adShowState(ad, settings, nowMs)) {
    case "NEEDS_MEDIA":
      return corner ? s.NEEDS_PICTURE : s.NEEDS_VIDEO;
    case "OFF":
      return s.OFF;
    case "ENDED":
      return s.ENDED(ad.endsAt ? formatMmtDate(ad.endsAt) : "—");
    case "STARTS_LATER":
      return s.STARTS_LATER(formatMmt(ad.startsAt));
    case "NO_MOVIES":
      return s.NO_MOVIES;
    case "ALL_ADS_OFF":
      return s.ALL_ADS_OFF;
    case "BREAKS_OFF":
      return s.BREAKS_OFF;
    case "OUTSIDE_HOURS":
      return s.OUTSIDE_HOURS(ad.dailyStartTime ?? "—", ad.dailyEndTime ?? "—", clockAt(nowMs, ad.tzOffsetMinutes));
    case "SHOWING":
      if (settings === null) return s.SHOWING_UNCHECKED;
      return corner ? s.SHOWING_CORNER : s.SHOWING_VIDEO;
  }
}
