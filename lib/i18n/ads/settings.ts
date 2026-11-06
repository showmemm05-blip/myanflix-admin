/**
 * Advertisements copy for the “Ad settings for all ads” card on the list
 * page — closed with its summary, and open (the `Settings` board)
 * (2026-11-04, docs/ads-admin-ux-2026-11-04). Owned by Stage L of
 * BUILD-BRIEF.md; read as `t.adsUi.settings.*`. English first, then the
 * Burmese typed against it, so a key missing in Burmese is a compile error.
 * Words more than one part uses live in shared.ts.
 *
 * Was “Playback rules”. Two old sentences were wrong and are fixed here: the
 * never-changed defaults have NO ad breaks (backend AD_SETTINGS_DEFAULTS:
 * on, interval 0, everyone — not "30 minutes"), and “Only people without
 * Premium” is about the VIEWER’s Premium plan, not the title’s.
 *
 * Times come in as words ("30 min", "1 h" — adWords.ts `movieTimeText`).
 * The “what viewers will get” line is built here whole, per language, so
 * the Burmese is never English pieces glued together.
 */

/** "30 min", "30 min and 1 h", "30 min, 1 h and 1 h 30 min". */
function joinEn(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "30 မိနစ်၊ 1 နာရီ နှင့် 1 နာရီ 30 မိနစ်". */
function joinMm(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join("၊ ")} နှင့် ${items[items.length - 1]}`;
}

export const settingsEn = {
  title: "Ad settings for all ads",
  description: "These choices apply to every ad, on the website and in the phone app.",
  loadError: "Could not load the Ad settings.",
  /** The closed card's button for staff who may only look (ADS.MANAGE sees “Change”). */
  view: "See settings",
  hide: "Hide",
  /**
   * The closed card's one line. `breakEvery` is the interval in words
   * ("30 min"), null when ad breaks are off; `everyone` is the audience.
   */
  summaryOn: (breakEvery: string | null, everyone: boolean) =>
    `Ads are on · ${breakEvery ? `ad breaks every ${breakEvery}` : "no ad breaks"} · ${
      breakEvery ? "breaks and corner pictures" : "corner pictures"
    } for ${everyone ? "everyone" : "people without Premium"}`,
  summaryOff: "Ads are off. Viewers see no ads at all.",
  /** The closed card's label before the same sentences the open card shows. */
  whatViewersGet: "What viewers get:",
  /** Shown with the card closed too, whenever the saved settings have ads off. */
  offBanner:
    "Ads are off. Viewers see no ads at all. Your ads and these settings are kept for when you turn ads back on.",
  enabledLabel: "Show ads",
  enabledHint:
    "The main switch. Turn it off to stop every ad at once — before the movie, ad breaks and corner pictures. Your ads are kept.",
  breaksLabel: "Ad breaks during a movie",
  breakOff: "Off",
  /** A break chip: "Every 15 min", "Every 1 h". */
  breakEvery: (time: string) => `Every ${time}`,
  breakOther: "Other…",
  breakOtherLabel: "Minutes between ad breaks",
  breakOtherUnit: "minutes of the movie",
  breakOtherInvalid: (min: number, max: number) => `Use a whole number of minutes from ${min} to ${max}.`,
  breaksHint:
    "At each break the movie pauses, one video ad plays, then the movie carries on. Counted in movie time — pausing doesn’t count.",
  audienceLabel: "Who sees ad breaks and corner pictures",
  audienceOptions: {
    ALL: "Everyone",
    NON_PREMIUM: "Only people without Premium",
  },
  audienceNote:
    "The ad before the movie plays for everyone. With “Only people without Premium”, viewers who have an active Premium plan don’t get ad breaks or corner pictures.",
  previewHeading: "What viewers will get",
  /** The two example lengths the preview describes. */
  lengths: {
    movie: "A 2-hour movie",
    episode: "A 45-minute episode",
  },
  /**
   * One example: whether an ad plays before it (only when one is live), and
   * the breaks in words ("30 min", "1 h"), the first few of them with `more`
   * left over — a 1-minute interval gives a 2-hour movie 118 breaks. `corner`:
   * a corner picture is live, so a movie without video ads still has one ad
   * (`cornerLine` says so next) and "no ads" would be untrue.
   */
  planLine: (length: string, before: boolean, breakTimes: readonly string[], more: number, corner: boolean) => {
    const count = breakTimes.length + more;
    const list = joinEn(more > 0 ? [...breakTimes, `${more} more`] : breakTimes);
    const breaks = count === 1 ? `an ad break at ${list}` : `ad breaks at ${list}`;
    if (before && count > 0) return `${length}: an ad before it starts, then ${breaks}.`;
    if (before) return `${length}: an ad before it starts, and no ad breaks.`;
    if (count > 0) return `${length}: ${breaks}.`;
    return corner ? `${length}: no video ads.` : `${length}: no ads.`;
  },
  /**
   * Directly under the plan, open and closed: `liveCounts` applies neither an
   * ad's chosen movies nor its hours, so the plan is the most anyone can get.
   */
  planNote: "This is the most a viewer can get. An ad set to chosen movies or certain hours plays only there.",
  /** `time` is "1 min". */
  cornerLine: (time: string) => `Corner pictures appear after ${time} of watching.`,
  premiumLine: "Viewers with an active Premium plan get only the ad before the movie.",
  adsOffPreview: "Ads are off — viewers get no ads at all.",
  /** From `liveCounts` — on, with a video or picture, inside its dates. */
  warnNoBreakAds:
    "Ad breaks are on, but no ad is set to play at breaks, so viewers get no breaks. Make an ad that plays “At ad breaks”.",
  warnNoPreroll: "No ad that plays before the movie is on right now, so viewers get none before it starts.",
  warnNoCorner: "No corner picture is on right now, so viewers see none.",
  /**
   * The plan is made when a movie opens, but the backend asks again at every
   * break (ad-decision.service.ts `midroll`): the break times and a corner
   * picture already handed out stay, while the remaining breaks stop at once.
   */
  appliesNote:
    "Changes reach viewers the next time they open a movie. People already watching keep their break times and corner picture until then. But if you turn ads off, turn ad breaks off, or choose “Only people without Premium”, their remaining ad breaks stop right away (for Premium viewers, in the last case).",
  unsaved: "You have changes that aren’t saved yet.",
  undo: "Undo changes",
  save: "Save settings",
  savedToast: "Ad settings saved",
  saveFailedToast: "Could not save the Ad settings",
  /** `when` is "4 Nov 2026, 13:20" in Myanmar time. */
  lastChanged: (who: string, when: string) => `Last changed by ${who} on ${when}.`,
  neverChanged: "Never changed. Using the starting settings: ads on, no ad breaks, shown to everyone.",
  readOnly: "You can look at these settings but not change them.",
};

export const settingsMm = {
  title: "ကြော်ငြာအားလုံးအတွက် ကြော်ငြာ ဆက်တင်",
  description: "ဤရွေးချယ်မှုများသည် ဝက်ဘ်ဆိုက်နှင့် ဖုန်းအက်ပ်ရှိ ကြော်ငြာ အားလုံးအတွက် သက်ရောက်သည်။",
  loadError: "ကြော်ငြာ ဆက်တင်ကို ဖွင့်၍ မရပါ။",
  view: "ဆက်တင် ကြည့်မည်",
  hide: "ဖျောက်မည်",
  summaryOn: (breakEvery: string | null, everyone: boolean) =>
    `ကြော်ငြာ ဖွင့်ထားသည် · ${breakEvery ? `ကြားဖြတ်ကြော်ငြာ ${breakEvery}တိုင်း` : "ကြားဖြတ်ကြော်ငြာ မရှိ"} · ${
      breakEvery ? "ကြားဖြတ်ကြော်ငြာနှင့် ထောင့်ပုံ ကြော်ငြာကို" : "ထောင့်ပုံ ကြော်ငြာကို"
    } ${everyone ? "လူတိုင်း" : "Premium မရှိသူများသာ"} မြင်ရသည်`,
  summaryOff: "ကြော်ငြာ ပိတ်ထားသည်။ ကြည့်သူများ မည်သည့် ကြော်ငြာမျှ မမြင်ရပါ။",
  whatViewersGet: "ကြည့်သူများ ရမည့်အရာ —",
  offBanner:
    "ကြော်ငြာ ပိတ်ထားသည်။ ကြည့်သူများ မည်သည့် ကြော်ငြာမျှ မမြင်ရပါ။ ကြော်ငြာ ပြန်ဖွင့်သည့်အခါအတွက် သင့်ကြော်ငြာများနှင့် ဤဆက်တင်များကို သိမ်းထားသည်။",
  enabledLabel: "ကြော်ငြာ ပြမည်",
  enabledHint:
    "ပင်မ ခလုတ် ဖြစ်သည်။ ပိတ်လိုက်လျှင် ရုပ်ရှင် မစမီ ကြော်ငြာ၊ ကြားဖြတ်ကြော်ငြာနှင့် ထောင့်ပုံ ကြော်ငြာ အားလုံး တစ်ပြိုင်နက် ရပ်မည်။ သင့်ကြော်ငြာများကို ဆက်သိမ်းထားမည်။",
  breaksLabel: "ရုပ်ရှင်ကြည့်နေစဉ် ကြားဖြတ်ကြော်ငြာ",
  breakOff: "ပိတ်",
  breakEvery: (time: string) => `${time}တိုင်း`,
  breakOther: "အခြား…",
  breakOtherLabel: "ကြားဖြတ်ကြော်ငြာ တစ်ခုနှင့် တစ်ခုကြား မိနစ်",
  breakOtherUnit: "မိနစ် (ရုပ်ရှင်အချိန်)",
  breakOtherInvalid: (min: number, max: number) => `${min} မှ ${max} အထိ မိနစ် ကိန်းပြည့်ကို ထည့်ပါ။`,
  breaksHint:
    "ကြားဖြတ်ကြော်ငြာ တစ်ခါတိုင်း ရုပ်ရှင်ကို ခဏရပ်ပြီး ဗီဒီယို ကြော်ငြာ တစ်ခု ပြကာ ရုပ်ရှင်ကို ဆက်ပြသည်။ ရုပ်ရှင်အချိန်ဖြင့် ရေတွက်သည် — ခဏရပ်ထားချိန်ကို မရေတွက်ပါ။",
  audienceLabel: "ကြားဖြတ်ကြော်ငြာနှင့် ထောင့်ပုံ ကြော်ငြာကို မည်သူ မြင်ရမလဲ",
  audienceOptions: {
    ALL: "လူတိုင်း",
    NON_PREMIUM: "Premium မရှိသူများသာ",
  },
  audienceNote:
    "ရုပ်ရှင် မစမီ ကြော်ငြာကို လူတိုင်း မြင်ရသည်။ “Premium မရှိသူများသာ” ကို ရွေးလျှင် Premium အစီအစဉ် သက်တမ်းရှိသူများသည် ကြားဖြတ်ကြော်ငြာနှင့် ထောင့်ပုံ ကြော်ငြာကို မမြင်ရပါ။",
  previewHeading: "ကြည့်သူများ ရမည့်အရာ",
  lengths: {
    movie: "2 နာရီ ရုပ်ရှင်",
    episode: "45 မိနစ် ဇာတ်လမ်းတွဲ အပိုင်း",
  },
  planLine: (length: string, before: boolean, breakTimes: readonly string[], more: number, corner: boolean) => {
    const count = breakTimes.length + more;
    const list = joinMm(more > 0 ? [...breakTimes, `နောက်ထပ် ${more} ကြိမ်`] : breakTimes);
    if (before && count > 0) return `${length} — မစမီ ကြော်ငြာ တစ်ခု ပြပြီး ${list} တွင် ကြားဖြတ်ကြော်ငြာ ပြမည်။`;
    if (before) return `${length} — မစမီ ကြော်ငြာ တစ်ခုသာ ပြမည်။ ကြားဖြတ်ကြော်ငြာ မရှိပါ။`;
    if (count > 0) return `${length} — ${list} တွင် ကြားဖြတ်ကြော်ငြာ ပြမည်။`;
    return corner ? `${length} — ဗီဒီယို ကြော်ငြာ မရှိပါ။` : `${length} — ကြော်ငြာ မရှိပါ။`;
  },
  planNote:
    "ဤသည်မှာ ကြည့်သူတစ်ဦး အများဆုံး ရနိုင်သည့် အရာ ဖြစ်သည်။ ရွေးထားသော ရုပ်ရှင်များ သို့မဟုတ် သတ်မှတ်ထားသော အချိန်များအတွက် ထားသည့် ကြော်ငြာသည် ထိုရုပ်ရှင်များ သို့မဟုတ် ထိုအချိန်များတွင်သာ ပြသည်။",
  cornerLine: (time: string) => `ထောင့်ပုံ ကြော်ငြာများသည် ${time} ကြည့်ပြီးနောက် ပေါ်လာသည်။`,
  premiumLine: "Premium အစီအစဉ် သက်တမ်းရှိသူများသည် ရုပ်ရှင် မစမီ ကြော်ငြာကိုသာ မြင်ရသည်။",
  adsOffPreview: "ကြော်ငြာ ပိတ်ထားသည် — ကြည့်သူများ မည်သည့် ကြော်ငြာမျှ မမြင်ရပါ။",
  warnNoBreakAds:
    "ကြားဖြတ်ကြော်ငြာကို ဖွင့်ထားသော်လည်း ကြားဖြတ်ကြော်ငြာ အချိန်တွင် ပြရန် ကြော်ငြာ မရှိသဖြင့် ကြည့်သူများ ကြားဖြတ်ကြော်ငြာ မမြင်ရပါ။ “ကြားဖြတ်ကြော်ငြာ အချိန်တွင်” ပြမည့် ကြော်ငြာ တစ်ခု ပြုလုပ်ပါ။",
  warnNoPreroll: "ယခု ဖွင့်ထားသော ရုပ်ရှင် မစမီ ကြော်ငြာ မရှိသဖြင့် ရုပ်ရှင် မစမီ ကြော်ငြာ မပြပါ။",
  warnNoCorner: "ယခု ဖွင့်ထားသော ထောင့်ပုံ ကြော်ငြာ မရှိသဖြင့် ကြည့်သူများ ထောင့်ပုံ မမြင်ရပါ။",
  appliesNote:
    "ပြောင်းလဲမှုများသည် ကြည့်သူများ နောက်တစ်ကြိမ် ရုပ်ရှင်ဖွင့်မှ သက်ရောက်သည်။ ယခု ကြည့်နေသူများသည် ထိုအချိန်အထိ ကြားဖြတ်ကြော်ငြာ အချိန်များနှင့် ထောင့်ပုံ ကြော်ငြာကို ဆက်ရမည်။ သို့သော် ကြော်ငြာ ပိတ်လိုက်လျှင်၊ ကြားဖြတ်ကြော်ငြာ ပိတ်လိုက်လျှင် သို့မဟုတ် “Premium မရှိသူများသာ” ကို ရွေးလျှင် ကျန်ရှိသော ကြားဖြတ်ကြော်ငြာများ ချက်ချင်း ရပ်မည် (နောက်ဆုံးတစ်ခုတွင် Premium ရှိသူများအတွက်)။",
  unsaved: "မသိမ်းရသေးသော ပြောင်းလဲမှုများ ရှိသည်။",
  undo: "ပြောင်းလဲမှုများ ပြန်ဖျက်မည်",
  save: "ဆက်တင် သိမ်းမည်",
  savedToast: "ကြော်ငြာ ဆက်တင်ကို သိမ်းပြီးပါပြီ",
  saveFailedToast: "ကြော်ငြာ ဆက်တင်ကို သိမ်း၍ မရပါ",
  lastChanged: (who: string, when: string) => `${when} တွင် ${who} နောက်ဆုံး ပြောင်းခဲ့သည်။`,
  neverChanged:
    "မပြောင်းရသေးပါ။ မူလ ဆက်တင်ကို သုံးနေသည် — ကြော်ငြာ ဖွင့်ထားသည်၊ ကြားဖြတ်ကြော်ငြာ မရှိ၊ လူတိုင်း မြင်ရသည်။",
  readOnly: "ဤဆက်တင်များကို ကြည့်နိုင်သော်လည်း ပြောင်းခွင့် မရှိပါ။",
} satisfies typeof settingsEn;
