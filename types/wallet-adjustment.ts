export type WalletAdjustmentDirection = "CREDIT" | "DEBIT";

/** The staff member who performed the adjustment — null if that account was since deleted. */
export interface WalletAdjustmentPerformedBy {
  id: string;
  /** Login identity. Render `userLabel()` instead — never this raw. */
  username: string;
  displayName: string | null;
}

export interface WalletAdjustment {
  id: string;
  userId: string;
  direction: WalletAdjustmentDirection;
  /** Always a positive magnitude — `direction` carries the sign. */
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  /** Internal staff note — never shown to the user. */
  reason: string;
  idempotencyKey: string;
  transactionId: string | null;
  performedBy: WalletAdjustmentPerformedBy | null;
  createdAt: string;
}

/**
 * POST result — the created (or replayed) adjustment record. `replayed: true`
 * means the idempotency key had already been used for this user, so the server
 * returned the existing adjustment without touching the balance again.
 */
export interface WalletAdjustmentResult extends WalletAdjustment {
  replayed: boolean;
}

export interface CreateWalletAdjustmentValues {
  direction: WalletAdjustmentDirection;
  /** Positive magnitude in Ks — `direction` decides credit vs debit. */
  amount: number;
  reason: string;
  /** Client-generated per dialog open (crypto.randomUUID()) — the server's duplicate-submit guard. */
  idempotencyKey: string;
}
