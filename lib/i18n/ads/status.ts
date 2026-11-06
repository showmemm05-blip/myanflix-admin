/**
 * Advertisements copy for the status line under each row’s badge and the
 * row’s “Show to viewers” switch (the `Statuses` board); the badges and
 * their sentences themselves are in shared.ts (2026-11-04,
 * docs/ads-admin-ux-2026-11-04). Owned by Stage L of BUILD-BRIEF.md; read as
 * `t.adsUi.status.*`. English first, then the Burmese typed against it, so a
 * key missing in Burmese is a compile error. Words more than one part uses
 * live in shared.ts.
 */

export const statusEn = {
  /** Under a greyed switch: the backend refuses to turn an ad on without its video or picture. */
  needsVideoFirst: "Add a video first",
  needsPictureFirst: "Add a picture first",
  /** The switch's name for screen readers — every row has one, so it names the ad after the visible words. */
  switchFor: (title: string) => `Show to viewers — “${title}”`,
  /** The “Why?” link's name for screen readers — it starts with the visible word, so voice control finds it. */
  whyFor: (title: string) => `Why? Check whether “${title}” will show`,
  turnedOnToast: "Ad turned on",
  turnedOffToast: "Ad turned off",
  changeFailedToast: "Could not change the ad",
};

export const statusMm = {
  needsVideoFirst: "ဗီဒီယို အရင်ထည့်ပါ",
  needsPictureFirst: "ပုံ အရင်ထည့်ပါ",
  switchFor: (title: string) => `ကြည့်သူများကို ပြမည် — “${title}”`,
  whyFor: (title: string) => `ဘာကြောင့်လဲ — “${title}” ပြမလား စစ်ကြည့်မည်`,
  turnedOnToast: "ကြော်ငြာကို ဖွင့်လိုက်ပါပြီ",
  turnedOffToast: "ကြော်ငြာကို ပိတ်လိုက်ပါပြီ",
  changeFailedToast: "ကြော်ငြာကို ပြောင်း၍ မရပါ",
} satisfies typeof statusEn;
