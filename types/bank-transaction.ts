/**
 * A bank notification a phone captured, stored BEFORE matching (the
 * store-first `bank_transactions` table). Mirrors the backend's
 * `BankTransactionDirection` / `BankTransactionState` enums and the list
 * item `GET /bank-transactions` serves.
 *
 * Money direction is from the BUSINESS account's point of view: RECEIVED is
 * a customer paying in (a deposit candidate), SENT is a payout going out (a
 * withdrawal candidate).
 */
import type { PaginationParams } from "@/types/api";

export type BankTransactionDirection = "RECEIVED" | "SENT";

/**
 * Stored on the row. UNMATCHED = nothing claimed it yet; MATCHED = linked to
 * exactly one deposit/withdrawal; AMBIGUOUS = two or more fit and nobody
 * guessed. "Unclaimed" is deliberately NOT a member — see BankTransactionView.
 */
export type BankTransactionState = "UNMATCHED" | "MATCHED" | "AMBIGUOUS";

/**
 * What the badge shows. UNCLAIMED is never stored: it is UNMATCHED plus a
 * bank time older than 48 h, computed at read time (server `view` field and
 * the client twin in lib/bank-transactions.ts) so nothing ever sweeps the
 * table to flip it. WAITING is UNMATCHED inside the window.
 */
export type BankTransactionView = "MATCHED" | "WAITING" | "AMBIGUOUS" | "UNCLAIMED";

/** The server-side `state` list filter. `unmatched` = waiting (inside 48 h); `unclaimed` = past it. */
export type BankTransactionStateFilter = "all" | "unmatched" | "matched" | "ambiguous" | "unclaimed";

export const BANK_TRANSACTION_STATE_FILTERS: BankTransactionStateFilter[] = [
  "all",
  "unmatched",
  "matched",
  "ambiguous",
  "unclaimed",
];

export interface BankTransaction {
  id: string;
  /** The phone that captured it — the only identity a phone has; there is no server-side device name. */
  deviceSerial: string;
  /** OUR account the notification belongs to (the phone's accounts map resolves serial → account). */
  paymentAccountId: string;
  /** "type · subname" built from the list join; null on socket payloads (they carry the id only). */
  paymentAccountLabel: string | null;
  direction: BankTransactionDirection;
  amount: number;
  currency: string;
  /** The full transaction code as the bank printed it. */
  txCode: string;
  /** The last 6 — what a depositor types as their reference, and what the matcher joins on. */
  txCodeLast6: string;
  /** The BANK's time (from the voucher) — the axis every list and match uses. */
  occurredAt: string;
  /** When the notification reached the phone — kept for the audit trail. */
  postedAt: string;
  /** Sender/receiver name as the bank printed it, when the phone could read it. */
  counterparty: string | null;
  /** What the phone's KBZPay detail flow reported (ok | locked | … | not_needed), free text. */
  detailStatus: string | null;
  state: BankTransactionState;
  /** As the server derived it at read time — re-derived client-side by `viewOf()` as the clock moves. */
  view: BankTransactionView;
  linkedDepositId: string | null;
  linkedWithdrawalId: string | null;
  matchedAt: string | null;
  /** The screenshot itself is never in JSON — it streams through the BANK_EVIDENCE route. */
  hasScreenshot: boolean;
  createdAt: string;
}

/** One phone as `GET /bank-transactions/devices` reports it. */
export interface BankTransactionDevice {
  deviceSerial: string;
  /** Latest bank time this phone reported — null only for a serial with no rows (never sent today). */
  lastSeenAt: string | null;
  last24hCount: number;
  /** Lifetime count, capped: exact up to 1000, then 1000 with `totalCapped` (an exact count would scale with rows). */
  total: number;
  totalCapped: boolean;
}

/**
 * Exactly the backend DTO's keys — the global whitelist answers 400 to any
 * query param it does not know, so nothing else may ride along.
 */
export interface BankTransactionQuery extends PaginationParams {
  deviceSerial?: string;
  paymentAccountId?: string;
  direction?: BankTransactionDirection;
  state?: BankTransactionStateFilter;
  /** ISO instants on occurredAt — send the local day's own boundaries, never a bare date. */
  from?: string;
  to?: string;
}
