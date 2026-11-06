/**
 * Advertisements copy for the “Ad results” page (the `Results` board, SPEC
 * §4) (2026-11-04, docs/ads-admin-ux-2026-11-04). Owned by Stage R of
 * BUILD-BRIEF.md; read as `t.adsUi.results.*`. English first, then the
 * Burmese typed against it, so a key missing in Burmese is a compile error.
 * Words more than one part uses live in shared.ts.
 *
 * Every name says what the number counts, exactly as the backend counts it
 * (backend/src/ads/ad-analytics.service.ts): a "play" is a video ad that
 * started, a "viewing" is one movie opening in which a corner picture first
 * appeared, "on screen" is every time it appeared (come-backs included).
 *
 * The summary sentences are templates: `{plays}`, `{people}`… stand for the
 * numbers, which the page fills in and shows in bold (ResultsSummary.tsx).
 * The functions take the raw counts only to choose "time" or "times".
 */

/** "1 time" / "2 times" — the English plural; Burmese needs none. */
const times = (count: number) => (count === 1 ? "time" : "times");

/** "1 person" / "2 people". */
const people = (count: number) => (count === 1 ? "person" : "people");

/** "1,204" — the admin's en-US grouping, as components/lottery/analytics/format.ts `formatCount`. */
const grouped = (count: number) => Math.round(count).toLocaleString("en-US");

export const resultsEn = {
  title: "Ad results",
  description: "How often your ads were played, watched and tapped.",
  /** `when` "14:05", or "3 Nov, 14:05" once the figures are from an earlier day. */
  updated: (when: string) => `Updated ${when}`,
  filters: {
    period: "Time period",
    ad: "Which ad",
    where: "Where",
    allAds: "All ads",
    allPlaces: "All",
    adsLoadError: "The list of ads didn’t load, so you can’t pick one ad. The results show all ads.",
    /** The custom-dates chip and its dialog (the shared lottery control, in this page's words). */
    pickDates: "Pick dates…",
    /** `range` "Thu 16–Wed 22 Oct 2026". */
    pickedDates: (range: string) => `Dates · ${range}`,
    pickDatesTitle: "Pick dates",
    pickDatesNote:
      "All times are Myanmar time. The results compare these dates with the same number of days just before them, when there is data for it.",
    download: "Download (Excel / CSV)",
    downloaded: (file: string) => `${file} downloaded. All times are Myanmar time.`,
  },
  /** The period's name at the start of the summary ("Last 7 days: …"); a picked range is named by its dates. */
  periods: {
    today: "Today so far",
    yesterday: "Yesterday",
    last7: "Last 7 days",
    last30: "Last 30 days",
    month: "This month so far",
  },
  /** The dates line under the filters: "Thu 28 Oct–Wed 3 Nov 2026 · compared with Thu 21–Wed 27 Oct". */
  dates: {
    /** A period that ends today stops at the moment the figures were read. */
    upTo: (dates: string, time: string) => `${dates}, up to ${time}`,
    comparedWith: (dates: string) => `compared with ${dates}`,
    /** Today so far is compared with the whole of the day before. */
    comparedWithWholeDay: (day: string) => `compared with all of ${day}`,
  },
  /** The line at the foot of each card. `change` "+12%", "−4%" or "0%". */
  trend: {
    days: (change: string, days: number) => `${change} compared with the ${days} days before`,
    dayBefore: (change: string) => `${change} compared with the day before`,
    wholeYesterday: (change: string) => `${change} compared with all of yesterday`,
    nothingBefore: "Nothing to compare with yet",
  },
  /**
   * The one-sentence summary above the cards. `{period}` is the period (with
   * the ad and the place when one is picked); the other tokens are numbers.
   * "People" are counted once each, over every ad the filters let in — so
   * when video ads and corner pictures are both counted, the people get a
   * sentence of their own instead of being pinned on the video ads.
   */
  summary: {
    video: (n: { plays: number; people: number }) =>
      `{period}: your video ads played {plays} ${times(n.plays)} to {people} ${people(n.people)}, and {watched} were watched to the end.`,
    videoOneAd: (n: { plays: number; people: number }) =>
      `{period}: this ad played {plays} ${times(n.plays)} to {people} ${people(n.people)}, and {watched} were watched to the end.`,
    corner: (n: { shows: number; viewings: number; people: number; taps: number }) =>
      `{period}: your corner pictures were on screen {shows} ${times(n.shows)} in {viewings} movie ${n.viewings === 1 ? "viewing" : "viewings"}, seen by {people} ${people(n.people)}, and tapped {taps} ${times(n.taps)}.`,
    cornerOneAd: (n: { shows: number; viewings: number; people: number; taps: number }) =>
      `{period}: this picture was on screen {shows} ${times(n.shows)} in {viewings} movie ${n.viewings === 1 ? "viewing" : "viewings"}, seen by {people} ${people(n.people)}, and tapped {taps} ${times(n.taps)}.`,
    both: (n: { plays: number; shows: number; taps: number; people: number }) =>
      `{period}: your video ads played {plays} ${times(n.plays)}, and {watched} were watched to the end. Corner pictures were on screen {shows} ${times(n.shows)} and tapped {taps} ${times(n.taps)}. In all, {people} ${people(n.people)} got at least one ad.`,
  },
  /** The cards' names — the Words board's "Results" rows. */
  cards: {
    played: "Times played",
    watched: "Watched to the end",
    skipped: "Skipped",
    people: "People reached",
    onScreen: "Times on screen",
    taps: "Taps",
    tapsPerViewing: "Taps per viewing",
    closed: "Closed with ✕",
  },
  /** The small line under a card's number. Counts and shares arrive formatted ("1,610", "57%"), except `viewings`, which chooses the word by its count. */
  notes: {
    platforms: (web: string, phone: string) => `Website ${web} · Phone app ${phone}`,
    /** The Times played card while corner pictures are counted too: it holds video ads only. */
    videoOnly: "Video ads only · corner pictures are below",
    ofPlays: (share: string) => `${share} of plays`,
    failed: (didNotLoad: string, stopped: string) => `${didNotLoad} didn’t load · ${stopped} stopped by an error`,
    viewings: (count: number) => `in ${grouped(count)} movie ${count === 1 ? "viewing" : "viewings"}`,
    taps: "taps that opened your web page",
    ofViewings: (share: string) => `${share} of viewings`,
  },
  /** What each card's (?) says: one plain sentence on what the number counts, and what its percentage is out of. */
  help: {
    played:
      "Each time a video ad started playing, before a movie or at an ad break. One person can count more than once.",
    /** Added under "All" while corner pictures are counted too. */
    playedVideoOnly: "Corner pictures are counted on their own, below.",
    watched:
      "Video ads that played to the very end without being skipped. The percentage is out of the times played.",
    skipped:
      "Video ads a viewer skipped with the Skip button — only ads that allow skipping can be skipped. The percentage is out of the times played.",
    people:
      "How many different viewers got at least one of these ads; each person counts once. The line under it counts ads that didn’t load at all, and ads that started but stopped because of an error.",
    onScreen:
      "Each time a corner picture appeared on screen: the first time in a movie, and every time it came back. The line under it counts the movie viewings it appeared in.",
    taps: "How many times viewers tapped a corner picture and opened its web page.",
    tapsPerViewing:
      "Taps for every 100 movie viewings a corner picture appeared in, as a percentage.",
    closed:
      "How many times viewers closed a corner picture with its ✕. The percentage is out of the movie viewings it appeared in.",
  },
  chart: {
    title: "Day by day",
    /** `scope` "Last 7 days · All ads". */
    description: (scope: string) => `${scope}. Each group of bars is one day.`,
    /** The bars: a video ad's three counts, or a corner picture's. */
    series: {
      played: "Times played",
      watched: "Watched to the end",
      skipped: "Skipped",
      viewings: "Movie viewings",
      taps: "Taps",
      closed: "Closed with ✕",
    },
    axis: "Days in Myanmar time",
  },
  table: {
    title: "Each ad",
    description: (dates: string) => `Every ad and its results for ${dates}. Ads that didn’t play show 0.`,
    /** With one place picked under Where, the table counts that place only (`where` from `places`). */
    descriptionWhere: (dates: string, where: string) =>
      `Every ad and its results for ${dates}, counting ${where} only. Ads that didn’t play there show 0.`,
    /** The places as they read inside that sentence. */
    places: {
      PREROLL: "plays before the movie",
      MIDROLL: "plays at ad breaks",
      CORNER: "corner pictures",
    },
    columns: {
      ad: "Ad",
      type: "Type",
      status: "Status",
      played: "Times played",
      watched: "Watched to the end",
      skipped: "Skipped",
      taps: "Taps",
    },
    /** A corner picture's "Times played" cell: how often it was on screen, and in how many viewings. */
    onScreen: (count: number) => `on screen ${grouped(count)} ${times(count)}`,
    inViewings: (count: number) => `in ${grouped(count)} ${count === 1 ? "viewing" : "viewings"}`,
    empty: "No ads yet.",
  },
  states: {
    loading: (scope: string) => `Loading ${scope}…`,
    errorTitle: "The results didn’t load",
    errorDescription: (dates: string) =>
      `The results for ${dates} didn’t come back. Nothing was changed. Check your connection and try again.`,
    partError: "This part didn’t load.",
    emptyTitle: "Nothing played in this period",
    emptyAll: (dates: string) => `No ad played or showed in this period (${dates}). Try a longer time period.`,
    emptyOneAd: (title: string, dates: string) =>
      `“${title}” didn’t play or show in this period (${dates}). Try a longer time period or all ads.`,
    showLast30: "Show the last 30 days",
    allAds: "All ads",
    allPlaces: "All places",
  },
};

export const resultsMm = {
  title: "ကြော်ငြာ ရလဒ်များ",
  description: "သင့်ကြော်ငြာများကို ဘယ်နှကြိမ် ဖွင့်ပြခဲ့သလဲ၊ ကြည့်ခဲ့သလဲ၊ နှိပ်ခဲ့သလဲ။",
  updated: (when: string) => `${when} တွင် နောက်ဆုံး ရယူခဲ့သည်`,
  filters: {
    period: "အချိန်ကာလ",
    ad: "ဘယ်ကြော်ငြာ",
    where: "ဘယ်နေရာ",
    allAds: "ကြော်ငြာ အားလုံး",
    allPlaces: "အားလုံး",
    adsLoadError:
      "ကြော်ငြာ စာရင်းကို ဖွင့်၍ မရသဖြင့် ကြော်ငြာ တစ်ခုကို ရွေး၍ မရပါ။ ရလဒ်များသည် ကြော်ငြာ အားလုံးအတွက် ဖြစ်သည်။",
    pickDates: "ရက် ရွေးမည်…",
    pickedDates: (range: string) => `ရက်စွဲ · ${range}`,
    pickDatesTitle: "ရက် ရွေးမည်",
    pickDatesNote:
      "အချိန်အားလုံးသည် မြန်မာစံတော်ချိန် ဖြစ်သည်။ အချက်အလက် ရှိလျှင် ဤရက်များကို ၎င်းတို့ မတိုင်မီ ရက်အရေအတွက် တူသော ကာလနှင့် နှိုင်းယှဉ်ပြသည်။",
    download: "ဒေါင်းလုဒ် (Excel / CSV)",
    downloaded: (file: string) => `${file} ကို ဒေါင်းလုဒ်ဆွဲပြီး။ အချိန်အားလုံးသည် မြန်မာစံတော်ချိန် ဖြစ်သည်။`,
  },
  periods: {
    today: "ယနေ့ ယခုအချိန်ထိ",
    yesterday: "မနေ့က",
    last7: "နောက်ဆုံး 7 ရက်",
    last30: "နောက်ဆုံး 30 ရက်",
    month: "ယခုလ ယခုအချိန်ထိ",
  },
  dates: {
    upTo: (dates: string, time: string) => `${dates}၊ ${time} အထိ`,
    comparedWith: (dates: string) => `${dates} နှင့် နှိုင်းယှဉ်ထားသည်`,
    comparedWithWholeDay: (day: string) => `${day} တစ်နေ့လုံးနှင့် နှိုင်းယှဉ်ထားသည်`,
  },
  trend: {
    days: (change: string, days: number) => `ယခင် ${days} ရက်နှင့် နှိုင်းယှဉ်လျှင် ${change}`,
    dayBefore: (change: string) => `ယခင်နေ့နှင့် နှိုင်းယှဉ်လျှင် ${change}`,
    wholeYesterday: (change: string) => `မနေ့ တစ်နေ့လုံးနှင့် နှိုင်းယှဉ်လျှင် ${change}`,
    nothingBefore: "နှိုင်းယှဉ်စရာ မရှိသေးပါ",
  },
  summary: {
    video: () =>
      "{period} — သင့် ဗီဒီယို ကြော်ငြာများကို လူ {people} ဦးထံ {plays} ကြိမ် ဖွင့်ပြခဲ့ပြီး {watched} ကို အဆုံးထိ ကြည့်ခဲ့သည်။",
    videoOneAd: () =>
      "{period} — ဤကြော်ငြာကို လူ {people} ဦးထံ {plays} ကြိမ် ဖွင့်ပြခဲ့ပြီး {watched} ကို အဆုံးထိ ကြည့်ခဲ့သည်။",
    corner: () =>
      "{period} — သင့် ထောင့်ပုံ ကြော်ငြာများသည် ရုပ်ရှင်ကြည့်မှု {viewings} ခုတွင် {shows} ကြိမ် ပေါ်ခဲ့ပြီး လူ {people} ဦး မြင်ခဲ့သည်။ {taps} ကြိမ် နှိပ်ခဲ့သည်။",
    cornerOneAd: () =>
      "{period} — ဤပုံသည် ရုပ်ရှင်ကြည့်မှု {viewings} ခုတွင် {shows} ကြိမ် ပေါ်ခဲ့ပြီး လူ {people} ဦး မြင်ခဲ့သည်။ {taps} ကြိမ် နှိပ်ခဲ့သည်။",
    both: () =>
      "{period} — သင့် ဗီဒီယို ကြော်ငြာများကို {plays} ကြိမ် ဖွင့်ပြခဲ့ပြီး {watched} ကို အဆုံးထိ ကြည့်ခဲ့သည်။ ထောင့်ပုံ ကြော်ငြာများသည် {shows} ကြိမ် ပေါ်ခဲ့ပြီး {taps} ကြိမ် နှိပ်ခဲ့သည်။ စုစုပေါင်း လူ {people} ဦးသည် ကြော်ငြာ အနည်းဆုံး တစ်ခု မြင်ခဲ့သည်။",
  },
  cards: {
    played: "ဖွင့်ပြခဲ့သည့် အကြိမ်",
    watched: "အဆုံးထိ ကြည့်ခဲ့သည်",
    skipped: "ကျော်ခဲ့သည်",
    people: "ကြော်ငြာ မြင်ခဲ့သူ",
    onScreen: "ပေါ်ခဲ့သည့် အကြိမ်",
    taps: "နှိပ်မှု",
    tapsPerViewing: "ကြည့်မှုတစ်ခုလျှင် နှိပ်မှုနှုန်း",
    closed: "✕ ဖြင့် ပိတ်ခဲ့သည်",
  },
  notes: {
    platforms: (web: string, phone: string) => `ဝက်ဘ်ဆိုက် ${web} · ဖုန်းအက်ပ် ${phone}`,
    videoOnly: "ဗီဒီယို ကြော်ငြာများသာ · ထောင့်ပုံ ကြော်ငြာများကို အောက်တွင် ကြည့်ပါ",
    ofPlays: (share: string) => `ဖွင့်ပြခဲ့သည့် အကြိမ်၏ ${share}`,
    failed: (didNotLoad: string, stopped: string) =>
      `${didNotLoad} ကြိမ် ဖွင့်၍ မရ · ${stopped} ကြိမ် အမှားကြောင့် ရပ်သွား`,
    viewings: (count: number) => `ရုပ်ရှင်ကြည့်မှု ${grouped(count)} ခုတွင်`,
    taps: "သင့် ဝက်ဘ်စာမျက်နှာကို ဖွင့်ခဲ့သည့် နှိပ်မှု",
    ofViewings: (share: string) => `ကြည့်မှုများ၏ ${share}`,
  },
  help: {
    played:
      "ရုပ်ရှင် မစမီ သို့မဟုတ် ကြားဖြတ်ကြော်ငြာ အချိန်တွင် ဗီဒီယို ကြော်ငြာ တစ်ခု စဖွင့်တိုင်း တစ်ကြိမ် ရေတွက်သည်။ လူတစ်ဦးကို တစ်ကြိမ်ထက် ပို၍ ရေတွက်နိုင်သည်။",
    playedVideoOnly: "ထောင့်ပုံ ကြော်ငြာများကို အောက်တွင် သီးသန့် ရေတွက်ထားသည်။",
    watched:
      "မကျော်ဘဲ အဆုံးထိ ဖွင့်ခဲ့သည့် ဗီဒီယို ကြော်ငြာများ။ ရာခိုင်နှုန်းသည် ဖွင့်ပြခဲ့သည့် အကြိမ်ထဲမှ ဖြစ်သည်။",
    skipped:
      "ကြည့်သူက ကျော်ရန် ခလုတ်ဖြင့် ကျော်ခဲ့သည့် ဗီဒီယို ကြော်ငြာများ — ကျော်ခွင့်ပေးထားသော ကြော်ငြာများကိုသာ ကျော်နိုင်သည်။ ရာခိုင်နှုန်းသည် ဖွင့်ပြခဲ့သည့် အကြိမ်ထဲမှ ဖြစ်သည်။",
    people:
      "ဤကြော်ငြာများထဲမှ အနည်းဆုံး တစ်ခု ရခဲ့သည့် ကြည့်သူ အရေအတွက်။ လူတစ်ဦးကို တစ်ကြိမ်သာ ရေတွက်သည်။ အောက်ရှိ စာကြောင်းသည် လုံးဝ ဖွင့်၍ မရခဲ့သော ကြော်ငြာများနှင့် စဖွင့်ပြီးမှ အမှားကြောင့် ရပ်သွားသော ကြော်ငြာများကို ရေတွက်သည်။",
    onScreen:
      "ထောင့်ပုံ ကြော်ငြာ ဖန်သားပြင်ပေါ် ပေါ်လာတိုင်း တစ်ကြိမ် ရေတွက်သည် — ရုပ်ရှင်တစ်ကားတွင် ပထမဆုံး ပေါ်ချိန်နှင့် ပြန်ပေါ်လာတိုင်း။ အောက်ရှိ စာကြောင်းသည် ၎င်း ပေါ်ခဲ့သည့် ရုပ်ရှင်ကြည့်မှု အရေအတွက် ဖြစ်သည်။",
    taps: "ကြည့်သူများက ထောင့်ပုံကို နှိပ်ပြီး ၎င်း၏ ဝက်ဘ်စာမျက်နှာကို ဖွင့်ခဲ့သည့် အကြိမ်ရေ။",
    tapsPerViewing: "ထောင့်ပုံ ပေါ်ခဲ့သည့် ရုပ်ရှင်ကြည့်မှု 100 ခုလျှင် နှိပ်မှု အရေအတွက်ကို ရာခိုင်နှုန်းဖြင့် ပြသည်။",
    closed:
      "ကြည့်သူများက ထောင့်ပုံကို ✕ ဖြင့် ပိတ်ခဲ့သည့် အကြိမ်ရေ။ ရာခိုင်နှုန်းသည် ၎င်း ပေါ်ခဲ့သည့် ရုပ်ရှင်ကြည့်မှုများထဲမှ ဖြစ်သည်။",
  },
  chart: {
    title: "ရက်အလိုက်",
    description: (scope: string) => `${scope}။ ဘားတိုင် အုပ်စု တစ်ခုသည် တစ်ရက် ဖြစ်သည်။`,
    series: {
      played: "ဖွင့်ပြခဲ့သည့် အကြိမ်",
      watched: "အဆုံးထိ ကြည့်ခဲ့သည်",
      skipped: "ကျော်ခဲ့သည်",
      viewings: "ရုပ်ရှင်ကြည့်မှု",
      taps: "နှိပ်မှု",
      closed: "✕ ဖြင့် ပိတ်ခဲ့သည်",
    },
    axis: "ရက်များကို မြန်မာစံတော်ချိန်ဖြင့် ပြထားသည်",
  },
  table: {
    title: "ကြော်ငြာ တစ်ခုချင်းစီ",
    description: (dates: string) =>
      `${dates} အတွက် ကြော်ငြာတိုင်းနှင့် ၎င်း၏ ရလဒ်များ။ မဖွင့်ပြခဲ့ရသော ကြော်ငြာများကို 0 ဟု ပြသည်။`,
    descriptionWhere: (dates: string, where: string) =>
      `${dates} အတွက် ကြော်ငြာတိုင်းနှင့် ၎င်း၏ ရလဒ်များ — ${where}ကိုသာ ရေတွက်ထားသည်။ ထိုနေရာတွင် မဖွင့်ပြခဲ့ရသော ကြော်ငြာများကို 0 ဟု ပြသည်။`,
    places: {
      PREROLL: "ရုပ်ရှင် မစမီ ဖွင့်ပြခဲ့မှုများ",
      MIDROLL: "ကြားဖြတ်ကြော်ငြာ အချိန်တွင် ဖွင့်ပြခဲ့မှုများ",
      CORNER: "ထောင့်ပုံ ကြော်ငြာများ",
    },
    columns: {
      ad: "ကြော်ငြာ",
      type: "အမျိုးအစား",
      status: "အခြေအနေ",
      played: "ဖွင့်ပြခဲ့သည့် အကြိမ်",
      watched: "အဆုံးထိ ကြည့်ခဲ့သည်",
      skipped: "ကျော်ခဲ့သည်",
      taps: "နှိပ်မှု",
    },
    onScreen: (count: number) => `${grouped(count)} ကြိမ် ပေါ်ခဲ့သည်`,
    inViewings: (count: number) => `ကြည့်မှု ${grouped(count)} ခုတွင်`,
    empty: "ကြော်ငြာ မရှိသေးပါ။",
  },
  states: {
    loading: (scope: string) => `${scope} ကို ဖွင့်နေသည်…`,
    errorTitle: "ရလဒ်များကို ဖွင့်၍ မရပါ",
    errorDescription: (dates: string) =>
      `${dates} အတွက် ရလဒ်များ ပြန်မရောက်လာပါ။ ဘာမှ မပြောင်းလဲပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ပြီး ထပ်ကြိုးစားပါ။`,
    partError: "ဤအပိုင်းကို ဖွင့်၍ မရပါ။",
    emptyTitle: "ဤကာလတွင် ဘာမှ မဖွင့်ပြခဲ့ရပါ",
    emptyAll: (dates: string) =>
      `ဤကာလ (${dates}) တွင် ကြော်ငြာ တစ်ခုမှ မဖွင့်ပြခဲ့ရ၊ မပေါ်ခဲ့ရပါ။ အချိန်ကာလ ပိုရှည်ရှည် ရွေးကြည့်ပါ။`,
    emptyOneAd: (title: string, dates: string) =>
      `ဤကာလ (${dates}) တွင် “${title}” ကို မဖွင့်ပြခဲ့ရ၊ မပေါ်ခဲ့ရပါ။ အချိန်ကာလ ပိုရှည်ရှည် သို့မဟုတ် ကြော်ငြာ အားလုံးကို ရွေးကြည့်ပါ။`,
    showLast30: "နောက်ဆုံး 30 ရက်ကို ပြမည်",
    allAds: "ကြော်ငြာ အားလုံး",
    allPlaces: "နေရာ အားလုံး",
  },
} satisfies typeof resultsEn;
