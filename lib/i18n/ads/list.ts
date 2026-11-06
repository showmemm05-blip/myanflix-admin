/**
 * Advertisements copy for the Advertisements list page: the header, the
 * toolbar, the table, the phone cards and the row actions (the `Main` and
 * `PhoneList` boards) (2026-11-04, docs/ads-admin-ux-2026-11-04). Owned by
 * Stage L of BUILD-BRIEF.md; read as `t.adsUi.list.*`. English first, then
 * the Burmese typed against it, so a key missing in Burmese is a compile
 * error. Words more than one part uses live in shared.ts.
 *
 * Also the Preview dialog's words (components/ads/AdPreviewDialog.tsx),
 * which says what a row says, at full size. Counts come in already written
 * ("1,204"), with the number beside them where English needs it for "once"
 * / "1 viewing"; times as words ("15 min", "1 h"); dates as "10 Nov 2026"
 * in Myanmar time.
 */

export const listEn = {
  title: "Advertisements",
  description:
    "Short video ads and small corner pictures that viewers see while they watch — on the website and in the phone app.",
  readOnly: "You can look at these but not change them.",
  loadError: "Could not load the ads.",
  emptyTitle: "No ads yet",
  emptyDescription: "Make a video ad or a corner picture, choose where and when it shows, then turn it on.",
  noMatches: "No ads match. Try another name, or set Type and Status back to All.",
  /** The toolbar. */
  search: "Find an ad by name…",
  searchLabel: "Find an ad by name",
  typeLabel: "Type",
  statusLabel: "Status",
  all: "All",
  /**
   * The Status filter runs on the server's live state (on, with its video or
   * picture, inside its dates), so "Active" includes ads that are paused by
   * Ad settings or outside their hours — the row's badge says which.
   */
  statusFilters: {
    LIVE: "Active",
    SCHEDULED: "Starts later",
    ENDED: "Finished",
    OFF: "Turned off",
    NO_VIDEO: "Needs video or picture",
  },
  columns: {
    ad: "Ad",
    status: "Status",
    whereWhen: "Where and when",
    movies: "Movies",
    results: "Results",
    actions: "Actions",
  },
  /** The line under the ad's name. `length` is the ad's own length, "0:30". */
  meta: {
    videoLength: (length: string) => `${length} long`,
    cantSkip: "Can’t skip",
    canSkipAfter: (seconds: number) => `Can skip after ${seconds} sec`,
    pictureSize: (width: number, height: number) => `${width} × ${height} px`,
    opens: (host: string) => `opens ${host}`,
    noVideo: "No video yet",
    noPicture: "No picture yet",
  },
  thumbnailAlt: (title: string) => `${title} — corner picture`,
  /** Where a corner picture shows, as the row says it: "In the corner · 10 sec on screen · back every 15 min". */
  where: {
    inCorner: "In the corner",
    staysSeconds: (seconds: number) => `${seconds} sec on screen`,
    untilClosed: "stays until closed",
    backEvery: (time: string) => `back every ${time}`,
    once: "only once",
  },
  /** When it shows: its dates, then its hours of the day. */
  when: {
    anyDay: "Any day",
    from: (date: string) => `From ${date}`,
    until: (date: string) => `Until ${date}`,
    range: (from: string, to: string) => `${from} – ${to}`,
    everyDay: (from: string, to: string) => `Every day ${from}–${to}`,
    everyNight: (from: string, to: string) => `Every day ${from}–${to}, past midnight`,
  },
  /** Under "12 chosen movies", when some of them can't be watched. */
  movies: {
    missing: (count: number) =>
      count === 1 ? "1 chosen movie was deleted" : `${count} chosen movies were deleted`,
    hidden: (count: number) =>
      count === 1 ? "1 chosen movie isn’t published" : `${count} chosen movies aren’t published`,
  },
  /** All-time counts (`counters`); a corner picture's viewings are the movie openings it appeared in. */
  results: {
    played: (count: number, shown: string) => (count === 1 ? "Played once" : `Played ${shown} times`),
    watched: (percent: string) => `${percent} watched to the end`,
    notPlayed: "Not played yet",
    cornerSeen: (viewings: number, viewingsShown: string, shows: number, showsShown: string) =>
      `In ${viewings === 1 ? "1 viewing" : `${viewingsShown} viewings`} · on screen ${
        shows === 1 ? "once" : `${showsShown} times`
      }`,
    taps: (count: number, shown: string) => (count === 1 ? "Tapped once" : `Tapped ${shown} times`),
    notShown: "Not shown yet",
  },
  /** Small chips, only when the ad has them set. */
  chips: {
    goesFirst: (priority: number) => `Goes first: ${priority}`,
    perDay: {
      VIDEO: (times: number) => `At most ${times} a day per viewer`,
      CORNER: (times: number) =>
        times === 1 ? "In at most 1 movie a day per viewer" : `In at most ${times} movies a day per viewer`,
    },
    /** `time` is "1 h". */
    wait: (time: string) => `Waits ${time} per viewer`,
  },
  actions: {
    previewNoVideo: "No video to preview yet",
    previewNoPicture: "No picture to preview yet",
    more: (title: string) => `More actions for “${title}”`,
  },
  /** The line under the table; the middle part is a link to the Ad results page. */
  footnote: {
    before: "Results are counted since each ad was made. For a chosen period, open ",
    link: "Ad results",
    after: ".",
  },
  deletedToast: "Ad deleted",
  deleteFailedToast: "Could not delete the ad",
  deleteTitle: "Delete this ad?",
  deleteDescription: (title: string) =>
    `Delete “${title}”? Its video or picture and its results go with it. This can’t be undone.`,
  /** The Preview dialog. */
  preview: {
    title: (name: string) => `Preview · ${name}`,
    loadError: "Could not load the ad.",
    noVideo: "This ad has no video yet.",
    noPicture: "This ad has no picture yet.",
    slots: {
      before: "Plays before the movie",
      breaks: "Plays at ad breaks",
      both: "Plays before the movie and at ad breaks",
    },
    noLink: "A tap opens nothing — no web page is set.",
    /** `first` "1 min", `every` "15 min". */
    cornerTiming: {
      repeat: (first: string, seconds: number, every: string) =>
        `Appears after ${first} of watching, stays ${seconds} seconds, and comes back every ${every} of watching.`,
      once: (first: string, seconds: number) =>
        `Appears after ${first} of watching, stays ${seconds} seconds, and doesn’t come back.`,
      untilClosed: (first: string) => `Appears after ${first} of watching and stays until the viewer closes it.`,
    },
  },
};

export const listMm = {
  title: "ကြော်ငြာများ",
  description:
    "ကြည့်သူများ ရုပ်ရှင်ကြည့်နေစဉ် မြင်ရမည့် ဗီဒီယို ကြော်ငြာ အတိုများနှင့် ထောင့်ပုံ ကြော်ငြာ အသေးများ — ဝက်ဘ်ဆိုက်နှင့် ဖုန်းအက်ပ် နှစ်ခုလုံးတွင်။",
  readOnly: "သင် ကြည့်နိုင်သော်လည်း ပြောင်းခွင့် မရှိပါ။",
  loadError: "ကြော်ငြာများကို ဖွင့်၍ မရပါ။",
  emptyTitle: "ကြော်ငြာ မရှိသေးပါ",
  emptyDescription:
    "ဗီဒီယို ကြော်ငြာ သို့မဟုတ် ထောင့်ပုံ ကြော်ငြာ တစ်ခု ပြုလုပ်ပါ၊ ဘယ်နေရာမှာ ဘယ်အချိန် ပြမလဲ ရွေးပါ၊ ထို့နောက် ဖွင့်ပါ။",
  noMatches:
    "ကိုက်ညီသော ကြော်ငြာ မရှိပါ။ အခြား အမည်ဖြင့် ရှာပါ၊ သို့မဟုတ် အမျိုးအစားနှင့် အခြေအနေကို “အားလုံး” သို့ ပြန်ထားပါ။",
  search: "ကြော်ငြာ အမည်ဖြင့် ရှာမည်…",
  searchLabel: "ကြော်ငြာ အမည်ဖြင့် ရှာမည်",
  typeLabel: "အမျိုးအစား",
  statusLabel: "အခြေအနေ",
  all: "အားလုံး",
  statusFilters: {
    LIVE: "အသက်ဝင်နေသည်",
    SCHEDULED: "နောက်မှ စမည်",
    ENDED: "ပြီးဆုံးပြီ",
    OFF: "ပိတ်ထားသည်",
    NO_VIDEO: "ဗီဒီယို သို့မဟုတ် ပုံ လိုအပ်သည်",
  },
  columns: {
    ad: "ကြော်ငြာ",
    status: "အခြေအနေ",
    whereWhen: "နေရာနှင့် အချိန်",
    movies: "ရုပ်ရှင်များ",
    results: "ရလဒ်များ",
    actions: "လုပ်ဆောင်ချက်များ",
  },
  meta: {
    videoLength: (length: string) => `${length} ကြာ`,
    cantSkip: "ကျော်၍ မရ",
    canSkipAfter: (seconds: number) => `${seconds} စက္ကန့်ပြီးနောက် ကျော်နိုင်သည်`,
    pictureSize: (width: number, height: number) => `${width} × ${height} px`,
    opens: (host: string) => `နှိပ်လျှင် ${host} ပွင့်မည်`,
    noVideo: "ဗီဒီယို မရှိသေးပါ",
    noPicture: "ပုံ မရှိသေးပါ",
  },
  thumbnailAlt: (title: string) => `${title} — ထောင့်ပုံ ကြော်ငြာ`,
  where: {
    inCorner: "ထောင့်တွင်",
    staysSeconds: (seconds: number) => `${seconds} စက္ကန့် ပေါ်နေမည်`,
    untilClosed: "ပိတ်သည်အထိ ပေါ်နေမည်",
    backEvery: (time: string) => `${time}တိုင်း ပြန်ပေါ်မည်`,
    once: "တစ်ကြိမ်သာ",
  },
  when: {
    anyDay: "မည်သည့်နေ့မဆို",
    from: (date: string) => `${date} မှစ၍`,
    until: (date: string) => `${date} အထိ`,
    range: (from: string, to: string) => `${from} – ${to}`,
    everyDay: (from: string, to: string) => `နေ့စဉ် ${from}–${to}`,
    everyNight: (from: string, to: string) => `နေ့စဉ် ${from}–${to} (သန်းခေါင်ကျော်)`,
  },
  movies: {
    missing: (count: number) => `ရွေးထားသော ရုပ်ရှင် ${count} ကား ဖျက်ပြီး ဖြစ်သည်`,
    hidden: (count: number) => `ရွေးထားသော ရုပ်ရှင် ${count} ကား မထုတ်ပြန်ရသေးပါ`,
  },
  results: {
    played: (_count: number, shown: string) => `${shown} ကြိမ် ဖွင့်ပြခဲ့သည်`,
    watched: (percent: string) => `${percent} အဆုံးထိ ကြည့်ခဲ့သည်`,
    notPlayed: "မဖွင့်ပြရသေးပါ",
    cornerSeen: (_viewings: number, viewingsShown: string, _shows: number, showsShown: string) =>
      `ကြည့်မှု ${viewingsShown} ခုတွင် ပေါ်ခဲ့သည် · စုစုပေါင်း ${showsShown} ကြိမ် ပေါ်ခဲ့သည်`,
    taps: (_count: number, shown: string) => `${shown} ကြိမ် နှိပ်ခဲ့သည်`,
    notShown: "မပေါ်ရသေးပါ",
  },
  chips: {
    goesFirst: (priority: number) => `အရင်ပြမည့် နံပါတ်: ${priority}`,
    perDay: {
      VIDEO: (times: number) => `ကြည့်သူတစ်ဦး တစ်ရက် ${times} ကြိမ်အထိ`,
      CORNER: (times: number) => `ကြည့်သူတစ်ဦး တစ်ရက် ရုပ်ရှင် ${times} ကားအထိ`,
    },
    wait: (time: string) => `ကြည့်သူတစ်ဦးကို ${time} ခြား၍ ပြ`,
  },
  actions: {
    previewNoVideo: "ကြိုကြည့်ရန် ဗီဒီယို မရှိသေးပါ",
    previewNoPicture: "ကြိုကြည့်ရန် ပုံ မရှိသေးပါ",
    more: (title: string) => `“${title}” အတွက် နောက်ထပ် လုပ်ဆောင်ချက်များ`,
  },
  footnote: {
    before: "ရလဒ်များကို ကြော်ငြာ တစ်ခုစီ ပြုလုပ်ခဲ့သည့်အချိန်မှစ၍ ရေတွက်ထားသည်။ ရွေးချယ်ထားသော ကာလအတွက် ",
    link: "ကြော်ငြာ ရလဒ်များ",
    after: " ကို ဖွင့်ပါ။",
  },
  deletedToast: "ကြော်ငြာ ဖျက်ပြီးပါပြီ",
  deleteFailedToast: "ကြော်ငြာကို ဖျက်၍ မရပါ",
  deleteTitle: "ဤကြော်ငြာကို ဖျက်မလား",
  deleteDescription: (title: string) =>
    `“${title}” ကို ဖျက်မလား။ ၎င်း၏ ဗီဒီယို သို့မဟုတ် ပုံနှင့် ရလဒ်များပါ ပျက်သွားမည်။ ပြန်ယူ၍ မရပါ။`,
  preview: {
    title: (name: string) => `ကြိုကြည့်ရန် · ${name}`,
    loadError: "ကြော်ငြာကို ဖွင့်၍ မရပါ။",
    noVideo: "ဤကြော်ငြာတွင် ဗီဒီယို မရှိသေးပါ။",
    noPicture: "ဤကြော်ငြာတွင် ပုံ မရှိသေးပါ။",
    slots: {
      before: "ရုပ်ရှင် မစမီ ပြသည်",
      breaks: "ကြားဖြတ်ကြော်ငြာ အချိန်တွင် ပြသည်",
      both: "ရုပ်ရှင် မစမီနှင့် ကြားဖြတ်ကြော်ငြာ အချိန်တွင် ပြသည်",
    },
    noLink: "နှိပ်လျှင် ဘာမှ မပွင့်ပါ — ဝက်ဘ်စာမျက်နှာ မထည့်ထားပါ။",
    cornerTiming: {
      repeat: (first: string, seconds: number, every: string) =>
        `${first} ကြည့်ပြီးနောက် ပေါ်လာပြီး ${seconds} စက္ကန့် ပေါ်နေမည်။ ထို့နောက် ${every} ကြည့်ပြီးတိုင်း ပြန်ပေါ်မည်။`,
      once: (first: string, seconds: number) =>
        `${first} ကြည့်ပြီးနောက် ပေါ်လာပြီး ${seconds} စက္ကန့် ပေါ်နေမည်။ ပြန်မပေါ်တော့ပါ။`,
      untilClosed: (first: string) => `${first} ကြည့်ပြီးနောက် ပေါ်လာပြီး ကြည့်သူ ပိတ်သည်အထိ ပေါ်နေမည်။`,
    },
  },
} satisfies typeof listEn;
