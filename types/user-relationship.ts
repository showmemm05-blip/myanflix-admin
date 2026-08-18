/**
 * Wire types for `GET /api/users/relationships?phone=<string>`.
 *
 * The relationship KEY is phone numbers, and the only trustworthy phone
 * numbers we hold per transaction are:
 *   - `User.phone` (the profile number)  → edge kind "PROFILE"
 *   - `Withdrawal.accountNumber`         → edge kind "WITHDRAWAL"
 *
 * Deposits deliberately do NOT contribute links: a deposit records only OUR
 * receiving account (shared by every customer), so linking through it would
 * collapse the whole customer base into one blob. Deposit counts/amounts are
 * still carried here — they are node/panel *statistics*, never edges.
 *
 * Shapes mirror the backend response exactly; amounts arrive as plain numbers
 * (the backend's `decimalToNumber` convention) and dates as ISO strings.
 */

/** The number that was searched, in both the form the admin typed and the digits-only form used for matching. */
export interface RelationshipSeedPhone {
  raw: string;
  normalized: string;
}

/** A user account discovered inside the network. */
export interface RelationshipNetworkUser {
  id: string;
  /** Display name — the backend sends the username here when no separate name exists. */
  name: string;
  username: string;
  /** Profile phone as stored (may be +95-prefixed); null when the account has none. */
  profilePhone: string | null;
  depositCount: number;
  withdrawalCount: number;
  totalDepositedAmount: number;
  totalWithdrawnAmount: number;
  /** BFS distance from the seed phone (seed phone = 0, its users = 1, …). */
  depth: number;
  createdAt: string;
}

/**
 * One user's row under a phone number — the details panel's "Users Using This
 * Number" list.
 *
 * Two different things sit in here, and mixing them up is the whole trap:
 *   - `withdrawalCount` / `totalAmount` are usage OF THIS NUMBER (withdrawals
 *     this user sent to it).
 *   - `depositCount` / `totalDepositedAmount` are the user's OWN deposit
 *     totals, network-wide. A deposit has no depositor phone to attribute it
 *     to, so these repeat unchanged on every phone the user is attached to.
 *     They are statistics about the person, printed next to their name.
 */
export interface RelationshipPhoneUser {
  userId: string;
  /** Withdrawals this user sent to this number — every row, any status. */
  withdrawalCount: number;
  /** APPROVED withdrawals to this number only. */
  totalAmount: number;
  /** Every deposit row of this user, any status. Identical to the matching `RelationshipNetworkUser.depositCount`. */
  depositCount: number;
  /** APPROVED deposits of this user only. Identical to the matching `RelationshipNetworkUser.totalDepositedAmount`. */
  totalDepositedAmount: number;
}

/** A phone number discovered inside the network. */
export interface RelationshipNetworkPhone {
  /** Display form — spacing/format as recorded on the source record. */
  phone: string;
  /** Digits-only form; this is the identity used for matching and for node ids. */
  normalized: string;
  userCount: number;
  /** Withdrawals sent TO this number — every row, any status. */
  withdrawalCount: number;
  /**
   * Deposits made BY the users attached to this number — NOT deposits linked
   * to the number, because no such link exists in the data (a deposit records
   * only our receiving account). Each attached user folds in exactly once, so
   * two withdrawals tying the same user here don't double it; a user on
   * several numbers does contribute to each of them.
   */
  depositCount: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
  depth: number;
  users: RelationshipPhoneUser[];
}

/** How a user is attached to a phone number. PROFILE = it is their account phone; WITHDRAWAL = they withdrew to it. */
export type RelationshipEdgeKind = "PROFILE" | "WITHDRAWAL";

export interface RelationshipNetworkEdge {
  userId: string;
  /** The phone's NORMALIZED value — matches `RelationshipNetworkPhone.normalized`. */
  phone: string;
  kind: RelationshipEdgeKind;
  withdrawalCount: number;
  totalAmount: number;
}

export interface RelationshipNetworkStats {
  totalUsers: number;
  totalPhones: number;
  totalDeposits: number;
  totalWithdrawals: number;
  maxDepth: number;
  /** True when the BFS hit MAX_NODES/MAX_DEPTH — the view is a partial network. */
  truncated: boolean;
  /** True when the activity list hit its ceiling and is not the whole history. */
  activityTruncated: boolean;
}

export type RelationshipActivityType = "DEPOSIT" | "WITHDRAWAL";

/** Last ~10 money movements across every discovered user, newest first. */
export interface RelationshipActivityItem {
  id: string;
  type: RelationshipActivityType;
  userId: string;
  userName: string;
  amount: number;
  /** Deposit/withdrawal status string as stored (PENDING | APPROVED | REJECTED | …). */
  status: string;
  createdAt: string;
  /** Deposit: how they say they paid. Withdrawal: the payout account type. */
  method: string | null;
  /** Deposit: the 6-digit payment reference. Null on withdrawals — they have none. */
  reference: string | null;
  /**
   * The number this row touches: a withdrawal's payout account, which IS one
   * of the phone nodes on the canvas. Null for deposits, because no depositor
   * phone is recorded anywhere in a deposit.
   */
  phone: string | null;
}

/** Full payload — an unmatched phone returns 200 with empty arrays, never a 404. */
export interface RelationshipNetwork {
  seedPhone: RelationshipSeedPhone;
  users: RelationshipNetworkUser[];
  phones: RelationshipNetworkPhone[];
  edges: RelationshipNetworkEdge[];
  stats: RelationshipNetworkStats;
  recentActivity: RelationshipActivityItem[];
}
