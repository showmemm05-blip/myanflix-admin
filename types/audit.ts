/**
 * Wire types for the staff audit log (`GET /audit`).
 *
 * The action keys and target types are transcribed from the backend's
 * catalogue (`backend/src/audit/audit-actions.ts`), which is the single
 * source of truth — `GET /audit/catalogue` serves the same lists at runtime
 * for the filter dropdowns. The local copies exist so the i18n label maps
 * can be typed against them: a catalogue key without a label in `en` (and
 * therefore in `mm`, which mirrors it) is a compile error, not a raw key
 * leaking into a table cell.
 *
 * Timestamps are ISO strings (JSON), never `Date`. Anything nullable on the
 * Prisma model is nullable here.
 */
import type { PaginationParams } from "@/types/api";
import type { ClientPlatform } from "@/types/tracking";
import type { UserRole } from "@/types/user";

// ---------------------------------------------------------------- enums

/** Prisma `AuditCategory`, in the order the filter offers them. */
export const AUDIT_CATEGORIES = ["CONTENT", "USERS", "FINANCE", "STAFF", "SYSTEM"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/**
 * Every snake_case noun an audit row can point at. Mirrors the backend catalogue
 * (backend/src/audit/audit-actions.ts); episodes are recorded as `movie`.
 */
export const AUDIT_TARGET_TYPES = [
  "movie",
  "series",
  "subtitle",
  "category",
  "actor",
  "book",
  "book_edition",
  "book_part",
  "book_chapter",
  "book_section",
  "book_author",
  "book_category",
  "user",
  "staff",
  "role",
  "level",
  "deposit",
  "withdrawal",
  "payment_account",
  "payment_method_type",
  "payment_account_transaction",
  "wallet_adjustment",
  "finance_settings",
  "subscription_plan",
  "peak_users",
  "comment",
  "feedback",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/** Dotted `<target>.<verb>` keys — the full backend catalogue, grouped by category. */
export const AUDIT_ACTIONS = [
  // CONTENT
  "movie.create",
  "movie.upload",
  "movie.reprocess",
  "movie.update",
  "movie.publish",
  "movie.unpublish",
  "movie.status_change",
  "movie.delete",
  "movie.durations_backfill",
  "series.create",
  "series.update",
  "series.publish",
  "series.unpublish",
  "series.status_change",
  "series.delete",
  "subtitle.upload",
  "subtitle.update",
  "subtitle.set_default",
  "subtitle.delete",
  "category.create",
  "category.update",
  "category.delete",
  "actor.create",
  "actor.update",
  "actor.delete",
  "book.create",
  "book.update",
  "book.delete",
  "book_edition.create",
  "book_edition.update",
  "book_edition.publish",
  "book_edition.unpublish",
  "book_edition.status_change",
  "book_edition.delete",
  "book_part.create",
  "book_part.update",
  "book_part.delete",
  "book_part.reorder",
  "book_chapter.create",
  "book_chapter.update",
  "book_chapter.delete",
  "book_chapter.reorder",
  "book_chapter.process",
  "book_chapter.status_change",
  "book_section.create",
  "book_section.update",
  "book_section.delete",
  "book_section.reorder",
  "book_author.create",
  "book_author.update",
  "book_author.delete",
  "book_category.create",
  "book_category.update",
  "book_category.delete",
  // USERS
  "user.status_change",
  "user.role_change",
  "user.wallet_adjust",
  // STAFF
  "staff.create",
  "staff.update",
  "staff.role_change",
  "staff.status_change",
  "staff.password_reset",
  "staff.delete",
  "role.create",
  "role.update",
  "role.permissions_change",
  "role.delete",
  "level.create",
  "level.update",
  "level.delete",
  "level.reorder",
  // FINANCE
  "deposit.manual_create",
  "deposit.approve",
  "deposit.reject",
  "deposit.receiving_account_update",
  "withdrawal.approve",
  "withdrawal.reject",
  "withdrawal.transfer_account_update",
  "payment_account.create",
  "payment_account.update",
  "payment_account.delete",
  "payment_account.ledger_entry",
  "payment_method_type.create",
  "payment_method_type.update",
  "payment_method_type.delete",
  "finance_settings.update",
  "subscription_plan.create",
  "subscription_plan.update",
  // SYSTEM
  "peak_users.update",
  "comment.moderate",
  "comment.delete",
  "feedback.status_change",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ------------------------------------------------------------------ rows

/** One differing top-level field of an update, as the backend diffed it. */
export interface AuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

/**
 * The actor's CURRENT account, joined at read time. Null when the account
 * has since been deleted (the snapshot columns on the row still say who it
 * was) and for system events. `avatar` is the raw storage key, not a URL.
 */
export interface AuditActorRef {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  avatar: string | null;
}

/** One row of `GET /audit` — also the shape `GET /audit/:id` returns. */
export interface AuditLogEntry {
  id: string;
  /** ISO timestamp. */
  createdAt: string;
  category: AuditCategory;
  /** A catalogue key. Treat an unknown one as a plain string — a newer backend may add actions. */
  action: AuditAction | (string & {});
  /** Null for system events and for actors whose account was deleted before the row was read. */
  actorId: string | null;
  /** Snapshot at the time — `system` for events not tied to a request. */
  actorUsername: string;
  actorDisplayName: string | null;
  /** Null only for system events. */
  actorRole: UserRole | null;
  actorAppRoleId: string | null;
  actorAppRoleName: string | null;
  targetType: AuditTargetType | (string & {});
  targetId: string | null;
  targetLabel: string | null;
  /** Differing fields for updates; null for creates, deletes and pure events. */
  changes: AuditChange[] | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  platform: ClientPlatform;
  actor: AuditActorRef | null;
}

// ----------------------------------------------------------------- query

/**
 * Exactly the backend DTO's keys. The backend rejects unknown query params
 * with a 400, so nothing else may ride along on this object.
 */
export interface AuditQuery extends PaginationParams {
  /** ISO instants — send the local day's own boundaries, never a bare date. */
  from?: string;
  to?: string;
  category?: AuditCategory;
  action?: string;
  targetType?: string;
  targetId?: string;
  actorId?: string;
  /** Matches targetLabel, actorUsername and action (ILIKE); max 200 chars. */
  search?: string;
}

/** `GET /audit/catalogue` — what the filter dropdowns are built from. */
export interface AuditCatalogueAction {
  key: string;
  category: AuditCategory;
  targetType: string;
}

export interface AuditCatalogue {
  categories: AuditCategory[];
  actions: AuditCatalogueAction[];
  targetTypes: string[];
}
