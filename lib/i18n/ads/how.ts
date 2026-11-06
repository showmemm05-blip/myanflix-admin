/**
 * Advertisements copy for the collapsible “How ads work” card on the list
 * page (the `HowAdsWork` board) (2026-11-04, docs/ads-admin-ux-2026-11-04).
 * Owned by Stage L of BUILD-BRIEF.md; read as `t.adsUi.how.*`. English
 * first, then the Burmese typed against it, so a key missing in Burmese is a
 * compile error. Words more than one part uses live in shared.ts.
 *
 * Every rule here is the backend's (backend/src/ads/ad-decision.service.ts):
 * the ad before the movie plays for everyone, a break plays once per viewer
 * per movie for 12 hours, nothing in the last 2 minutes (the 120-second end
 * guard), the corner picture after 60 seconds of real watching, a jump past
 * several breaks plays one ad, the higher “goes first” number wins and equal
 * ads take turns (ad-eligibility.ts `pickAd`), and the plan is made when a
 * movie opens, though every break asks again which ads are on (`midroll`).
 * The times in the example come in as "30 min" / "1 h" (adWords.ts
 * `movieTimeText`).
 */

export const howEn = {
  title: "How ads work",
  intro: "An ad can appear in three places. Only one ad plays at a time.",
  hide: "Hide",
  /** The three places, numbered 1–3 on the card. */
  places: {
    PREROLL: {
      title: "Before the movie",
      text: "A video ad plays when someone starts a movie. Everyone sees it, with or without Premium.",
    },
    MIDROLL: {
      title: "Ad breaks",
      text: "The movie pauses, one video ad plays, then the movie carries on from the same spot. You choose how often in Ad settings — for example every 30 minutes.",
    },
    CORNER: {
      title: "Corner picture",
      text: "A small picture in the top-right corner while the movie plays. Tapping it opens your web page.",
    },
  },
  exampleTitle: "Example: a 2-hour movie with ad breaks every 30 minutes",
  /** The example's timeline: a mark at the start, one per break, one at the end. */
  timeline: {
    start: "Start",
    adBefore: "ad before the movie",
    corner: (time: string) => `${time}: corner picture appears →`,
    adBreak: "ad break",
    lastMinutes: "last 2 minutes: no ads",
  },
  goodToKnow: "Good to know",
  rules: [
    "Each ad break plays only once per viewer per movie. If someone watches the same movie again within 12 hours, they don’t get those breaks again.",
    "There are never ads in the last 2 minutes of a movie.",
    "The corner picture appears after 1 minute of real watching — skipping forward doesn’t count. Movies of 3 minutes or less never show it.",
    "Skipping forward past several breaks plays just one ad.",
    "If several ads could play in the same place, the one with the higher “goes first” number plays. Ads with the same number take turns.",
    "Most changes reach viewers the next time they open a movie. Turning an ad or ad breaks off also applies to the breaks still to come.",
  ],
  stuck: "Not sure why an ad isn’t showing? Press “Will it show?” next to the ad.",
};

export const howMm = {
  title: "ကြော်ငြာများ ဘယ်လို အလုပ်လုပ်သလဲ",
  intro: "ကြော်ငြာကို နေရာ သုံးခုတွင် ပြနိုင်သည်။ တစ်ကြိမ်လျှင် ကြော်ငြာ တစ်ခုသာ ပြသည်။",
  hide: "ဖျောက်မည်",
  places: {
    PREROLL: {
      title: "ရုပ်ရှင် မစမီ",
      text: "တစ်စုံတစ်ယောက် ရုပ်ရှင်ကို စဖွင့်သည့်အခါ ဗီဒီယို ကြော်ငြာ တစ်ခု ပြသည်။ Premium ရှိသူ မရှိသူ လူတိုင်း မြင်ရသည်။",
    },
    MIDROLL: {
      title: "ကြားဖြတ်ကြော်ငြာ",
      text: "ရုပ်ရှင်ကို ခဏရပ်ပြီး ဗီဒီယို ကြော်ငြာ တစ်ခု ပြကာ ရပ်ခဲ့သည့်နေရာမှ ရုပ်ရှင်ကို ဆက်ပြသည်။ ဘယ်လောက်ကြာတိုင်း ပြမလဲဆိုတာကို ကြော်ငြာ ဆက်တင်တွင် ရွေးနိုင်သည် — ဥပမာ 30 မိနစ်တိုင်း။",
    },
    CORNER: {
      title: "ထောင့်ပုံ ကြော်ငြာ",
      text: "ရုပ်ရှင်ပြနေစဉ် ညာဘက် အပေါ်ထောင့်တွင် ပုံအသေး တစ်ပုံ ပေါ်သည်။ ပုံကို နှိပ်လျှင် သင့် ဝက်ဘ်စာမျက်နှာ ပွင့်လာသည်။",
    },
  },
  exampleTitle: "ဥပမာ — 30 မိနစ်တိုင်း ကြားဖြတ်ကြော်ငြာ ပြသော 2 နာရီ ရုပ်ရှင်",
  timeline: {
    start: "အစ",
    adBefore: "ရုပ်ရှင် မစမီ ကြော်ငြာ",
    corner: (time: string) => `${time} — ထောင့်ပုံ ကြော်ငြာ ပေါ်လာသည် →`,
    adBreak: "ကြားဖြတ်ကြော်ငြာ",
    lastMinutes: "နောက်ဆုံး 2 မိနစ် — ကြော်ငြာ မပြ",
  },
  goodToKnow: "သိထားသင့်သည်များ",
  rules: [
    "ကြားဖြတ်ကြော်ငြာ တစ်ခုစီကို လူတစ်ဦးသည် ရုပ်ရှင်တစ်ကားတည်းတွင် တစ်ကြိမ်သာ မြင်ရသည်။ ထိုရုပ်ရှင်ကို 12 နာရီအတွင်း ပြန်ကြည့်လျှင် ထိုကြားဖြတ်ကြော်ငြာများကို ထပ်မမြင်ရပါ။",
    "ရုပ်ရှင်၏ နောက်ဆုံး 2 မိနစ်တွင် ကြော်ငြာ ဘယ်တော့မှ မပြပါ။",
    "ထောင့်ပုံ ကြော်ငြာသည် တကယ် 1 မိနစ် ကြည့်ပြီးမှ ပေါ်သည် — ရှေ့သို့ ကျော်ကြည့်ခြင်းကို မရေတွက်ပါ။ 3 မိနစ်နှင့်အောက် ရုပ်ရှင်များတွင် လုံးဝ မပေါ်ပါ။",
    "ကြားဖြတ်ကြော်ငြာ အများအပြားကို ရှေ့သို့ ကျော်သွားလျှင် ကြော်ငြာ တစ်ခုသာ ပြသည်။",
    "နေရာတစ်ခုတည်းတွင် ပြနိုင်သော ကြော်ငြာ အများအပြား ရှိလျှင် “အရင်ပြမည့် နံပါတ်” မြင့်သော ကြော်ငြာကို ပြသည်။ နံပါတ် တူသော ကြော်ငြာများသည် အလှည့်ကျ ပြသည်။",
    "ပြောင်းလဲမှု အများစုသည် ကြည့်သူများ နောက်တစ်ကြိမ် ရုပ်ရှင်ဖွင့်မှ သက်ရောက်သည်။ ကြော်ငြာ တစ်ခု သို့မဟုတ် ကြားဖြတ်ကြော်ငြာကို ပိတ်လိုက်လျှင် ကျန်ရှိသော ကြားဖြတ်ကြော်ငြာများတွင်လည်း သက်ရောက်သည်။",
  ],
  stuck: "ကြော်ငြာ ဘာကြောင့် မပြလဲ မသေချာဘူးလား။ ကြော်ငြာဘေးရှိ “ပြမလား စစ်ကြည့်မည်” ကို နှိပ်ပါ။",
} satisfies typeof howEn;
