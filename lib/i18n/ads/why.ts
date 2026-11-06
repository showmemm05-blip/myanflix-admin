/**
 * Advertisements copy for the “Will it show?” checker (the `WillYes`,
 * `WillNo` and `PhoneWill` boards) (2026-11-04,
 * docs/ads-admin-ux-2026-11-04). Owned by Stage L of BUILD-BRIEF.md; read as
 * `t.adsUi.why.*`. English first, then the Burmese typed against it, so a
 * key missing in Burmese is a compile error. Words more than one part uses
 * live in shared.ts.
 *
 * One entry per code of components/ads/adHealth.ts (`AdCheckCode`,
 * `AdNoteCode`, the test plan) — the rules themselves are there, this file
 * only words them. Times come in as words ("30 min", "1 h" — adWords.ts
 * `movieTimeText`), dates as "10 Nov 2026, 09:00" in Myanmar time, counts as
 * "1,204". Each check, note and test step is one or two whole sentences, so
 * the Burmese is written in Burmese order, never glued from English pieces.
 */

export const whyEn = {
  title: (name: string) => `Will viewers see “${name}”?`,
  back: "Back",
  verdict: {
    CAN_SHOW: "Yes — this ad can show right now.",
    NOT_NOW: (count: number) =>
      count === 1 ? "Not right now — 1 thing to fix." : `Not right now — ${count} things to fix.`,
    /** The Ad settings have not loaded: nothing in the ad itself stops it. */
    UNKNOWN: "The ad itself is ready.",
  },
  /** `count` for the wording, `shown` as the list writes it ("1,204"). A corner picture counts viewings it appeared in. */
  played: {
    VIDEO: (count: number, shown: string) =>
      count === 1 ? "It has played once so far." : `It has played ${shown} times so far.`,
    CORNER: (count: number, shown: string) =>
      count === 1 ? "It has appeared in 1 viewing so far." : `It has appeared in ${shown} viewings so far.`,
  },
  notPlayed: {
    VIDEO: "It hasn’t played yet.",
    CORNER: "It hasn’t appeared yet.",
  },
  hint: "If you didn’t see it yourself, one of the viewer rules below is the likely reason.",
  unknownHint: "The Ad settings haven’t loaded yet, so they aren’t checked here.",
  yourSettings: "Your settings",
  viewerHeading: "Things that depend on the viewer and the movie",
  likelyHeading: "Most likely reason you didn’t see it",
  testHeading: "How to test it yourself",
  /** The ✓ / ✗ lines, in adHealth.ts `checksOf` order. */
  checks: {
    ALL_ADS: {
      ok: "Ads are turned on (Ad settings).",
      bad: "All ads are turned off in Ad settings.",
    },
    AD_SWITCH: {
      ok: "This ad is turned on.",
      bad: "This ad is turned off.",
    },
    MEDIA: {
      /** `length` is the ad's own length, "0:12". */
      videoOk: (length: string) => `It has its video (${length}).`,
      /** `size` is "480 × 160 px", null when unknown. */
      pictureOk: (size: string | null) => (size ? `It has its picture (${size}).` : "It has its picture."),
      videoBad: "It has no video yet.",
      pictureBad: "It has no picture yet.",
    },
    START: {
      none: "No start date — it can show right away.",
      started: (when: string) => `It started ${when}.`,
      later: (when: string) => `It starts ${when}, so it’s waiting.`,
    },
    END: {
      none: "No end date.",
      ends: (when: string) => `It ends ${when}.`,
      ended: (when: string) => `It ended ${when}.`,
    },
    /** An ad in chosen movies. `watchable` of them exist and are published; `count` is how many are left on the ad at all. */
    MOVIES_OK: {
      ok: (watchable: number) =>
        watchable === 1 ? "It has 1 published movie to show in." : `It has ${watchable} published movies to show in.`,
      bad: (count: number): string =>
        count === 0
          ? "None of its chosen movies are left — they were deleted."
          : "None of its chosen movies can be watched — they were deleted or aren’t published.",
    },
    HOURS: {
      any: "Any time of day.",
      inside: (from: string, to: string, now: string) =>
        `It shows ${from}–${to} each day, and it’s ${now} in Myanmar now.`,
      outside: (from: string, to: string, now: string) =>
        `Shows only ${from}–${to} each day. It’s ${now} in Myanmar now, so it’s waiting.`,
      overnight: "These hours run past midnight.",
    },
    /** A video ad's places against the break interval; `every` is "30 min". */
    BREAKS: {
      before: "It plays before the movie.",
      breaks: (every: string) => `It plays at ad breaks, every ${every} of a movie.`,
      both: (every: string) => `It plays before the movie, and at ad breaks every ${every} of a movie.`,
      bothBreaksOff: "It plays before the movie. Ad breaks are off, so it doesn’t play at breaks for now.",
      blocked: "It only plays at ad breaks, and ad breaks are off.",
    },
  },
  /** The fix buttons under a ✗ line. */
  fixes: {
    openSettings: "Open Ad settings",
    turnOn: "Turn it on",
    addVideo: "Add a video",
    addPicture: "Add a picture",
    changeDates: "Change dates",
    changeHours: "Change hours",
    changeMovies: "Change movies",
    changePart: "Change it",
    alsoBefore: "Also play before the movie",
    alsoBeforeToast: "It now plays before the movie too.",
  },
  /** The notes, one per adHealth.ts `AdNoteCode`. */
  notes: {
    MOVIES: (count: number) =>
      count === 1
        ? "It shows only in 1 chosen movie — not in other movies or in series episodes."
        : `It shows only in ${count} chosen movies — not in other movies or in series episodes.`,
    moviesMissing: (count: number) =>
      count === 1
        ? "1 of them was deleted — edit the ad to take it out."
        : `${count} of them were deleted — edit the ad to take them out.`,
    moviesHidden: (count: number) =>
      count === 1
        ? "1 of them isn’t published, so viewers can’t open it."
        : `${count} of them aren’t published, so viewers can’t open them.`,
    AUDIENCE: {
      breaksAndBefore:
        "Ad breaks are only for people without Premium (Ad settings). Viewers with an active Premium plan get this ad only before the movie.",
      breaksOnly:
        "Ad breaks are only for people without Premium (Ad settings). Viewers with an active Premium plan don’t get this ad.",
      corner:
        "Corner pictures are only for people without Premium (Ad settings). Viewers with an active Premium plan don’t see this picture.",
    },
    /** `time` is "1 h". */
    WAIT: (time: string) =>
      `After someone sees it, it waits ${time} before showing to them again. Your own test views count too.`,
    PER_DAY: {
      VIDEO: (times: number) =>
        times === 1
          ? "Each viewer sees it at most once a day. Your own test views count too."
          : `Each viewer sees it at most ${times} times a day. Your own test views count too.`,
      /** A corner picture counts once per movie it appears in, however often it comes back. */
      CORNER: (times: number) =>
        times === 1
          ? "Each viewer sees it in at most 1 movie a day. Your own test views count too."
          : `Each viewer sees it in at most ${times} movies a day. Your own test views count too.`,
    },
    /** One sentence per place another live ad shares, then how they share it. */
    SHARING: {
      PREROLL: (others: number) =>
        others === 1
          ? "1 other ad is also switched on to play before the movie (its hours or movies may differ)."
          : `${others} other ads are also switched on to play before the movie (their hours or movies may differ).`,
      MIDROLL: (others: number) =>
        others === 1
          ? "1 other ad is also switched on to play at ad breaks (its hours or movies may differ)."
          : `${others} other ads are also switched on to play at ad breaks (their hours or movies may differ).`,
      CORNER: (others: number) =>
        others === 1
          ? "1 other corner picture is also switched on (its hours or movies may differ)."
          : `${others} other corner pictures are also switched on (their hours or movies may differ).`,
      turns: "Ads with the same “goes first” number take turns.",
      goesFirst: (priority: number) =>
        `This ad’s “goes first” number is ${priority}: it plays instead of ads with a lower number, and takes turns with ads that have the same number.`,
    },
    BREAK_MEMORY: (hours: number) =>
      `Each ad break plays only once per viewer per movie. If someone watches the same movie again within ${hours} hours, they don’t get those breaks again.`,
    /** `guard` "2 min"; `minMovie` "32 min" and `every` "30 min" when the interval is known. */
    LAST_MINUTES: {
      base: (guard: string) => `There are never ads in the last ${guard} of a movie.`,
      withInterval: (guard: string, minMovie: string, every: string) =>
        `There are never ads in the last ${guard} of a movie — a movie needs to be at least ${minMovie} long to get even one break every ${every}.`,
    },
    JUMP: "Skipping forward past several breaks plays just one ad.",
    /** `after` "1 min", `upTo` "3 min". */
    CORNER_FIRST: (after: string, upTo: string) =>
      `The picture appears after ${after} of real watching — skipping forward doesn’t count. Movies of ${upTo} or less never show it.`,
    CORNER_HIDES: (guard: string) =>
      `It hides while the movie is paused or loading, while a video ad plays, in the last ${guard}, and on phones while the play buttons are on screen.`,
    CORNER_CLOSE: "Once a viewer closes it with ✕, it doesn’t come back for the rest of that viewing.",
    /** ad-decision.service.ts `midroll` reads the rules and the live ads again at every break. */
    NEXT_OPEN:
      "Most changes reach viewers the next time they open a movie. Turning an ad or ad breaks off also applies to the breaks still to come.",
  },
  /**
   * The same rules said to the owner who tested it himself — the
   * "Most likely reason you didn't see it" box (adHealth.ts `likelyReason`).
   */
  likely: {
    BREAK_MEMORY: (hours: number) =>
      `Each ad break plays only once for the same person in the same movie. If you watch that movie again within ${hours} hours, you don’t get those breaks again.`,
    PER_DAY: {
      VIDEO: (times: number) =>
        times === 1
          ? "Each viewer sees it at most once a day, and your own test views count too — you may have used it up today."
          : `Each viewer sees it at most ${times} times a day, and your own test views count too — you may have used them up today.`,
      CORNER: (times: number) =>
        times === 1
          ? "Each viewer sees it in at most 1 movie a day, and your own test views count too — you may have used it up today."
          : `Each viewer sees it in at most ${times} movies a day, and your own test views count too — you may have used them up today.`,
    },
    WAIT: (time: string) =>
      `After you see it, it waits ${time} before showing to you again — your own test views count too.`,
    AUDIENCE:
      "Ad breaks and corner pictures are only for people without Premium. If your account has an active Premium plan, you don’t get them.",
    SHARING:
      "Other ads can play in the same place. The one with the higher “goes first” number plays, and ads with the same number take turns — you may have got another ad instead.",
    CORNER_FIRST: (after: string, upTo: string) =>
      `The picture appears only after ${after} of real watching — skipping forward doesn’t count, and movies of ${upTo} or less never show it.`,
  },
  /**
   * “How to test it yourself”, one sentence per step of adHealth.ts
   * `AdTestPlan`. `longer` is "5 min", or `intervalPlus` for a break test
   * while the interval is unknown or breaks are off. `hours` is set only for
   * a test at ad breaks, which must start from the beginning: a player that
   * resumes a movie skips every break before that point (midrollStart). A
   * count of 0 means all the chosen movies are gone: the step before it fixes
   * that first, so it reads as one movie.
   */
  test: {
    fixFirst: (count: number) => (count === 1 ? "Fix the thing above first." : `Fix the ${count} things above first.`),
    nonPremium: "Sign in with an account that has no Premium.",
    anyMovie: "Open any movie — the ad plays before it starts.",
    anyChosen: (count: number) =>
      count <= 1
        ? "Open the chosen movie — the ad plays before it starts."
        : `Open one of the ${count} chosen movies — the ad plays before it starts.`,
    /** Stands in for `longer`: "Open a movie longer than the time between your ad breaks plus 5 min." */
    intervalPlus: (extra: string) => `the time between your ad breaks plus ${extra}`,
    movie: (longer: string, hours: number | null) =>
      hours === null
        ? `Open a movie longer than ${longer}.`
        : `Open a movie longer than ${longer} that you haven’t watched in the last ${hours} hours, and start it from the beginning.`,
    chosenMovie: (count: number, longer: string, hours: number | null) => {
      if (count <= 1) {
        return hours === null
          ? `Open the chosen movie — it must be longer than ${longer}.`
          : `Open the chosen movie and start it from the beginning — it must be longer than ${longer} and not watched in the last ${hours} hours.`;
      }
      return hours === null
        ? `Open one of the ${count} chosen movies that is longer than ${longer}.`
        : `Open one of the ${count} chosen movies that is longer than ${longer} and that you haven’t watched in the last ${hours} hours, and start it from the beginning.`;
    },
    hours: (from: string, to: string) => `Do it between ${from} and ${to} Myanmar time.`,
    noSkipping: "Watch without skipping forward.",
  },
};

export const whyMm = {
  title: (name: string) => `ကြည့်သူများ “${name}” ကို မြင်ရမလား`,
  back: "နောက်သို့",
  verdict: {
    CAN_SHOW: "မြင်ရပါမည် — ဤကြော်ငြာကို ယခု ပြနိုင်သည်။",
    NOT_NOW: (count: number) => `ယခု မပြနိုင်သေးပါ — ပြင်ရန် ${count} ချက် ရှိသည်။`,
    UNKNOWN: "ကြော်ငြာ ကိုယ်တိုင်တွင် ပြင်ရန် မရှိပါ။",
  },
  played: {
    VIDEO: (_count: number, shown: string) => `ယခုထိ ${shown} ကြိမ် ဖွင့်ပြခဲ့ပြီး ဖြစ်သည်။`,
    CORNER: (_count: number, shown: string) => `ယခုထိ ကြည့်မှု ${shown} ခုတွင် ပေါ်ခဲ့ပြီး ဖြစ်သည်။`,
  },
  notPlayed: {
    VIDEO: "မဖွင့်ပြရသေးပါ။",
    CORNER: "မပေါ်ရသေးပါ။",
  },
  hint: "သင်ကိုယ်တိုင် မမြင်ခဲ့ရလျှင် အောက်ပါ ကြည့်သူဆိုင်ရာ စည်းမျဉ်း တစ်ခုခုကြောင့် ဖြစ်နိုင်သည်။",
  unknownHint: "ကြော်ငြာ ဆက်တင် မဖွင့်ရသေးသဖြင့် ဤနေရာတွင် မစစ်ရသေးပါ။",
  yourSettings: "သင့် ဆက်တင်များ",
  viewerHeading: "ကြည့်သူနှင့် ရုပ်ရှင်ပေါ် မူတည်သည့် အချက်များ",
  likelyHeading: "သင် မမြင်ခဲ့ရသည့် အဖြစ်နိုင်ဆုံး အကြောင်းရင်း",
  testHeading: "ကိုယ်တိုင် စမ်းကြည့်နည်း",
  checks: {
    ALL_ADS: {
      ok: "ကြော်ငြာများကို ဖွင့်ထားသည် (ကြော်ငြာ ဆက်တင်)။",
      bad: "ကြော်ငြာ ဆက်တင်တွင် ကြော်ငြာ အားလုံးကို ပိတ်ထားသည်။",
    },
    AD_SWITCH: {
      ok: "ဤကြော်ငြာကို ဖွင့်ထားသည်။",
      bad: "ဤကြော်ငြာကို ပိတ်ထားသည်။",
    },
    MEDIA: {
      videoOk: (length: string) => `ဗီဒီယို ရှိသည် (${length})။`,
      pictureOk: (size: string | null) => (size ? `ပုံ ရှိသည် (${size})။` : "ပုံ ရှိသည်။"),
      videoBad: "ဗီဒီယို မရှိသေးပါ။",
      pictureBad: "ပုံ မရှိသေးပါ။",
    },
    START: {
      none: "စမည့်ရက် မရှိ — ချက်ချင်း ပြနိုင်သည်။",
      started: (when: string) => `${when} တွင် စခဲ့သည်။`,
      later: (when: string) => `${when} တွင် စမည် ဖြစ်၍ စောင့်နေသည်။`,
    },
    END: {
      none: "ပြီးမည့်ရက် မရှိ။",
      ends: (when: string) => `${when} တွင် ပြီးဆုံးမည်။`,
      ended: (when: string) => `${when} တွင် ပြီးဆုံးခဲ့သည်။`,
    },
    MOVIES_OK: {
      ok: (watchable: number) => `ပြနိုင်သော ထုတ်ပြန်ပြီး ရုပ်ရှင် ${watchable} ကား ရှိသည်။`,
      bad: (count: number) =>
        count === 0
          ? "ရွေးထားသော ရုပ်ရှင်များ မကျန်တော့ပါ — ဖျက်ပြီး ဖြစ်သည်။"
          : "ရွေးထားသော ရုပ်ရှင်များထဲမှ တစ်ကားမှ ကြည့်၍ မရပါ — ဖျက်ထားသည် သို့မဟုတ် မထုတ်ပြန်ရသေးပါ။",
    },
    HOURS: {
      any: "နေ့၏ မည်သည့်အချိန်မဆို ပြနိုင်သည်။",
      inside: (from: string, to: string, now: string) =>
        `နေ့စဉ် ${from}–${to} အတွင်း ပြသည်။ ယခု မြန်မာစံတော်ချိန် ${now} ဖြစ်သည်။`,
      outside: (from: string, to: string, now: string) =>
        `နေ့စဉ် ${from}–${to} အတွင်းသာ ပြသည်။ ယခု မြန်မာစံတော်ချိန် ${now} ဖြစ်၍ စောင့်နေသည်။`,
      overnight: "ဤအချိန်သည် သန်းခေါင်ကို ကျော်သည်။",
    },
    BREAKS: {
      before: "ရုပ်ရှင် မစမီ ပြသည်။",
      breaks: (every: string) => `ရုပ်ရှင်ကို ${every} ကြည့်ပြီးတိုင်း ကြားဖြတ်ကြော်ငြာ အဖြစ် ပြသည်။`,
      both: (every: string) =>
        `ရုပ်ရှင် မစမီ ပြပြီး ရုပ်ရှင်ကို ${every} ကြည့်ပြီးတိုင်း ကြားဖြတ်ကြော်ငြာ အဖြစ်လည်း ပြသည်။`,
      bothBreaksOff: "ရုပ်ရှင် မစမီ ပြသည်။ ကြားဖြတ်ကြော်ငြာကို ပိတ်ထားသဖြင့် ယခုအချိန်တွင် ကြားဖြတ်ကြော်ငြာ အဖြစ် မပြပါ။",
      blocked: "ကြားဖြတ်ကြော်ငြာ အချိန်တွင်သာ ပြပြီး ကြားဖြတ်ကြော်ငြာကို ပိတ်ထားသည်။",
    },
  },
  fixes: {
    openSettings: "ကြော်ငြာ ဆက်တင် ဖွင့်မည်",
    turnOn: "ဖွင့်မည်",
    addVideo: "ဗီဒီယို ထည့်မည်",
    addPicture: "ပုံ ထည့်မည်",
    changeDates: "ရက်စွဲ ပြောင်းမည်",
    changeHours: "အချိန် ပြောင်းမည်",
    changeMovies: "ရုပ်ရှင် ပြောင်းမည်",
    changePart: "ပြောင်းမည်",
    alsoBefore: "ရုပ်ရှင် မစမီလည်း ပြမည်",
    alsoBeforeToast: "ယခု ရုပ်ရှင် မစမီလည်း ပြပါမည်။",
  },
  notes: {
    MOVIES: (count: number) =>
      `ရွေးထားသော ရုပ်ရှင် ${count} ကားတွင်သာ ပြသည် — အခြား ရုပ်ရှင်များနှင့် ဇာတ်လမ်းတွဲ အပိုင်းများတွင် မပြပါ။`,
    moviesMissing: (count: number) => `ထိုထဲမှ ${count} ကားကို ဖျက်ပြီး ဖြစ်သည် — ကြော်ငြာကို ပြင်ပြီး ဖယ်ထုတ်ပါ။`,
    moviesHidden: (count: number) =>
      `ထိုထဲမှ ${count} ကား မထုတ်ပြန်ရသေးသဖြင့် ကြည့်သူများ ဖွင့်၍ မရပါ။`,
    AUDIENCE: {
      breaksAndBefore:
        "ကြားဖြတ်ကြော်ငြာကို Premium မရှိသူများသာ မြင်ရသည် (ကြော်ငြာ ဆက်တင်)။ Premium အစီအစဉ် သက်တမ်းရှိသူများသည် ဤကြော်ငြာကို ရုပ်ရှင် မစမီတွင်သာ မြင်ရသည်။",
      breaksOnly:
        "ကြားဖြတ်ကြော်ငြာကို Premium မရှိသူများသာ မြင်ရသည် (ကြော်ငြာ ဆက်တင်)။ Premium အစီအစဉ် သက်တမ်းရှိသူများသည် ဤကြော်ငြာကို မမြင်ရပါ။",
      corner:
        "ထောင့်ပုံ ကြော်ငြာကို Premium မရှိသူများသာ မြင်ရသည် (ကြော်ငြာ ဆက်တင်)။ Premium အစီအစဉ် သက်တမ်းရှိသူများသည် ဤပုံကို မမြင်ရပါ။",
    },
    WAIT: (time: string) =>
      `တစ်စုံတစ်ယောက် မြင်ပြီးလျှင် ထိုသူကို ${time} ကြာမှ ထပ်ပြသည်။ သင်ကိုယ်တိုင် စမ်းကြည့်ခြင်းများကိုလည်း ရေတွက်ပါသည်။`,
    PER_DAY: {
      VIDEO: (times: number) =>
        `ကြည့်သူတစ်ဦးသည် တစ်ရက်လျှင် အများဆုံး ${times} ကြိမ် မြင်ရသည်။ သင်ကိုယ်တိုင် စမ်းကြည့်ခြင်းများကိုလည်း ရေတွက်ပါသည်။`,
      CORNER: (times: number) =>
        `ကြည့်သူတစ်ဦးသည် တစ်ရက်လျှင် ရုပ်ရှင် အများဆုံး ${times} ကားတွင် မြင်ရသည်။ သင်ကိုယ်တိုင် စမ်းကြည့်ခြင်းများကိုလည်း ရေတွက်ပါသည်။`,
    },
    SHARING: {
      PREROLL: (others: number) =>
        `အခြား ကြော်ငြာ ${others} ခုလည်း ရုပ်ရှင် မစမီ ပြရန် ဖွင့်ထားသည် (၎င်းတို့၏ အချိန် သို့မဟုတ် ရုပ်ရှင်များ ကွာခြားနိုင်သည်)။`,
      MIDROLL: (others: number) =>
        `အခြား ကြော်ငြာ ${others} ခုလည်း ကြားဖြတ်ကြော်ငြာ အချိန်တွင် ပြရန် ဖွင့်ထားသည် (၎င်းတို့၏ အချိန် သို့မဟုတ် ရုပ်ရှင်များ ကွာခြားနိုင်သည်)။`,
      CORNER: (others: number) =>
        `အခြား ထောင့်ပုံ ကြော်ငြာ ${others} ခုလည်း ဖွင့်ထားသည် (၎င်းတို့၏ အချိန် သို့မဟုတ် ရုပ်ရှင်များ ကွာခြားနိုင်သည်)။`,
      turns: "“အရင်ပြမည့် နံပါတ်” တူသော ကြော်ငြာများသည် အလှည့်ကျ ပြသည်။",
      goesFirst: (priority: number) =>
        `ဤကြော်ငြာ၏ “အရင်ပြမည့် နံပါတ်” သည် ${priority} ဖြစ်သည် — နံပါတ် နိမ့်သော ကြော်ငြာများအစား ဤကြော်ငြာကို ပြပြီး နံပါတ် တူသော ကြော်ငြာများနှင့် အလှည့်ကျ ပြသည်။`,
    },
    BREAK_MEMORY: (hours: number) =>
      `ကြားဖြတ်ကြော်ငြာ တစ်ခုစီကို လူတစ်ဦးသည် ရုပ်ရှင်တစ်ကားတည်းတွင် တစ်ကြိမ်သာ မြင်ရသည်။ ထိုရုပ်ရှင်ကို ${hours} နာရီအတွင်း ပြန်ကြည့်လျှင် ထိုကြားဖြတ်ကြော်ငြာများကို ထပ်မမြင်ရပါ။`,
    LAST_MINUTES: {
      base: (guard: string) => `ရုပ်ရှင်၏ နောက်ဆုံး ${guard} တွင် ကြော်ငြာ ဘယ်တော့မှ မပြပါ။`,
      withInterval: (guard: string, minMovie: string, every: string) =>
        `ရုပ်ရှင်၏ နောက်ဆုံး ${guard} တွင် ကြော်ငြာ ဘယ်တော့မှ မပြပါ။ ထို့ကြောင့် ${every}တိုင်း ပြသော ကြားဖြတ်ကြော်ငြာ တစ်ခုပင် ရရန် ရုပ်ရှင်သည် အနည်းဆုံး ${minMovie} ရှည်ရမည်။`,
    },
    JUMP: "ကြားဖြတ်ကြော်ငြာ အများအပြားကို ရှေ့သို့ ကျော်သွားလျှင် ကြော်ငြာ တစ်ခုသာ ပြသည်။",
    CORNER_FIRST: (after: string, upTo: string) =>
      `ပုံသည် တကယ် ${after} ကြည့်ပြီးမှ ပေါ်သည် — ရှေ့သို့ ကျော်ကြည့်ခြင်းကို မရေတွက်ပါ။ ${upTo}နှင့်အောက် ရုပ်ရှင်များတွင် လုံးဝ မပေါ်ပါ။`,
    CORNER_HIDES: (guard: string) =>
      `ရုပ်ရှင်ကို ခဏရပ်ထားစဉ် သို့မဟုတ် ဖွင့်နေဆဲအချိန်၊ ဗီဒီယို ကြော်ငြာ ပြနေစဉ်၊ နောက်ဆုံး ${guard} အတွင်းနှင့် ဖုန်းတွင် ဖွင့်/ရပ် ခလုတ်များ ပေါ်နေစဉ် ပုံကို ဖျောက်ထားသည်။`,
    CORNER_CLOSE: "ကြည့်သူက ✕ ဖြင့် ပိတ်လိုက်လျှင် ထိုကြည့်မှု၏ ကျန်အချိန်အတွင်း ပြန်မပေါ်တော့ပါ။",
    NEXT_OPEN:
      "ပြောင်းလဲမှု အများစုသည် ကြည့်သူများ နောက်တစ်ကြိမ် ရုပ်ရှင်ဖွင့်မှ သက်ရောက်သည်။ ကြော်ငြာ တစ်ခု သို့မဟုတ် ကြားဖြတ်ကြော်ငြာကို ပိတ်လိုက်လျှင် ကျန်ရှိသော ကြားဖြတ်ကြော်ငြာများတွင်လည်း သက်ရောက်သည်။",
  },
  likely: {
    BREAK_MEMORY: (hours: number) =>
      `ကြားဖြတ်ကြော်ငြာ တစ်ခုစီကို လူတစ်ဦးသည် ရုပ်ရှင်တစ်ကားတည်းတွင် တစ်ကြိမ်သာ မြင်ရသည်။ ထိုရုပ်ရှင်ကို ${hours} နာရီအတွင်း ပြန်ကြည့်လျှင် ထိုကြားဖြတ်ကြော်ငြာများကို သင် ထပ်မမြင်ရပါ။`,
    PER_DAY: {
      VIDEO: (times: number) =>
        `ကြည့်သူတစ်ဦးသည် တစ်ရက်လျှင် အများဆုံး ${times} ကြိမ်သာ မြင်ရပြီး သင်ကိုယ်တိုင် စမ်းကြည့်ခြင်းများကိုလည်း ရေတွက်သည် — ယနေ့အတွက် ကုန်သွားပြီ ဖြစ်နိုင်သည်။`,
      CORNER: (times: number) =>
        `ကြည့်သူတစ်ဦးသည် တစ်ရက်လျှင် ရုပ်ရှင် အများဆုံး ${times} ကားတွင်သာ မြင်ရပြီး သင်ကိုယ်တိုင် စမ်းကြည့်ခြင်းများကိုလည်း ရေတွက်သည် — ယနေ့အတွက် ကုန်သွားပြီ ဖြစ်နိုင်သည်။`,
    },
    WAIT: (time: string) =>
      `သင် မြင်ပြီးလျှင် ${time} ကြာမှ သင့်ကို ထပ်ပြသည် — သင်ကိုယ်တိုင် စမ်းကြည့်ခြင်းများကိုလည်း ရေတွက်ပါသည်။`,
    AUDIENCE:
      "ကြားဖြတ်ကြော်ငြာနှင့် ထောင့်ပုံ ကြော်ငြာကို Premium မရှိသူများသာ မြင်ရသည်။ သင့်အကောင့်တွင် Premium အစီအစဉ် သက်တမ်းရှိလျှင် မမြင်ရပါ။",
    SHARING:
      "နေရာတစ်ခုတည်းတွင် အခြား ကြော်ငြာများလည်း ပြနိုင်သည်။ “အရင်ပြမည့် နံပါတ်” မြင့်သော ကြော်ငြာကို ပြပြီး နံပါတ် တူသော ကြော်ငြာများသည် အလှည့်ကျ ပြသည် — သင် အခြား ကြော်ငြာ တစ်ခုကို မြင်ခဲ့ရခြင်း ဖြစ်နိုင်သည်။",
    CORNER_FIRST: (after: string, upTo: string) =>
      `ပုံသည် တကယ် ${after} ကြည့်ပြီးမှသာ ပေါ်သည် — ရှေ့သို့ ကျော်ကြည့်ခြင်းကို မရေတွက်ပါ။ ${upTo}နှင့်အောက် ရုပ်ရှင်များတွင် လုံးဝ မပေါ်ပါ။`,
  },
  test: {
    fixFirst: (count: number) => `အပေါ်ရှိ အချက် ${count} ချက်ကို အရင် ပြင်ပါ။`,
    nonPremium: "Premium မရှိသော အကောင့်ဖြင့် ဝင်ပါ။",
    anyMovie: "မည်သည့် ရုပ်ရှင်ကိုမဆို ဖွင့်ပါ — ရုပ်ရှင် မစမီ ကြော်ငြာ ပြပါမည်။",
    anyChosen: (count: number) =>
      count <= 1
        ? "ရွေးထားသော ရုပ်ရှင်ကို ဖွင့်ပါ — ရုပ်ရှင် မစမီ ကြော်ငြာ ပြပါမည်။"
        : `ရွေးထားသော ရုပ်ရှင် ${count} ကားထဲမှ တစ်ကားကို ဖွင့်ပါ — ရုပ်ရှင် မစမီ ကြော်ငြာ ပြပါမည်။`,
    intervalPlus: (extra: string) => `ကြားဖြတ်ကြော်ငြာ တစ်ခုနှင့် တစ်ခုကြား အချိန်နှင့် ${extra} ပေါင်းထားသည့် အချိန်`,
    movie: (longer: string, hours: number | null) =>
      hours === null
        ? `${longer}ထက် ရှည်သော ရုပ်ရှင် တစ်ကားကို ဖွင့်ပါ။`
        : `${longer}ထက် ရှည်ပြီး နောက်ဆုံး ${hours} နာရီအတွင်း မကြည့်ရသေးသော ရုပ်ရှင် တစ်ကားကို ဖွင့်ပြီး အစမှ စကြည့်ပါ။`,
    chosenMovie: (count: number, longer: string, hours: number | null) => {
      if (count <= 1) {
        return hours === null
          ? `ရွေးထားသော ရုပ်ရှင်ကို ဖွင့်ပါ — ${longer}ထက် ရှည်ရပါမည်။`
          : `ရွေးထားသော ရုပ်ရှင်ကို ဖွင့်ပြီး အစမှ စကြည့်ပါ — ${longer}ထက် ရှည်ပြီး နောက်ဆုံး ${hours} နာရီအတွင်း မကြည့်ရသေးသော ရုပ်ရှင် ဖြစ်ရပါမည်။`;
      }
      return hours === null
        ? `ရွေးထားသော ရုပ်ရှင် ${count} ကားထဲမှ ${longer}ထက် ရှည်သည့် တစ်ကားကို ဖွင့်ပါ။`
        : `ရွေးထားသော ရုပ်ရှင် ${count} ကားထဲမှ ${longer}ထက် ရှည်ပြီး နောက်ဆုံး ${hours} နာရီအတွင်း မကြည့်ရသေးသည့် တစ်ကားကို ဖွင့်ပြီး အစမှ စကြည့်ပါ။`;
    },
    hours: (from: string, to: string) => `မြန်မာစံတော်ချိန် ${from} မှ ${to} အတွင်း စမ်းပါ။`,
    noSkipping: "ရှေ့သို့ မကျော်ဘဲ ကြည့်ပါ။",
  },
} satisfies typeof whyEn;
