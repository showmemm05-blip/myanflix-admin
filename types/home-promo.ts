/**
 * Wire types for the "Home promos" admin page (2026-10-08) — the staff side
 * of `backend/src/home` (GET/POST/PATCH/DELETE /home/promos,
 * PATCH /home/promos/reorder, GET/PUT /home/settings).
 *
 * Timestamps are ISO strings (JSON), never `Date`. Anything nullable on the
 * backend view is nullable here.
 */

/** Where a promo shows on the home page. Fixed once created. */
export const HOME_PROMO_KINDS = ["HERO", "SPOTLIGHT", "COMING_SOON"] as const;
export type HomePromoKind = (typeof HOME_PROMO_KINDS)[number];

/** What the promo's button does. */
export const HOME_PROMO_CTA_TARGETS = [
  "NONE",
  "SUBSCRIBE",
  "ADD_MONEY",
  "MOVIE",
  "SERIES",
  "BOOK",
  "URL",
] as const;
export type HomePromoCtaTarget = (typeof HOME_PROMO_CTA_TARGETS)[number];

/** The button types that link one title — the only ones a SPOTLIGHT may use. */
export const HOME_PROMO_TITLE_TARGETS = ["MOVIE", "SERIES", "BOOK"] as const;
export type HomePromoTitleTarget = (typeof HOME_PROMO_TITLE_TARGETS)[number];

export function isTitleTarget(target: HomePromoCtaTarget): target is HomePromoTitleTarget {
  return (HOME_PROMO_TITLE_TARGETS as readonly string[]).includes(target);
}

/** The drawn background a promo uses when no image is uploaded. */
export const HOME_PROMO_ART_PRESETS = ["PREMIUM", "PAYMENT", "GAMES", "GENERIC"] as const;
export type HomePromoArtPreset = (typeof HOME_PROMO_ART_PRESETS)[number];

/** Whether a promo is on the home page right now, and if not, why. */
export type HomePromoLiveState = "LIVE" | "SCHEDULED" | "ENDED" | "OFF";

/**
 * Field limits — the backend's HOME_PROMO_LIMITS, copied so the form can
 * stop a too-long text before the request instead of after it.
 */
export const HOME_PROMO_LIMITS = {
  title: 120,
  kicker: 80,
  body: 400,
  ctaLabel: 40,
  url: 500,
  dateText: 40,
} as const;

/** The most promos one kind may hold (backend HOME_PROMOS_PER_KIND_MAX). */
export const HOME_PROMOS_PER_KIND_MAX = 30;

/**
 * The phone app shows at most this many hero promo slides (mobile
 * HOME_HERO_MAX_PROMOS in mobile/src/components/home/homeData.ts); the
 * website shows them all. Keep the two numbers in step.
 */
export const HOME_PHONE_HERO_MAX_PROMOS = 7;

export interface StaffRef {
  id: string;
  username: string;
  displayName: string | null;
}

/** The linked title as the staff list shows it — hidden titles included. */
export interface HomePromoTarget {
  type: HomePromoTitleTarget;
  id: string;
  /** Null when the title no longer exists. */
  title: string | null;
  imageUrl: string | null;
  /** False when deleted, unpublished, or (movie) an episode — the apps skip it. */
  isVisible: boolean;
  missing: boolean;
}

export interface HomePromo {
  id: string;
  kind: HomePromoKind;
  titleEn: string;
  titleMm: string;
  kickerEn: string | null;
  kickerMm: string | null;
  bodyEn: string | null;
  bodyMm: string | null;
  ctaLabelEn: string | null;
  ctaLabelMm: string | null;
  ctaTarget: HomePromoCtaTarget;
  targetId: string | null;
  url: string | null;
  artPreset: HomePromoArtPreset;
  imageUrl: string | null;
  dateText: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  sortOrder: number;
  liveState: HomePromoLiveState;
  target: HomePromoTarget | null;
  createdBy: StaffRef | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The editable fields. On create `kind` and both titles are required; on
 * update every field is optional (absent = keep, null = clear) and `kind`
 * is not accepted at all.
 */
export interface HomePromoFields {
  titleEn: string;
  titleMm: string;
  kickerEn: string | null;
  kickerMm: string | null;
  bodyEn: string | null;
  bodyMm: string | null;
  ctaLabelEn: string | null;
  ctaLabelMm: string | null;
  ctaTarget: HomePromoCtaTarget;
  targetId: string | null;
  url: string | null;
  artPreset: HomePromoArtPreset;
  imageUrl: string | null;
  dateText: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export type CreateHomePromoInput = HomePromoFields & { kind: HomePromoKind };
export type UpdateHomePromoInput = Partial<HomePromoFields>;

export interface HomeSettings {
  webUrl: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  gamesTeaserEnabled: boolean;
  gamesTeaserDateText: string | null;
  /** Null until the first save. */
  updatedAt: string | null;
  updatedBy: StaffRef | null;
}

/** PUT /home/settings replaces the whole row — an omitted link is cleared. */
export interface UpdateHomeSettingsInput {
  webUrl: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  gamesTeaserEnabled: boolean;
  gamesTeaserDateText: string | null;
}

/** The `code` values the backend sends with a refused promo change. */
export type HomePromoErrorCode =
  | "HOME_PROMO_NOT_FOUND"
  | "HOME_PROMO_TITLE_REQUIRED"
  | "HOME_PROMO_TRANSLATION_MISSING"
  | "HOME_PROMO_SPOTLIGHT_NEEDS_TITLE"
  | "HOME_PROMO_TARGET_REQUIRED"
  | "HOME_PROMO_TARGET_NOT_FOUND"
  | "HOME_PROMO_URL_REQUIRED"
  | "HOME_PROMO_CTA_LABEL_REQUIRED"
  | "HOME_PROMO_WINDOW_INVALID"
  | "HOME_PROMO_LIMIT_REACHED"
  | "HOME_PROMO_REORDER_MISMATCH";
