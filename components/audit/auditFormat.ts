/**
 * Formatting shared by the audit table and its details dialog. Every label
 * comes out of `t.audit.*`; the one thing decided here is how a raw value
 * (a JSON scalar, a relation list, a nested object) reads in a cell.
 */
import type { StatusTone } from "@/components/shared/StatusBadge";
import { translations, type TranslationShape } from "@/lib/i18n/translations";
import type { AuditAction, AuditCategory, AuditLogEntry, AuditTargetType } from "@/types/audit";

/**
 * Compile-time parity between the catalogue and the label maps: a key added
 * to `AUDIT_ACTIONS` / `AUDIT_TARGET_TYPES` without an English label (and
 * so, via `satisfies`, without a Burmese one) fails here rather than
 * rendering as a raw key. The values are never read.
 */
const _labelledActions: Record<AuditAction, string> = translations.en.audit.actions;
const _labelledTargetTypes: Record<AuditTargetType, string> = translations.en.audit.targetTypes;
const _labelledCategories: Record<AuditCategory, string> = translations.en.audit.categories;

/**
 * One hue per category, chosen so the two that need the most attention read
 * loudest: STAFF changes (who can do what) are red, money is amber. Content
 * edits are the everyday case and get the calm blue; system events are grey
 * because nobody chose them.
 */
export const AUDIT_CATEGORY_TONE: Record<AuditCategory, StatusTone> = {
  CONTENT: "info",
  USERS: "success",
  FINANCE: "warning",
  STAFF: "danger",
  SYSTEM: "neutral",
};

/** Falls back to the raw key so a newer backend's action still reads as something. */
export function actionLabel(t: TranslationShape, action: string): string {
  return (t.audit.actions as Record<string, string | undefined>)[action] ?? action;
}

export function targetTypeLabel(t: TranslationShape, targetType: string): string {
  return (t.audit.targetTypes as Record<string, string | undefined>)[targetType] ?? targetType;
}

export function categoryLabel(t: TranslationShape, category: string): string {
  return (t.audit.categories as Record<string, string | undefined>)[category] ?? category;
}

/**
 * Where "Open" goes for a target, or null when the admin has no page for it.
 * Staff have no detail page yet, so a staff target lands on the list.
 */
export function targetHref(entry: Pick<AuditLogEntry, "targetType" | "targetId">): string | null {
  const { targetType, targetId } = entry;
  if (targetType === "staff") return "/staff";
  if (!targetId) return null;
  switch (targetType) {
    case "user":
      return `/users/${targetId}`;
    case "series":
      return `/series/${targetId}`;
    case "payment_account":
      return `/finance/payment-accounts/${targetId}`;
    default:
      return null;
  }
}

/** A system event: not tied to a request, no account behind it. */
export function isSystemEntry(entry: Pick<AuditLogEntry, "actorId" | "actorRole">): boolean {
  return entry.actorId === null && entry.actorRole === null;
}

function isNamedRef(value: unknown): value is { name: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name: unknown }).name === "string"
  );
}

/**
 * A diff value as one short line: scalars as-is, a `[{id,name}]` relation
 * list as its names ("Action, Drama"), anything else as compact JSON. The
 * dialog pretty-prints objects separately; this is the table's one-liner.
 */
export function formatChangeValue(value: unknown, none: string): string {
  if (value === null || value === undefined || value === "") return none;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return none;
    if (value.every(isNamedRef)) return value.map((item) => item.name).join(", ");
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return value.map((item) => formatChangeValue(item, none)).join(", ");
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** True for the values the dialog shows in a `<pre>` rather than inline. */
export function isStructured(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
