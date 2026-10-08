/**
 * The Home promos form's state, its checks and its conversion to the wire —
 * kept apart from the dialog so the rules read as one list. The checks
 * mirror the backend's (home-promos.service.ts resolveFields + the DTO
 * limits), so a mistake is explained in the form, in the admin's language,
 * before any request; the backend still re-checks everything.
 */
import { toDateTimeLocalValue } from "@/lib/datetime-local";
import { ApiError } from "@/services/api/apiClient";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { PickedTitle } from "@/components/home-promos/TitleTargetPicker";
import {
  HOME_PROMO_LIMITS,
  HOME_PROMOS_PER_KIND_MAX,
  isTitleTarget,
  type HomePromo,
  type HomePromoArtPreset,
  type HomePromoCtaTarget,
  type HomePromoFields,
  type HomePromoKind,
} from "@/types/home-promo";

export interface PromoFormState {
  kind: HomePromoKind;
  titleEn: string;
  titleMm: string;
  kickerEn: string;
  kickerMm: string;
  bodyEn: string;
  bodyMm: string;
  ctaLabelEn: string;
  ctaLabelMm: string;
  ctaTarget: HomePromoCtaTarget;
  /** The linked title, for MOVIE / SERIES / BOOK. */
  target: PickedTitle | null;
  url: string;
  artPreset: HomePromoArtPreset;
  /** The image already stored on the promo (or null). */
  imageUrl: string | null;
  /** A picked file that is uploaded on save. */
  imageFile: File | null;
  dateText: string;
  /** `datetime-local` values ("YYYY-MM-DDTHH:MM"), "" = not set. */
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** A host name label as the backend's IsUrl (validator isFQDN, require_tld off) accepts it. */
function isHostLabel(label: string): boolean {
  return (
    label.length > 0 &&
    label.length <= 63 &&
    /^[a-z\u00a1-\uffff0-9-]+$/i.test(label) &&
    !/[\uff01-\uff5e]/.test(label) &&
    !/^-|-$/.test(label)
  );
}

function isIpv6(value: string): boolean {
  if (!/^[0-9a-f:.]+$/i.test(value) || !value.includes(":")) return false;
  try {
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

/**
 * The backend's link rule (class-validator IsUrl with protocols http/https,
 * require_protocol, require_tld off — home-promo.dto.ts OptionalHttpUrl),
 * mirrored here so a link the server would refuse is caught in the form, in
 * the admin's language. It never lets through a link the server refuses; it
 * is a touch stricter in one place (the "//" after "http:" is required).
 */
export function isHttpUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.length > 2084 || /[\s<>]/.test(value)) return false;
  const match = /^(https?):\/\/(.*)$/i.exec(value);
  if (!match) return false;
  // The authority is what comes before the first "/", after dropping "#…" and "?…".
  const authority = match[2].split("#")[0].split("?")[0].split("/")[0];
  if (!authority) return false;

  const atParts = authority.split("@");
  if (atParts.length > 1) {
    if (atParts[0] === "") return false;
    const auth = atParts.shift() as string;
    const creds = auth.split(":");
    if (creds.length > 2) return false;
    if (creds[0] === "" && (creds[1] ?? "") === "") return false;
  }
  const hostPort = atParts.join("@");

  let host: string;
  let port: string | null = null;
  let ipv6: string | null = null;
  const bracketed = /^\[([^\]]+)\](?::([0-9]+))?$/.exec(hostPort);
  if (bracketed) {
    host = "";
    ipv6 = bracketed[1];
    port = bracketed[2] ?? null;
  } else {
    const parts = hostPort.split(":");
    host = parts.shift() as string;
    if (parts.length) port = parts.join(":");
  }
  if (port !== null && port.length > 0) {
    if (!/^[0-9]+$/.test(port)) return false;
    const number = Number.parseInt(port, 10);
    if (number <= 0 || number > 65535) return false;
  }

  if (ipv6 !== null) return isIpv6(ipv6);
  if (IPV4.test(host)) return true;
  const labels = host.split(".");
  // No all-digit last part ("1.2.3.999" is neither an address nor a name).
  if (/^\d+$/.test(labels[labels.length - 1])) return false;
  return labels.every(isHostLabel);
}

/** ISO from the server -> the value a `datetime-local` input shows (minutes). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : toDateTimeLocalValue(date).slice(0, 16);
}

/** A `datetime-local` value -> strict ISO-8601 (UTC), or null when empty. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function emptyForm(kind: HomePromoKind): PromoFormState {
  return {
    kind,
    titleEn: "",
    titleMm: "",
    kickerEn: "",
    kickerMm: "",
    bodyEn: "",
    bodyMm: "",
    ctaLabelEn: "",
    ctaLabelMm: "",
    // A spotlight must link a title, so it starts on "A movie".
    ctaTarget: kind === "SPOTLIGHT" ? "MOVIE" : "NONE",
    target: null,
    url: "",
    artPreset: "GENERIC",
    imageUrl: null,
    imageFile: null,
    dateText: "",
    startsAt: "",
    endsAt: "",
    isActive: true,
  };
}

export function formFromPromo(promo: HomePromo): PromoFormState {
  return {
    kind: promo.kind,
    titleEn: promo.titleEn,
    titleMm: promo.titleMm,
    kickerEn: promo.kickerEn ?? "",
    kickerMm: promo.kickerMm ?? "",
    bodyEn: promo.bodyEn ?? "",
    bodyMm: promo.bodyMm ?? "",
    ctaLabelEn: promo.ctaLabelEn ?? "",
    ctaLabelMm: promo.ctaLabelMm ?? "",
    ctaTarget: promo.ctaTarget,
    target:
      promo.target && promo.targetId
        ? {
            id: promo.target.id,
            title: promo.target.title,
            imageUrl: promo.target.imageUrl,
            isVisible: promo.target.isVisible,
            missing: promo.target.missing,
          }
        : null,
    url: promo.url ?? "",
    artPreset: promo.artPreset,
    imageUrl: promo.imageUrl,
    imageFile: null,
    dateText: promo.dateText ?? "",
    startsAt: toLocalInput(promo.startsAt),
    endsAt: toLocalInput(promo.endsAt),
    isActive: promo.isActive,
  };
}

/** Whether the button-text pair is shown for this kind/button (spotlights use the apps' own buttons). */
export function showsCtaLabel(kind: HomePromoKind, ctaTarget: HomePromoCtaTarget): boolean {
  return kind !== "SPOTLIGHT" && ctaTarget !== "NONE";
}

/** Only coming-soon cards carry a date line. */
export function showsDateText(kind: HomePromoKind): boolean {
  return kind === "COMING_SOON";
}

const orNull = (value: string) => {
  const text = value.trim();
  return text === "" ? null : text;
};

/** The wire fields, given the image URL to store (already uploaded when a file was picked). */
export function toFields(state: PromoFormState, imageUrl: string | null): HomePromoFields {
  return {
    titleEn: state.titleEn.trim(),
    titleMm: state.titleMm.trim(),
    kickerEn: orNull(state.kickerEn),
    kickerMm: orNull(state.kickerMm),
    bodyEn: orNull(state.bodyEn),
    bodyMm: orNull(state.bodyMm),
    // Hidden fields are sent empty, so a value typed before the admin
    // switched the place or the button never reaches the apps unseen.
    ctaLabelEn: showsCtaLabel(state.kind, state.ctaTarget) ? orNull(state.ctaLabelEn) : null,
    ctaLabelMm: showsCtaLabel(state.kind, state.ctaTarget) ? orNull(state.ctaLabelMm) : null,
    ctaTarget: state.ctaTarget,
    targetId: isTitleTarget(state.ctaTarget) ? state.target?.id ?? null : null,
    url: state.ctaTarget === "URL" ? orNull(state.url) : null,
    artPreset: state.artPreset,
    imageUrl,
    dateText: showsDateText(state.kind) ? orNull(state.dateText) : null,
    startsAt: fromLocalInput(state.startsAt),
    endsAt: fromLocalInput(state.endsAt),
    isActive: state.isActive,
  };
}

/** Only the fields that differ from the stored promo — PATCH semantics (absent = keep). */
export function changedFields(promo: HomePromo, next: HomePromoFields): Partial<HomePromoFields> {
  const changed: Partial<HomePromoFields> = {};
  const sameInstant = (a: string | null, b: string | null) =>
    a === b || (!!a && !!b && new Date(a).getTime() === new Date(b).getTime());
  (Object.keys(next) as (keyof HomePromoFields)[]).forEach((key) => {
    const before = promo[key];
    const after = next[key];
    const same =
      key === "startsAt" || key === "endsAt"
        ? sameInstant(before as string | null, after as string | null)
        : before === after;
    if (!same) (changed as Record<string, unknown>)[key] = after;
  });
  return changed;
}

/**
 * Every rule the form breaks right now, in the admin's language — empty
 * means Save may be pressed.
 */
export function formProblems(state: PromoFormState, t: TranslationShape): string[] {
  const p = t.homePromos.problems;
  const names = t.homePromos.fieldNames;
  const problems: string[] = [];
  const blank = (value: string) => value.trim() === "";

  if (blank(state.titleEn) || blank(state.titleMm)) problems.push(p.titleRequired);

  const pairs: [string, string, string][] = [
    [state.kickerEn, state.kickerMm, names.kicker],
    [state.bodyEn, state.bodyMm, names.body],
  ];
  if (showsCtaLabel(state.kind, state.ctaTarget)) {
    pairs.push([state.ctaLabelEn, state.ctaLabelMm, names.ctaLabel]);
  }
  for (const [en, mm, name] of pairs) {
    if (blank(en) !== blank(mm)) problems.push(p.pairMissing(name));
  }

  if (state.kind === "SPOTLIGHT" && !isTitleTarget(state.ctaTarget)) {
    problems.push(p.spotlightNeedsTitle);
  }
  if (isTitleTarget(state.ctaTarget)) {
    if (!state.target) problems.push(p.targetRequired);
    // The backend re-checks the linked title on every save, so a deleted one
    // has to be replaced (or the button changed) before anything else saves.
    else if (state.target.missing) problems.push(p.targetDeleted);
  }
  if (state.ctaTarget === "URL") {
    if (blank(state.url)) problems.push(p.urlRequired);
    else if (!isHttpUrl(state.url)) problems.push(p.urlInvalid);
  }
  if (
    state.kind === "HERO" &&
    state.ctaTarget !== "NONE" &&
    (blank(state.ctaLabelEn) || blank(state.ctaLabelMm))
  ) {
    problems.push(p.ctaLabelRequired);
  }

  const start = fromLocalInput(state.startsAt);
  const end = fromLocalInput(state.endsAt);
  if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
    problems.push(p.windowInvalid);
  }

  const limits: [string[], number, string][] = [
    [[state.titleEn, state.titleMm], HOME_PROMO_LIMITS.title, names.title],
    [[state.kickerEn, state.kickerMm], HOME_PROMO_LIMITS.kicker, names.kicker],
    [[state.bodyEn, state.bodyMm], HOME_PROMO_LIMITS.body, names.body],
  ];
  if (showsCtaLabel(state.kind, state.ctaTarget)) {
    limits.push([[state.ctaLabelEn, state.ctaLabelMm], HOME_PROMO_LIMITS.ctaLabel, names.ctaLabel]);
  }
  if (state.ctaTarget === "URL") limits.push([[state.url], HOME_PROMO_LIMITS.url, names.url]);
  if (showsDateText(state.kind)) {
    limits.push([[state.dateText], HOME_PROMO_LIMITS.dateText, names.dateText]);
  }
  for (const [values, max, name] of limits) {
    if (values.some((value) => value.trim().length > max)) problems.push(p.tooLong(name, max));
  }

  return problems;
}

/**
 * The words for a refused request: a known backend `code` in the admin's
 * language, otherwise the backend's own sentence.
 */
export function promoErrorMessage(err: unknown, t: TranslationShape): string {
  if (!(err instanceof ApiError)) return t.common.somethingWentWrong;
  const p = t.homePromos.problems;
  const byCode: Record<string, string> = {
    ...t.homePromos.serverErrors,
    HOME_PROMO_TITLE_REQUIRED: p.titleRequired,
    HOME_PROMO_SPOTLIGHT_NEEDS_TITLE: p.spotlightNeedsTitle,
    HOME_PROMO_TARGET_REQUIRED: p.targetRequired,
    HOME_PROMO_URL_REQUIRED: p.urlRequired,
    HOME_PROMO_CTA_LABEL_REQUIRED: p.ctaLabelRequired,
    HOME_PROMO_WINDOW_INVALID: p.windowInvalid,
    HOME_PROMO_LIMIT_REACHED: t.homePromos.listFull(HOME_PROMOS_PER_KIND_MAX),
  };
  return (err.code && byCode[err.code]) || err.message;
}
