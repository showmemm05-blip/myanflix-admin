/**
 * The ads' visible status and the "Will it show?" checker
 * (components/ads/adHealth.ts): every status, the order they are checked
 * in, the daily hours read exactly like the backend's `inDailyWindow`
 * (offsets, past midnight, end excluded), unknown settings skipped, and the
 * checker's checks, fixes, notes and test recipe for the owner's own cases.
 *
 * Runs on Node's own test runner: `npm test`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Ad, AdSettings, AdTargetMovie } from "@/types/ad";

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way.
const load = createRequire(import.meta.url);
const {
  AD_SHOW_STATES,
  AD_SHOW_STATE_TONES,
  adShowState,
  clockAt,
  diagnoseAd,
  inDailyWindow,
  minuteOfDay,
  showStateOfLiveState,
  showingUnchecked,
  timeOfDayMinutes,
} = load("./adHealth.ts") as typeof import("./adHealth");

const MMT = 390;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** 4 Nov 2026, 14:05 in Myanmar = 07:35 UTC. */
const NOW = Date.UTC(2026, 10, 4, 7, 35);
const iso = (ms: number) => new Date(ms).toISOString();
/** The UTC instant at which Myanmar's clock reads hh:mm on 4 Nov 2026. */
const mmtAt = (hh: number, mm: number) => Date.UTC(2026, 10, 4, hh, mm) - MMT * MINUTE;

function videoAd(overrides: Partial<Ad> = {}): Ad {
  return {
    id: "ad-1",
    format: "VIDEO",
    title: "TEST ad · 12 s",
    description: null,
    isActive: true,
    liveState: "LIVE",
    videoUrl: "https://cache.example/ad.mp4?sig=1",
    durationSeconds: 12,
    videoBytes: 1_000_000,
    playsBeforeMovie: true,
    playsAtBreaks: true,
    imageUrl: null,
    imageBytes: null,
    imageWidth: null,
    imageHeight: null,
    linkUrl: null,
    cornerShowSeconds: null,
    cornerRepeatMinutes: null,
    cornerClosable: true,
    targetType: "ALL",
    targetMovies: [],
    priority: 0,
    startsAt: null,
    endsAt: null,
    dailyStartTime: null,
    dailyEndTime: null,
    tzOffsetMinutes: MMT,
    isSkippable: false,
    skipAfterSeconds: null,
    frequencyLimitMinutes: null,
    maxImpressionsPerUserPerDay: null,
    counters: { impressions: 12, completions: 9, skips: 0, shows: 0, clicks: 0, closes: 0 },
    createdBy: null,
    createdAt: iso(NOW - 24 * HOUR),
    updatedAt: iso(NOW - 24 * HOUR),
    ...overrides,
  };
}

function cornerAd(overrides: Partial<Ad> = {}): Ad {
  return videoAd({
    format: "CORNER",
    title: "Big match tonight",
    videoUrl: null,
    durationSeconds: null,
    videoBytes: null,
    playsBeforeMovie: false,
    playsAtBreaks: false,
    imageUrl: "https://cache.example/ads/big-match.gif",
    imageBytes: 400_000,
    imageWidth: 480,
    imageHeight: 160,
    cornerShowSeconds: 10,
    cornerRepeatMinutes: 15,
    cornerClosable: true,
    ...overrides,
  });
}

/** A chosen movie: published and present unless told otherwise. */
function movieOf(id: string, overrides: Partial<AdTargetMovie> = {}): AdTargetMovie {
  return { id, title: `Movie ${id}`, imageUrl: null, isVisible: true, missing: false, ...overrides };
}

function settingsOf(overrides: Partial<AdSettings> = {}): AdSettings {
  return {
    adsEnabled: true,
    midrollIntervalMinutes: 30,
    duringMovieAudience: "ALL",
    updatedAt: null,
    updatedBy: null,
    liveCounts: { preroll: 1, breaks: 1, corner: 1 },
    ...overrides,
  };
}

describe("the daily hours — the backend's inDailyWindow", () => {
  const evening = { dailyStartTime: "18:00", dailyEndTime: "23:00", tzOffsetMinutes: MMT };
  const overnight = { dailyStartTime: "22:00", dailyEndTime: "02:00", tzOffsetMinutes: MMT };

  it("no hours (or only one of the two) = all day", () => {
    assert.equal(inDailyWindow({ dailyStartTime: null, dailyEndTime: null, tzOffsetMinutes: MMT }, NOW), true);
    assert.equal(inDailyWindow({ dailyStartTime: "18:00", dailyEndTime: null, tzOffsetMinutes: MMT }, NOW), true);
  });

  it("18:00–23:00: the start is in, the end is out", () => {
    assert.equal(inDailyWindow(evening, NOW), false, "14:05");
    assert.equal(inDailyWindow(evening, mmtAt(17, 59)), false);
    assert.equal(inDailyWindow(evening, mmtAt(18, 0)), true);
    assert.equal(inDailyWindow(evening, mmtAt(22, 59)), true);
    assert.equal(inDailyWindow(evening, mmtAt(23, 0)), false);
  });

  it("22:00–02:00 runs past midnight", () => {
    assert.equal(inDailyWindow(overnight, mmtAt(21, 59)), false);
    assert.equal(inDailyWindow(overnight, mmtAt(22, 0)), true);
    assert.equal(inDailyWindow(overnight, mmtAt(23, 30)), true);
    assert.equal(inDailyWindow(overnight, mmtAt(0, 0)), true);
    assert.equal(inDailyWindow(overnight, mmtAt(1, 59)), true);
    assert.equal(inDailyWindow(overnight, mmtAt(2, 0)), false);
    assert.equal(inDailyWindow(overnight, NOW), false);
  });

  it("read in the ad's own offset, not the browser's or UTC", () => {
    // 07:35 UTC: outside 18:00–23:00 in Myanmar, but inside 07:00–08:00 UTC.
    const utcMorning = { dailyStartTime: "07:00", dailyEndTime: "08:00" };
    assert.equal(inDailyWindow({ ...utcMorning, tzOffsetMinutes: 0 }, NOW), true);
    assert.equal(inDailyWindow({ ...utcMorning, tzOffsetMinutes: MMT }, NOW), false);
    // A negative offset wraps back across midnight: 07:35 UTC is 23:35 at UTC−8.
    assert.equal(inDailyWindow({ dailyStartTime: "23:00", dailyEndTime: "23:59", tzOffsetMinutes: -480 }, NOW), true);
  });

  it("the same start and end (which the backend refuses) reads as the backend reads it: all day", () => {
    assert.equal(inDailyWindow({ dailyStartTime: "10:00", dailyEndTime: "10:00", tzOffsetMinutes: MMT }, NOW), true);
  });

  it("minuteOfDay, clockAt and timeOfDayMinutes", () => {
    assert.equal(minuteOfDay(NOW, MMT), 14 * 60 + 5);
    assert.equal(minuteOfDay(NOW, 0), 7 * 60 + 35);
    assert.equal(clockAt(NOW, MMT), "14:05");
    assert.equal(clockAt(Date.UTC(2026, 10, 4, 20, 0), MMT), "02:30");
    assert.equal(clockAt(NOW, -480), "23:35");
    assert.equal(timeOfDayMinutes("18:30"), 18 * 60 + 30);
    assert.equal(timeOfDayMinutes("00:00"), 0);
    for (const bad of [null, "", "7:30", "24:00", "12:60", "noon"]) assert.equal(timeOfDayMinutes(bad), null, String(bad));
  });
});

describe("adShowState — every status", () => {
  const settings = settingsOf();

  it("SHOWING", () => {
    assert.equal(adShowState(videoAd(), settings, NOW), "SHOWING");
    assert.equal(adShowState(cornerAd(), settings, NOW), "SHOWING");
  });

  it("NEEDS_MEDIA: a video ad without its video, a corner ad without its picture", () => {
    assert.equal(adShowState(videoAd({ videoUrl: null }), settings, NOW), "NEEDS_MEDIA");
    assert.equal(adShowState(cornerAd({ imageUrl: null }), settings, NOW), "NEEDS_MEDIA");
    // A corner ad never has a video; a video ad's picture fields mean nothing.
    assert.equal(adShowState(videoAd({ imageUrl: "https://x/y.png", videoUrl: null }), settings, NOW), "NEEDS_MEDIA");
  });

  it("OFF", () => {
    assert.equal(adShowState(videoAd({ isActive: false }), settings, NOW), "OFF");
  });

  it("ENDED: an end at or before now", () => {
    assert.equal(adShowState(videoAd({ endsAt: iso(NOW) }), settings, NOW), "ENDED");
    assert.equal(adShowState(videoAd({ endsAt: iso(NOW - HOUR) }), settings, NOW), "ENDED");
    assert.equal(adShowState(videoAd({ endsAt: iso(NOW + 1) }), settings, NOW), "SHOWING");
  });

  it("STARTS_LATER: a start after now", () => {
    assert.equal(adShowState(videoAd({ startsAt: iso(NOW + 1) }), settings, NOW), "STARTS_LATER");
    assert.equal(adShowState(videoAd({ startsAt: iso(NOW) }), settings, NOW), "SHOWING");
  });

  it("ALL_ADS_OFF: the master switch, for every kind of ad", () => {
    const off = settingsOf({ adsEnabled: false });
    assert.equal(adShowState(videoAd(), off, NOW), "ALL_ADS_OFF");
    assert.equal(adShowState(cornerAd(), off, NOW), "ALL_ADS_OFF");
  });

  it("BREAKS_OFF: only a video ad that plays at breaks and not before the movie", () => {
    const noBreaks = settingsOf({ midrollIntervalMinutes: 0 });
    assert.equal(adShowState(videoAd({ playsBeforeMovie: false }), noBreaks, NOW), "BREAKS_OFF");
    assert.equal(adShowState(videoAd(), noBreaks, NOW), "SHOWING", "both: still plays before the movie");
    assert.equal(adShowState(videoAd({ playsAtBreaks: false }), noBreaks, NOW), "SHOWING");
    assert.equal(adShowState(cornerAd(), noBreaks, NOW), "SHOWING", "corner pictures don't need breaks");
    assert.equal(adShowState(videoAd({ playsBeforeMovie: false }), settings, NOW), "SHOWING");
  });

  it("OUTSIDE_HOURS", () => {
    const evening = { dailyStartTime: "18:00", dailyEndTime: "23:00" };
    assert.equal(adShowState(videoAd(evening), settings, NOW), "OUTSIDE_HOURS");
    assert.equal(adShowState(videoAd(evening), settings, mmtAt(19, 0)), "SHOWING");
    assert.equal(adShowState(cornerAd(evening), settings, NOW), "OUTSIDE_HOURS");
  });

  it("NO_MOVIES: chosen movies, and not one can be watched", () => {
    const chosen = (targetMovies: AdTargetMovie[]) => videoAd({ targetType: "SELECTED", targetMovies });
    assert.equal(adShowState(chosen([]), settings, NOW), "NO_MOVIES", "all deleted: the rows go with the movie");
    assert.equal(adShowState(chosen([movieOf("a", { isVisible: false })]), settings, NOW), "NO_MOVIES");
    assert.equal(adShowState(chosen([movieOf("a", { missing: true })]), settings, NOW), "NO_MOVIES");
    assert.equal(
      adShowState(chosen([movieOf("a", { missing: true }), movieOf("b", { isVisible: false })]), settings, NOW),
      "NO_MOVIES",
    );
    // One published movie is enough for it to show.
    assert.equal(adShowState(chosen([movieOf("a"), movieOf("b", { isVisible: false })]), settings, NOW), "SHOWING");
    // An ad aimed at everything never looks at the list.
    assert.equal(adShowState(videoAd({ targetType: "ALL", targetMovies: [] }), settings, NOW), "SHOWING");
    assert.equal(adShowState(cornerAd({ targetType: "SELECTED", targetMovies: [] }), settings, NOW), "NO_MOVIES");
  });

  it("the settings unknown (null): the two settings checks are skipped", () => {
    assert.equal(adShowState(videoAd({ playsBeforeMovie: false }), null, NOW), "SHOWING");
    assert.equal(adShowState(videoAd({ dailyStartTime: "18:00", dailyEndTime: "23:00" }), null, NOW), "OUTSIDE_HOURS");
    assert.equal(adShowState(videoAd({ isActive: false }), null, NOW), "OFF");
  });

  it("the first match wins, in the documented order", () => {
    assert.deepEqual(
      [...AD_SHOW_STATES],
      ["NEEDS_MEDIA", "OFF", "ENDED", "STARTS_LATER", "NO_MOVIES", "ALL_ADS_OFF", "BREAKS_OFF", "OUTSIDE_HOURS", "SHOWING"],
    );
    const everything = videoAd({
      videoUrl: null,
      isActive: false,
      endsAt: iso(NOW - HOUR),
      playsBeforeMovie: false,
      dailyStartTime: "18:00",
      dailyEndTime: "23:00",
    });
    const blocked = settingsOf({ adsEnabled: false, midrollIntervalMinutes: 0 });
    assert.equal(adShowState(everything, blocked, NOW), "NEEDS_MEDIA");
    assert.equal(adShowState({ ...everything, videoUrl: "v" }, blocked, NOW), "OFF");
    assert.equal(adShowState({ ...everything, videoUrl: "v", isActive: true }, blocked, NOW), "ENDED");
    const later = { ...everything, videoUrl: "v", isActive: true, endsAt: null, startsAt: iso(NOW + HOUR) };
    assert.equal(adShowState(later, blocked, NOW), "STARTS_LATER");
    assert.equal(adShowState({ ...later, targetType: "SELECTED" }, blocked, NOW), "STARTS_LATER");
    const live = { ...later, startsAt: null };
    assert.equal(adShowState({ ...live, targetType: "SELECTED" }, blocked, NOW), "NO_MOVIES", "before the settings");
    assert.equal(adShowState(live, blocked, NOW), "ALL_ADS_OFF");
    assert.equal(adShowState(live, settingsOf({ midrollIntervalMinutes: 0 }), NOW), "BREAKS_OFF");
    assert.equal(adShowState(live, settings, NOW), "OUTSIDE_HOURS");
    assert.equal(adShowState(live, settings, mmtAt(20, 0)), "SHOWING");
  });

  it("every status has a tone; the backend's liveState maps onto the statuses", () => {
    for (const state of AD_SHOW_STATES) assert.ok(AD_SHOW_STATE_TONES[state], state);
    assert.equal(AD_SHOW_STATE_TONES.SHOWING, "success");
    assert.equal(AD_SHOW_STATE_TONES.ALL_ADS_OFF, "warning");
    assert.equal(showStateOfLiveState("LIVE"), "SHOWING");
    assert.equal(showStateOfLiveState("SCHEDULED"), "STARTS_LATER");
    assert.equal(showStateOfLiveState("ENDED"), "ENDED");
    assert.equal(showStateOfLiveState("OFF"), "OFF");
    assert.equal(showStateOfLiveState("NO_VIDEO"), "NEEDS_MEDIA");
  });

  it("liveState with the settings known: the master switch stops a live ad, and only a live one", () => {
    const off = settingsOf({ adsEnabled: false });
    assert.equal(showStateOfLiveState("LIVE", off), "ALL_ADS_OFF");
    assert.equal(showStateOfLiveState("LIVE", settingsOf()), "SHOWING");
    assert.equal(showStateOfLiveState("LIVE", null), "SHOWING");
    // In adShowState's order: the ad's own state comes before the master switch.
    assert.equal(showStateOfLiveState("OFF", off), "OFF");
    assert.equal(showStateOfLiveState("ENDED", off), "ENDED");
    assert.equal(showStateOfLiveState("SCHEDULED", off), "STARTS_LATER");
    assert.equal(showStateOfLiveState("NO_VIDEO", off), "NEEDS_MEDIA");
  });

  it("“Showing” with the settings never read is not claimed as checked", () => {
    assert.equal(showingUnchecked("SHOWING", null), true);
    assert.equal(showingUnchecked("SHOWING", settings), false);
    assert.equal(showingUnchecked("OFF", null), false, "a status that needs no settings stands");
    assert.equal(showingUnchecked("OUTSIDE_HOURS", null), false);
  });
});

describe("diagnoseAd — the “Will it show?” checker", () => {
  const codes = (list: { code: string }[]) => list.map((item) => item.code);

  it("the owner's TEST ad (yes): it has played; the 12-hour break memory is the likely reason he didn't see it", () => {
    const d = diagnoseAd(videoAd(), settingsOf({ midrollIntervalMinutes: 1 }), NOW);
    assert.equal(d.verdict, "CAN_SHOW");
    assert.equal(d.state, "SHOWING");
    assert.equal(d.problems, 0);
    assert.equal(d.played, 12);
    assert.deepEqual(codes(d.checks), ["ALL_ADS", "AD_SWITCH", "MEDIA", "START", "END", "HOURS", "BREAKS"]);
    assert.ok(d.checks.every((check) => check.ok && check.fixes.length === 0));
    const media = d.checks.find((check) => check.code === "MEDIA");
    assert.deepEqual(media?.params, { format: "VIDEO", durationSeconds: 12, imageWidth: null, imageHeight: null });
    assert.deepEqual(codes(d.viewerNotes), ["BREAK_MEMORY", "LAST_MINUTES", "JUMP", "NEXT_OPEN"]);
    assert.deepEqual(d.viewerNotes[1], {
      code: "LAST_MINUTES",
      params: { guardMinutes: 2, intervalMinutes: 1, minMovieMinutes: 3 },
    });
    assert.equal(d.likelyReason, "BREAK_MEMORY");
    assert.deepEqual(d.test, {
      fixFirst: 0,
      anyMovie: false,
      needsNonPremium: false,
      movieLongerThanMinutes: 6,
      notWatchedWithinHours: 12,
      hours: null,
      chosenMovies: null,
      noSkipping: true,
    });
  });

  it("“KBZPay evening cashback” (something to fix): outside its hours, and breaks-only with breaks off", () => {
    const ad = videoAd({
      title: "KBZPay evening cashback",
      playsBeforeMovie: false,
      dailyStartTime: "18:00",
      dailyEndTime: "23:00",
      frequencyLimitMinutes: 60,
      targetType: "SELECTED",
      targetMovies: Array.from({ length: 12 }, (_, i) => ({
        id: `m${i}`,
        title: `Movie ${i}`,
        imageUrl: null,
        isVisible: i !== 0,
        missing: i === 11,
      })),
      counters: { impressions: 0, completions: 0, skips: 0, shows: 0, clicks: 0, closes: 0 },
    });
    const d = diagnoseAd(ad, settingsOf({ midrollIntervalMinutes: 0, duringMovieAudience: "NON_PREMIUM" }), NOW);
    assert.equal(d.verdict, "NOT_NOW");
    assert.equal(d.state, "BREAKS_OFF");
    assert.equal(d.problems, 2);
    assert.equal(d.played, 0);
    const failed = d.checks.filter((check) => !check.ok);
    assert.deepEqual(codes(failed), ["HOURS", "BREAKS"]);
    assert.deepEqual(failed[0].params, { start: "18:00", end: "23:00", overnight: false, now: "14:05" });
    assert.deepEqual(failed[0].fixes, [{ kind: "EDIT", step: "when", openMore: true }], "the hours sit under More options");
    assert.deepEqual(failed[1].fixes, [{ kind: "OPEN_SETTINGS" }, { kind: "ALSO_BEFORE_MOVIE" }]);
    // Breaks are off, so the Premium rule and the break notes don't apply yet.
    assert.deepEqual(codes(d.infoNotes), ["MOVIES", "WAIT"]);
    assert.deepEqual(d.infoNotes[0].params, { count: 12, missing: 1, hidden: 1 });
    assert.deepEqual(d.infoNotes[1].params, { minutes: 60 });
    assert.deepEqual(codes(d.viewerNotes), ["NEXT_OPEN"]);
    assert.deepEqual(d.test, {
      fixFirst: 2,
      anyMovie: false,
      needsNonPremium: true,
      movieLongerThanMinutes: null,
      notWatchedWithinHours: 12,
      hours: { start: "18:00", end: "23:00" },
      chosenMovies: 12,
      noSkipping: true,
    });
  });

  it("the settings unknown: no settings checks, and a clean ad reads UNKNOWN", () => {
    const d = diagnoseAd(videoAd(), null, NOW);
    assert.equal(d.verdict, "UNKNOWN");
    assert.deepEqual(codes(d.checks), ["AD_SWITCH", "MEDIA", "START", "END", "HOURS"]);
    assert.deepEqual(codes(d.infoNotes), []);
    assert.deepEqual(d.viewerNotes[1].params, { guardMinutes: 2, intervalMinutes: null, minMovieMinutes: null });
    assert.equal(d.test.needsNonPremium, true, "unknown audience: test with an account without Premium");
    assert.equal(d.test.movieLongerThanMinutes, null, "a break test can't name a length without the interval");
    // A corner picture doesn't depend on it.
    assert.equal(diagnoseAd(cornerAd(), null, NOW).test.movieLongerThanMinutes, 5);
    // Nor can a break test name a length with breaks off: the fix picks the interval later.
    assert.equal(
      diagnoseAd(videoAd({ playsBeforeMovie: false }), settingsOf({ midrollIntervalMinutes: 0 }), NOW).test
        .movieLongerThanMinutes,
      null,
    );
    // Something certain still says no.
    assert.equal(diagnoseAd(videoAd({ isActive: false }), null, NOW).verdict, "NOT_NOW");
  });

  it("a break test says to start the movie from the beginning; a corner test doesn't need to", () => {
    // A player resuming a movie skips every break before that point (midrollStart).
    const { whyEn, whyMm } = load("../../lib/i18n/ads/why.ts") as typeof import("@/lib/i18n/ads/why");
    const languages = [
      [whyEn.test, "start it from the beginning"],
      [whyMm.test, "အစမှ စကြည့်ပါ"],
    ] as const;
    for (const [test, words] of languages) {
      assert.ok(test.movie("35 min", 12).includes(words));
      assert.ok(test.chosenMovie(1, "35 min", 12).includes(words));
      assert.ok(test.chosenMovie(3, "35 min", 12).includes(words));
      assert.ok(!test.movie("5 min", null).includes(words));
      assert.ok(!test.chosenMovie(3, "5 min", null).includes(words));
    }
  });

  it("turned off: TURN_ON only once it has its video, else the video is the fix", () => {
    const withVideo = diagnoseAd(videoAd({ isActive: false }), settingsOf(), NOW);
    assert.deepEqual(withVideo.checks.find((check) => check.code === "AD_SWITCH")?.fixes, [{ kind: "TURN_ON" }]);
    const without = diagnoseAd(videoAd({ isActive: false, videoUrl: null }), settingsOf(), NOW);
    assert.equal(without.problems, 2);
    assert.deepEqual(without.checks.find((check) => check.code === "AD_SWITCH")?.fixes, []);
    assert.deepEqual(without.checks.find((check) => check.code === "MEDIA")?.fixes, [{ kind: "EDIT", step: "media" }]);
  });

  it("dates and the master switch carry their fixes", () => {
    const off = diagnoseAd(videoAd(), settingsOf({ adsEnabled: false }), NOW);
    assert.deepEqual(off.checks[0], { code: "ALL_ADS", ok: false, params: {}, fixes: [{ kind: "OPEN_SETTINGS" }] });
    const later = diagnoseAd(videoAd({ startsAt: iso(NOW + HOUR) }), settingsOf(), NOW);
    const start = later.checks.find((check) => check.code === "START");
    assert.equal(start?.ok, false);
    assert.deepEqual(start?.fixes, [{ kind: "EDIT", step: "when" }]);
    const ended = diagnoseAd(videoAd({ endsAt: iso(NOW - HOUR) }), settingsOf(), NOW);
    assert.deepEqual(codes(ended.checks.filter((check) => !check.ok)), ["END"]);
  });

  it("a corner picture: no breaks check; its own viewer rules; the minute of watching is the likely reason", () => {
    const d = diagnoseAd(cornerAd(), settingsOf(), NOW);
    assert.equal(d.verdict, "CAN_SHOW");
    assert.deepEqual(codes(d.checks), ["ALL_ADS", "AD_SWITCH", "MEDIA", "START", "END", "HOURS"]);
    assert.deepEqual(codes(d.viewerNotes), ["CORNER_FIRST", "CORNER_HIDES", "CORNER_CLOSE", "NEXT_OPEN"]);
    assert.deepEqual(d.viewerNotes[0].params, { afterMinutes: 1, neverUpToMinutes: 3 });
    assert.equal(d.likelyReason, "CORNER_FIRST");
    assert.equal(d.test.movieLongerThanMinutes, 5);
    assert.equal(d.test.notWatchedWithinHours, null);
    const notClosable = diagnoseAd(cornerAd({ cornerClosable: false }), settingsOf(), NOW);
    assert.ok(!codes(notClosable.viewerNotes).includes("CORNER_CLOSE"));
  });

  it("Premium: only for breaks and the corner, only with “Only people without Premium”", () => {
    const nonPremium = settingsOf({ duringMovieAudience: "NON_PREMIUM" });
    const both = diagnoseAd(videoAd(), nonPremium, NOW);
    assert.deepEqual(both.infoNotes[0], { code: "AUDIENCE", params: { format: "VIDEO", playsBeforeMovie: true } });
    const corner = diagnoseAd(cornerAd(), nonPremium, NOW);
    assert.deepEqual(corner.infoNotes[0], { code: "AUDIENCE", params: { format: "CORNER", playsBeforeMovie: false } });
    assert.equal(corner.likelyReason, "AUDIENCE");
    const beforeOnly = diagnoseAd(videoAd({ playsAtBreaks: false }), nonPremium, NOW);
    assert.deepEqual(codes(beforeOnly.infoNotes), []);
    assert.deepEqual(codes(diagnoseAd(videoAd(), settingsOf(), NOW).infoNotes), []);
  });

  it("before the movie only: any movie works, no in-movie rules, no likely reason", () => {
    const d = diagnoseAd(videoAd({ playsAtBreaks: false }), settingsOf(), NOW);
    assert.deepEqual(codes(d.checks), ["ALL_ADS", "AD_SWITCH", "MEDIA", "START", "END", "HOURS", "BREAKS"]);
    assert.deepEqual(codes(d.viewerNotes), ["NEXT_OPEN"]);
    assert.equal(d.likelyReason, null);
    assert.equal(d.test.anyMovie, true);
    assert.equal(d.test.movieLongerThanMinutes, null);
    assert.equal(d.test.needsNonPremium, false);
    assert.equal(d.test.noSkipping, false);
    // In both places while breaks are off: tested before the movie too.
    const bothNoBreaks = diagnoseAd(videoAd(), settingsOf({ midrollIntervalMinutes: 0 }), NOW);
    assert.equal(bothNoBreaks.verdict, "CAN_SHOW");
    assert.equal(bothNoBreaks.test.anyMovie, true);
    assert.equal(bothNoBreaks.test.notWatchedWithinHours, null);
  });

  it("chosen movies: a check of its own, which fails when not one can be watched", () => {
    const check = (d: ReturnType<typeof diagnoseAd>) => d.checks.find((item) => item.code === "MOVIES_OK");
    const none = diagnoseAd(videoAd({ targetType: "SELECTED", targetMovies: [] }), settingsOf(), NOW);
    assert.equal(none.verdict, "NOT_NOW");
    assert.equal(none.state, "NO_MOVIES");
    assert.equal(none.problems, 1);
    assert.deepEqual(check(none), {
      code: "MOVIES_OK",
      ok: false,
      params: { count: 0, missing: 0, hidden: 0 },
      fixes: [{ kind: "EDIT", step: "movies" }],
    });
    assert.deepEqual(
      codes(none.checks),
      ["ALL_ADS", "AD_SWITCH", "MEDIA", "START", "END", "MOVIES_OK", "HOURS", "BREAKS"],
    );

    const hidden = diagnoseAd(
      videoAd({ targetType: "SELECTED", targetMovies: [movieOf("a", { isVisible: false })] }),
      settingsOf(),
      NOW,
    );
    assert.equal(hidden.verdict, "NOT_NOW");
    assert.deepEqual(check(hidden)?.params, { count: 1, missing: 0, hidden: 1 });

    const one = diagnoseAd(
      videoAd({ targetType: "SELECTED", targetMovies: [movieOf("a"), movieOf("b", { isVisible: false })] }),
      settingsOf(),
      NOW,
    );
    assert.equal(one.verdict, "CAN_SHOW");
    assert.equal(check(one)?.ok, true);
    assert.deepEqual(check(one)?.fixes, []);

    // Aimed at everything: there is nothing to check.
    assert.equal(check(diagnoseAd(videoAd(), settingsOf(), NOW)), undefined);
  });

  it("limits: noted when set, and named as the likely reason before sharing", () => {
    const d = diagnoseAd(
      videoAd({ playsAtBreaks: false, frequencyLimitMinutes: 60, maxImpressionsPerUserPerDay: 3 }),
      settingsOf({ liveCounts: { preroll: 3, breaks: 0, corner: 0 } }),
      NOW,
    );
    assert.deepEqual(codes(d.infoNotes), ["WAIT", "PER_DAY", "SHARING"]);
    assert.deepEqual(d.infoNotes[1].params, { times: 3, format: "VIDEO" });
    assert.equal(d.likelyReason, "PER_DAY");
  });

  it("sharing: other live ads per place, this ad taken out of the counts only when it is counted", () => {
    const counts = { preroll: 3, breaks: 2, corner: 1 };
    const live = diagnoseAd(videoAd({ priority: 5 }), settingsOf({ liveCounts: counts }), NOW);
    assert.deepEqual(live.infoNotes.find((note) => note.code === "SHARING")?.params, {
      slots: [
        { slot: "PREROLL", others: 2 },
        { slot: "MIDROLL", others: 1 },
      ],
      priority: 5,
    });
    // Switched off, it is not in the counts: every live ad is another one.
    const off = diagnoseAd(videoAd({ isActive: false }), settingsOf({ liveCounts: counts }), NOW);
    assert.deepEqual(off.infoNotes.find((note) => note.code === "SHARING")?.params, {
      slots: [
        { slot: "PREROLL", others: 3 },
        { slot: "MIDROLL", others: 2 },
      ],
      priority: 0,
    });
    // Breaks off: nobody shares a break that never comes.
    const noBreaks = diagnoseAd(videoAd(), settingsOf({ midrollIntervalMinutes: 0, liveCounts: counts }), NOW);
    assert.deepEqual(noBreaks.infoNotes.find((note) => note.code === "SHARING")?.params.slots, [
      { slot: "PREROLL", others: 2 },
    ]);
    // Ads off: nothing plays, so nothing is shared.
    assert.equal(
      diagnoseAd(videoAd(), settingsOf({ adsEnabled: false, liveCounts: counts }), NOW).infoNotes.some(
        (note) => note.code === "SHARING",
      ),
      false,
    );
    // Alone in its place: no note.
    assert.equal(
      diagnoseAd(cornerAd(), settingsOf({ liveCounts: counts }), NOW).infoNotes.some((note) => note.code === "SHARING"),
      false,
    );
  });

  it("the verdict agrees with the list's status, and the problem count with the failed checks", () => {
    const ads = [
      videoAd(),
      videoAd({ playsBeforeMovie: false }),
      videoAd({ isActive: false }),
      videoAd({ videoUrl: null }),
      videoAd({ endsAt: iso(NOW - HOUR) }),
      videoAd({ startsAt: iso(NOW + HOUR) }),
      videoAd({ dailyStartTime: "22:00", dailyEndTime: "02:00" }),
      cornerAd(),
      cornerAd({ imageUrl: null, isActive: false }),
      videoAd({ targetType: "SELECTED", targetMovies: [] }),
      cornerAd({ targetType: "SELECTED", targetMovies: [movieOf("a", { isVisible: false })] }),
      videoAd({ targetType: "SELECTED", targetMovies: [movieOf("a")] }),
    ];
    const settingsList = [
      settingsOf(),
      settingsOf({ adsEnabled: false }),
      settingsOf({ midrollIntervalMinutes: 0 }),
    ];
    for (const ad of ads) {
      for (const settings of settingsList) {
        const d = diagnoseAd(ad, settings, NOW);
        const state = adShowState(ad, settings, NOW);
        assert.equal(d.state, state);
        assert.equal(d.verdict === "CAN_SHOW", state === "SHOWING", `${ad.title} / ${JSON.stringify(settings)}`);
        assert.equal(d.problems, d.checks.filter((check) => !check.ok).length);
        assert.equal(d.test.fixFirst, d.problems);
      }
    }
  });
});
