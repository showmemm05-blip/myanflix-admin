/**
 * Advertisements copy used by more than one part of the pages (2026-11-04,
 * docs/ads-admin-ux-2026-11-04): the names of the two kinds of ad and of the
 * places they appear, the visible statuses with the sentence under each
 * (the `Statuses` board), movie times in words, and the buttons every part
 * shares. Components read it as `t.adsUi.shared.*`, mostly through
 * components/ads/adWords.ts.
 *
 * The Burmese follows the `Words` board and SPEC §6: one Burmese word for
 * one meaning (an ad break is ကြားဖြတ်ကြော်ငြာ everywhere, the settings are
 * ကြော်ငြာ ဆက်တင်, never ပြသမှု), whole sentences in Burmese word order,
 * numbers as Latin digits, and a movie time is "1 နာရီ 30 မိနစ်", never "1:30".
 */

export const sharedEn = {
  /** The two kinds of ad — the badge in the list, the type step's choices, the results table. */
  formats: {
    VIDEO: "Video ad",
    CORNER: "Corner picture",
  },
  /** The same, as a group — the Type filter. */
  formatsPlural: {
    VIDEO: "Video ads",
    CORNER: "Corner pictures",
  },
  /** The three places an ad can appear (How ads work, the results' "Where"). */
  placements: {
    PREROLL: "Before the movie",
    MIDROLL: "Ad breaks",
    CORNER: "Corner pictures",
  },
  /** Where one video ad plays, as one phrase. */
  slots: {
    before: "Before the movie",
    breaks: "At ad breaks",
    both: "Before the movie and at ad breaks",
  },
  /** Which movies an ad shows in. Chosen movies never include series episodes. */
  movies: {
    all: "All movies and episodes",
    chosen: (count: number) => (count === 1 ? "1 chosen movie" : `${count} chosen movies`),
  },
  /** The badge for each visible status (components/ads/adHealth.ts); "Needs a video / a picture" by the ad's type. */
  statusLabels: {
    NEEDS_VIDEO: "Needs a video",
    NEEDS_PICTURE: "Needs a picture",
    OFF: "Turned off",
    ENDED: "Finished",
    STARTS_LATER: "Starts later",
    NO_MOVIES: "No movie to show in",
    ALL_ADS_OFF: "Paused by settings",
    BREAKS_OFF: "Paused by settings",
    OUTSIDE_HOURS: "Outside its hours",
    SHOWING: "Showing",
    /** "Showing" can't be claimed yet: the Ad settings haven't loaded, so nothing has checked them. */
    SHOWING_UNCHECKED: "Settings not checked",
  },
  /** The sentence under each badge. `date` "3 Nov 2026", `when` "10 Nov 2026, 09:00", the times "18:00". */
  statusSentences: {
    NEEDS_VIDEO: "Add a video before it can show.",
    NEEDS_PICTURE: "Add a picture before it can show.",
    OFF: "It’s saved, but viewers don’t see it.",
    ENDED: (date: string) => `It ended ${date}. Change the end date to show it again.`,
    STARTS_LATER: (when: string) => `It’s on and starts ${when}.`,
    NO_MOVIES: "Its chosen movies were deleted or aren’t published, so viewers can’t get it.",
    ALL_ADS_OFF: "It’s on, but all ads are turned off in Ad settings.",
    BREAKS_OFF: "It only plays at ad breaks, and ad breaks are off in Ad settings.",
    OUTSIDE_HOURS: (from: string, to: string, now: string) =>
      `It only shows ${from}–${to} each day. It’s ${now} in Myanmar now.`,
    SHOWING_VIDEO: "Viewers can get this ad now.",
    SHOWING_CORNER: "Viewers can see this picture now.",
    SHOWING_UNCHECKED: "The ad itself is ready. The Ad settings haven’t loaded yet, so they aren’t checked here.",
  },
  /** A movie position or length: "30 min", "1 h", "1 h 30 min" (adWords.ts `movieTimeText`). */
  movieTime: {
    minutes: (minutes: number) => `${minutes} min`,
    hours: (hours: number) => `${hours} h`,
    hoursMinutes: (hours: number, minutes: number) => `${hours} h ${minutes} min`,
  },
  myanmarTime: "All times are Myanmar time.",
  /** Names of things other parts point to. */
  adSettings: "Ad settings",
  adResults: "Ad results",
  newAd: "New ad",
  /** Buttons and short words. */
  willItShow: "Will it show?",
  why: "Why?",
  showToViewers: "Show to viewers",
  on: "On",
  off: "Off",
  change: "Change",
  edit: "Edit",
  editAd: "Edit ad",
  preview: "Preview",
  delete: "Delete",
  close: "Close",
  cancel: "Cancel",
  back: "Back",
  next: "Next",
  save: "Save",
  optional: "optional",
  recommended: "Recommended",
  /** The (?) button's name for screen readers (components/ads/HelpTip.tsx). */
  helpAbout: (topic: string) => `What does “${topic}” mean?`,
};

export const sharedMm = {
  formats: {
    VIDEO: "ဗီဒီယို ကြော်ငြာ",
    CORNER: "ထောင့်ပုံ ကြော်ငြာ",
  },
  formatsPlural: {
    VIDEO: "ဗီဒီယို ကြော်ငြာများ",
    CORNER: "ထောင့်ပုံ ကြော်ငြာများ",
  },
  placements: {
    PREROLL: "ရုပ်ရှင် မစမီ",
    MIDROLL: "ကြားဖြတ်ကြော်ငြာ",
    CORNER: "ထောင့်ပုံ ကြော်ငြာ",
  },
  slots: {
    before: "ရုပ်ရှင် မစမီ",
    breaks: "ကြားဖြတ်ကြော်ငြာ အချိန်တွင်",
    both: "ရုပ်ရှင် မစမီနှင့် ကြားဖြတ်ကြော်ငြာ အချိန်တွင်",
  },
  movies: {
    all: "ရုပ်ရှင်အားလုံးနှင့် ဇာတ်လမ်းတွဲ အပိုင်းအားလုံး",
    chosen: (count: number) => `ရွေးထားသော ရုပ်ရှင် ${count} ကား`,
  },
  statusLabels: {
    NEEDS_VIDEO: "ဗီဒီယို လိုအပ်သည်",
    NEEDS_PICTURE: "ပုံ လိုအပ်သည်",
    OFF: "ပိတ်ထားသည်",
    ENDED: "ပြီးဆုံးပြီ",
    STARTS_LATER: "နောက်မှ စမည်",
    NO_MOVIES: "ပြစရာ ရုပ်ရှင် မရှိပါ",
    ALL_ADS_OFF: "ဆက်တင်ကြောင့် ရပ်ထားသည်",
    BREAKS_OFF: "ဆက်တင်ကြောင့် ရပ်ထားသည်",
    OUTSIDE_HOURS: "သတ်မှတ်ချိန် ပြင်ပ",
    SHOWING: "ပြနေသည်",
    SHOWING_UNCHECKED: "ဆက်တင် မစစ်ရသေးပါ",
  },
  statusSentences: {
    NEEDS_VIDEO: "ပြနိုင်ရန် ဗီဒီယို အရင်ထည့်ပါ။",
    NEEDS_PICTURE: "ပြနိုင်ရန် ပုံ အရင်ထည့်ပါ။",
    OFF: "သိမ်းထားသော်လည်း ကြည့်သူများ မမြင်ရပါ။",
    ENDED: (date: string) => `${date} တွင် ပြီးဆုံးခဲ့သည်။ ထပ်ပြလိုပါက ပြီးမည့်ရက်ကို ပြောင်းပါ။`,
    STARTS_LATER: (when: string) => `ဖွင့်ထားပြီး ${when} တွင် စပြပါမည်။`,
    NO_MOVIES: "ရွေးထားသော ရုပ်ရှင်များကို ဖျက်ထားသည် သို့မဟုတ် မထုတ်ပြန်ရသေးသဖြင့် ကြည့်သူများ ဤကြော်ငြာကို မမြင်ရပါ။",
    ALL_ADS_OFF: "ဤကြော်ငြာကို ဖွင့်ထားသော်လည်း ကြော်ငြာ ဆက်တင်တွင် ကြော်ငြာအားလုံးကို ပိတ်ထားသည်။",
    BREAKS_OFF:
      "ဤကြော်ငြာကို ကြားဖြတ်ကြော်ငြာ အချိန်တွင်သာ ပြပြီး ကြော်ငြာ ဆက်တင်တွင် ကြားဖြတ်ကြော်ငြာကို ပိတ်ထားသည်။",
    OUTSIDE_HOURS: (from: string, to: string, now: string) =>
      `နေ့စဉ် ${from}–${to} အတွင်းသာ ပြသည်။ ယခု မြန်မာစံတော်ချိန် ${now} ဖြစ်သည်။`,
    SHOWING_VIDEO: "ယခု ကြည့်သူများထံ ဤကြော်ငြာ ပြနိုင်ပါသည်။",
    SHOWING_CORNER: "ယခု ကြည့်သူများ ဤပုံကို မြင်နိုင်ပါသည်။",
    SHOWING_UNCHECKED: "ကြော်ငြာ ကိုယ်တိုင်တွင် ပြင်ရန် မရှိပါ။ ကြော်ငြာ ဆက်တင် မဖွင့်ရသေးသဖြင့် ဤနေရာတွင် မစစ်ရသေးပါ။",
  },
  movieTime: {
    minutes: (minutes: number) => `${minutes} မိနစ်`,
    hours: (hours: number) => `${hours} နာရီ`,
    hoursMinutes: (hours: number, minutes: number) => `${hours} နာရီ ${minutes} မိနစ်`,
  },
  myanmarTime: "အချိန်အားလုံးသည် မြန်မာစံတော်ချိန် ဖြစ်သည်။",
  adSettings: "ကြော်ငြာ ဆက်တင်",
  adResults: "ကြော်ငြာ ရလဒ်များ",
  newAd: "ကြော်ငြာ အသစ်",
  willItShow: "ပြမလား စစ်ကြည့်မည်",
  why: "ဘာကြောင့်လဲ",
  showToViewers: "ကြည့်သူများကို ပြမည်",
  on: "ဖွင့်",
  off: "ပိတ်",
  change: "ပြောင်းမည်",
  edit: "ပြင်မည်",
  editAd: "ကြော်ငြာ ပြင်မည်",
  preview: "ကြိုကြည့်မည်",
  delete: "ဖျက်မည်",
  close: "ပိတ်မည်",
  cancel: "ပယ်ဖျက်မည်",
  back: "နောက်သို့",
  next: "ရှေ့သို့",
  save: "သိမ်းမည်",
  optional: "မထည့်လည်း ရသည်",
  recommended: "အကြံပြုထားသည်",
  helpAbout: (topic: string) => `“${topic}” ဆိုတာ ဘာလဲ`,
} satisfies typeof sharedEn;
