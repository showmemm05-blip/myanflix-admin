/**
 * Wire types for the Lottery "Dreams" admin page (2026-10-19) — the staff
 * side of `backend/src/lottery` (GET /lottery/admin/dreams, PATCH
 * /lottery/admin/dreams/:id, POST /lottery/admin/dreams/import, GET
 * /lottery/admin/dreams/export).
 *
 * A dream is one row of a dream book: Dream 1000 has one row for every
 * three-digit number 000–999, Dream 100 one for every two-digit number
 * 00–99. The rows exist from the start (numbers only); the admin fills in
 * the names and pictures. A row with no name is never shown to customers.
 */

/** The two dream books. On the wire the book is the string "1000" or "100". */
export const LOTTERY_DREAM_BOOKS = ["1000", "100"] as const;
export type LotteryDreamBook = (typeof LOTTERY_DREAM_BOOKS)[number];

/**
 * Field limits — the backend's LOTTERY_DREAM_LIMITS, copied so the form can
 * stop a too-long name before the request instead of after it.
 */
export const LOTTERY_DREAM_LIMITS = {
  name: 120,
} as const;

export interface LotteryDream {
  id: string;
  book: LotteryDreamBook;
  /** Zero-padded to the book's digits. */
  number: string;
  nameEn: string | null;
  nameMy: string | null;
  /** Absolute image URL, or null for the placeholder picture. */
  pictureUrl: string | null;
  isActive: boolean;
}

/** The admin list's filter tabs. */
export const LOTTERY_DREAM_FILTERS = ["all", "missing_name", "missing_picture", "inactive"] as const;
export type LotteryDreamFilter = (typeof LOTTERY_DREAM_FILTERS)[number];

export interface LotteryDreamListQuery {
  book: LotteryDreamBook;
  /** Matches the English or Burmese name (contains) or the number (prefix). */
  q?: string;
  filter?: LotteryDreamFilter;
  page?: number;
  /** At most 100; the backend's default is 50. */
  pageSize?: number;
}

export interface LotteryDreamPage {
  items: LotteryDream[];
  total: number;
  page: number;
  pageSize: number;
}

/** PATCH semantics: absent = keep, null = clear. */
export interface UpdateLotteryDreamInput {
  nameEn?: string | null;
  nameMy?: string | null;
  pictureUrl?: string | null;
  isActive?: boolean;
}

export interface LotteryDreamImportError {
  /** The spreadsheet row (1 = the header row). */
  row: number;
  message: string;
}

/** The outcome of an import — a preview (dryRun) or the applied run. */
export interface LotteryDreamImportResult {
  total: number;
  updated: number;
  unchanged: number;
  errors: LotteryDreamImportError[];
}

// ------------------------------------------------------------------ phase 2
// Draws, settings and tickets (2026-10-19) — the staff side of
// /lottery/admin/settings, /lottery/admin/draws and their tickets. The wire
// shapes are the contract's; every instant is an ISO string in UTC (the
// pages show Myanmar time, see lib/myanmar-time.ts), every amount a number
// of kyat.

/** A draw's life: scheduled → open ⇄ paused → closed → published (phase 3). */
export const LOTTERY_DRAW_STATUSES = ["scheduled", "open", "paused", "closed", "published"] as const;
export type LotteryDrawStatus = (typeof LOTTERY_DRAW_STATUSES)[number];

/** The draws list's status tabs: every status, plus all of them. */
export const LOTTERY_DRAW_FILTERS = ["all", ...LOTTERY_DRAW_STATUSES] as const;
export type LotteryDrawFilter = (typeof LOTTERY_DRAW_FILTERS)[number];

/** A ticket waits for the results; phase 3 settles it either way. */
export const LOTTERY_TICKET_STATUSES = ["waiting", "won", "notwon"] as const;
export type LotteryTicketStatus = (typeof LOTTERY_TICKET_STATUSES)[number];

/**
 * The backend's limits, copied so the forms stop a bad value before the
 * request: the DTO ranges for the settings, the off-sale list cap, and the
 * six digits of a Thai lottery number.
 */
export const LOTTERY_LIMITS = {
  /** At least 1 Ks, at most 2 decimals (the DTO's Min(1) + maxDecimalPlaces 2). */
  ticketPrice: { min: 1, decimals: 2 },
  maxPerNumber: { min: 1, max: 100 },
  salesCloseMinutesBefore: { min: 0, max: 1440 },
  /** Days after publishing in which a prize can still be requested (the DTO's 1..730). */
  claimDeadlineDays: { min: 1, max: 730 },
  exchangeRateDecimals: 4,
  offSaleNumbers: 1000,
  numberDigits: 6,
} as const;

/** The six digits of a ticket number, as the backend checks them. */
export const LOTTERY_NUMBER_PATTERN = /^\d{6}$/;

/** The staff member who last saved the settings — the backend sends the label resolved. */
export interface LotterySettingsStaffRef {
  id: string;
  label: string;
}

/** GET / PATCH /lottery/admin/settings — the single settings row. */
export interface LotterySettings {
  ticketPrice: number;
  maxPerNumber: number;
  /** Kyat per one Baht; prizes are Baht × this (phase 3). */
  exchangeRate: number;
  /** Sales close this many minutes before the Thai draw (14:00 Myanmar time). */
  salesCloseMinutesBefore: number;
  /**
   * The ticket frame every new draw copies (an `images/lottery_frame/`
   * upload, absolute URL); null = the apps' built-in frame.
   */
  frameUrl: string | null;
  /**
   * Where the winning numbers are fetched from (http/https). Null = fetching
   * is off and results are entered by hand. "{date}" in it is replaced with
   * the draw date as YYYYMMDD; without it the URL returns the latest draw.
   */
  resultsUrl: string | null;
  /** The parser the URL is read with — "thai_lotto_json" is the only one. */
  resultsSourceKind: string;
  /**
   * Days after publishing in which a winner can still request their prize
   * (2026-10-24); a prize never requested by then expires. Copied into a
   * draw as `claimDeadlineAt` when it is published.
   */
  claimDeadlineDays: number;
  updatedAt: string;
  updatedBy: LotterySettingsStaffRef | null;
}

/** PATCH semantics: only the fields sent change. A null frameUrl goes back to the built-in frame; a null resultsUrl turns fetching off. */
export interface UpdateLotterySettingsInput {
  ticketPrice?: number;
  maxPerNumber?: number;
  exchangeRate?: number;
  salesCloseMinutesBefore?: number;
  claimDeadlineDays?: number;
  frameUrl?: string | null;
  resultsUrl?: string | null;
}

/** What customers see of a draw — the public shape, also inside AdminDraw. */
export interface LotteryDraw {
  id: string;
  drawNo: number;
  /** "YYYY-MM-DD", the Thai lottery's own date. */
  thaiDrawDate: string;
  /** The Thai draw: thaiDrawDate at 07:30 UTC (14:30 Bangkok, 14:00 Myanmar). */
  drawAt: string;
  salesCloseAt: string;
  status: LotteryDrawStatus;
  /** Copied from the settings when the draw was created. */
  ticketPrice: number;
  maxPerNumber: number;
  pictureUrl: string | null;
  /** The ticket frame copied from the settings at creation (or the draw's own); null = the built-in frame. */
  frameUrl: string | null;
  openedAt: string | null;
  closedAt: string | null;
  publishedAt: string | null;
}

/** A draw as the admin list and detail see it: the public shape plus the counters. */
export interface LotteryAdminDraw extends LotteryDraw {
  /** Copied at publish time (phase 3); null until then. */
  exchangeRate: number | null;
  ticketsSold: number;
  revenueKs: number;
  buyers: number;
  /** Winning tickets, from the payouts; null until published. */
  winnersCount: number | null;
  /**
   * Kyat actually paid into wallets so far — since 2026-10-24 publishing
   * pays nobody, so this grows one confirmed claim at a time; null until
   * published.
   */
  prizesPaidKs: number | null;
  /** Kyat awarded by publishing (every winning ticket's prize); null until published. */
  prizeTotalKs: number | null;
  /** When unrequested prizes expire: publishedAt + the setting's days; null until published. */
  claimDeadlineAt: string | null;
  /**
   * How the draw's prize claims stand, from the payouts grouped by status —
   * null until published. Sent with GET /draws/:id; the list may leave it out.
   */
  claims?: LotteryDrawClaimsSummary | null;
  /** Only on GET /draws/:id — the list leaves it out. */
  offSaleNumbers?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LotteryDrawListQuery {
  status?: LotteryDrawStatus;
  page?: number;
  pageSize?: number;
}

export interface LotteryDrawPage {
  items: LotteryAdminDraw[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * POST /lottery/admin/draws. Absent drawNo = the next one; absent
 * salesCloseAt = drawAt minus the setting; absent frameUrl = the setting's
 * frame is copied.
 */
export interface CreateLotteryDrawInput {
  drawNo?: number;
  thaiDrawDate: string;
  salesCloseAt?: string;
  pictureUrl?: string;
  frameUrl?: string;
}

/**
 * PATCH /lottery/admin/draws/:id. The backend refuses a locked field (date,
 * price, limit, picture and frame once tickets are sold; date, price and
 * limit once published; the closing time once closed) — the form greys them
 * out first. A null pictureUrl clears the picture; a null frameUrl goes
 * back to the built-in frame.
 */
export interface UpdateLotteryDrawInput {
  thaiDrawDate?: string;
  salesCloseAt?: string;
  pictureUrl?: string | null;
  frameUrl?: string | null;
  ticketPrice?: number;
  maxPerNumber?: number;
}

/** The customer on a ticket row, enough to name and find them. */
export interface LotteryTicketUserRef {
  id: string;
  /** Login identity. Render `userLabel()` instead — never this raw. */
  username: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
}

/** One row of GET /lottery/admin/draws/:id/tickets. */
export interface LotteryAdminTicket {
  /** "MFL-<drawNo>-<seq>", e.g. MFL-24-000468. */
  ticketNo: string;
  number: string;
  /** "LP-yymmdd-nnnn", the purchase the ticket came from. */
  purchaseRef: string;
  boughtAt: string;
  status: LotteryTicketStatus;
  /**
   * Kyat paid for this ticket; null until the draw is published (and for a
   * ticket that did not win). Both prize fields arrive with the publish
   * half of the backend (phase 3 B); the rows render without them until then.
   */
  prizeKs: number | null;
  /** The groups the ticket won, in sheet order; null until published or when it did not win. */
  wonGroups: LotteryTicketWonGroup[] | null;
  user: LotteryTicketUserRef;
}

export interface LotteryTicketListQuery {
  /** Matches the ticket ID, a number prefix, the purchase ref, or the customer. */
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface LotteryTicketPage {
  items: LotteryAdminTicket[];
  total: number;
  page: number;
  pageSize: number;
}

// ------------------------------------------------------------------ phase 3
// Results, prizes and payouts (2026-10-19) — the staff side of
// /lottery/admin/draws/:id/results, …/publish-preview, …/publish,
// …/winners and /lottery/admin/settings/results-test. The winning numbers
// come from an external Thai lottery source (or the admin's hands); prizes
// are the Thai Baht amounts × the draw's exchange rate, paid into wallets
// when the admin publishes.

/** The nine prize groups of a Thai draw, in the fixed order the results sheet lists them. */
export const LOTTERY_PRIZE_GROUP_KEYS = [
  "first",
  "nearFirst",
  "second",
  "third",
  "fourth",
  "fifth",
  "front3",
  "back3",
  "back2",
] as const;
export type LotteryPrizeGroupKey = (typeof LOTTERY_PRIZE_GROUP_KEYS)[number];

/** How many numbers each group holds and how many digits each has — the Thai structure, 173 numbers in all. */
export const LOTTERY_PRIZE_GROUP_SHAPE: Record<LotteryPrizeGroupKey, { count: number; digits: 6 | 3 | 2 }> = {
  first: { count: 1, digits: 6 },
  nearFirst: { count: 2, digits: 6 },
  second: { count: 5, digits: 6 },
  third: { count: 10, digits: 6 },
  fourth: { count: 50, digits: 6 },
  fifth: { count: 100, digits: 6 },
  front3: { count: 2, digits: 3 },
  back3: { count: 2, digits: 3 },
  back2: { count: 1, digits: 2 },
};

/**
 * The Thai Government Lottery's prize per winning ticket, in Baht — what the
 * "Enter by hand" dialog prefills when the source has not sent amounts.
 */
export const LOTTERY_PRIZE_GROUP_DEFAULT_BAHT: Record<LotteryPrizeGroupKey, number> = {
  first: 6_000_000,
  nearFirst: 100_000,
  second: 200_000,
  third: 80_000,
  fourth: 40_000,
  fifth: 20_000,
  front3: 4_000,
  back3: 4_000,
  back2: 2_000,
};

/**
 * A results record's life: pending (nothing fetched yet) → fetched (from the
 * source or by hand) → published (locked); failed = the last fetch errored
 * and the cron will try again. Lowercase on the wire like the draw statuses.
 */
export const LOTTERY_RESULT_STATUSES = ["pending", "fetched", "published", "failed"] as const;
export type LotteryResultStatus = (typeof LOTTERY_RESULT_STATUSES)[number];

export const LOTTERY_RESULT_SOURCES = ["api", "manual"] as const;
export type LotteryResultSource = (typeof LOTTERY_RESULT_SOURCES)[number];

/** One group of a results sheet as the backend sends it (its PrizeGroupView). */
export interface LotteryResultGroup {
  key: LotteryPrizeGroupKey;
  /** The backend's English name for the group; the admin shows its own label. */
  name: string;
  /** Prize per winning ticket, in Baht. */
  baht: number;
  count: number;
  digits: 6 | 3 | 2;
  numbers: string[];
  /** Baht × the record's `rate`, to the cent; null when no rate is known. */
  ks: number | null;
}

/**
 * GET /lottery/admin/draws/:id/results — the draw's single results record
 * (the backend's ResultsView). The row is made on first read, so the GET
 * never 404s for a draw that exists: before anything is fetched it is
 * `pending` with an empty sheet.
 */
export interface LotteryDrawResults {
  drawId: string;
  drawNo: number;
  /** "YYYY-MM-DD", the draw's own date. */
  thaiDrawDate: string;
  status: LotteryResultStatus;
  source: LotteryResultSource | null;
  fetchedAt: string | null;
  /** The date the source said it was showing ("YYYY-MM-DD"); the draw date for a sheet entered by hand. */
  sourceDate: string | null;
  lastError: string | null;
  attempts: number;
  /** The staff member who typed the sheet in; null for a fetched one. */
  enteredBy: LotterySettingsStaffRef | null;
  /** Kyat per Baht the groups' `ks` use: the draw's own rate once set, else the setting's. */
  rate: number;
  /** The nine groups in the fixed order; empty until fetched or entered. */
  groups: LotteryResultGroup[];
  /** True when the sheet is full and valid — what Publish needs. */
  complete: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

/** PUT /lottery/admin/draws/:id/results — all nine groups, counts and digits as the shape says. */
export interface EnterLotteryResultsInput {
  groups: { key: LotteryPrizeGroupKey; baht: number; numbers: string[] }[];
  note?: string;
}

/** GET /lottery/admin/draws/:id/publish-preview — what Publish would pay, computed without writing. */
export interface LotteryPublishPreview {
  /** Kyat per Baht the preview was worked at (the draw's rate, else the setting). */
  rate: number;
  /** Winning tickets. */
  winners: number;
  /** Tickets checked. */
  tickets: number;
  prizesBaht: number;
  prizesKs: number;
  byGroup: { key: LotteryPrizeGroupKey; winners: number; ks: number }[];
}

/** POST /lottery/admin/draws/:id/publish. Absent exchangeRate = the setting's rate. */
export interface PublishLotteryDrawInput {
  exchangeRate?: number;
}

/** One group a ticket won, with the Baht and the kyat it paid. */
export interface LotteryWinnerGroup {
  key: LotteryPrizeGroupKey;
  baht: number;
  ks: number;
}

/**
 * One row of GET /lottery/admin/draws/:id/winners — a winning ticket. Since
 * 2026-10-24 publishing awards the prize without paying it: `claimStatus`
 * says where the ticket's payment stands and `paidAt` is null until the
 * customer's claim is confirmed (the claim's decidedAt; for a draw paid at
 * publish before claims existed, the payout's own time).
 */
export interface LotteryAdminWinner {
  ticketNo: string;
  number: string;
  user: LotteryTicketUserRef;
  groups: LotteryWinnerGroup[];
  baht: number;
  ks: number;
  claimStatus: LotteryWinnerClaimStatus;
  /** The claim the ticket belongs to; null while not requested or once expired. */
  claimId: string | null;
  paidAt: string | null;
  transactionId: string | null;
}

export interface LotteryWinnerListQuery {
  /** Matches the ticket ID, a number prefix, or the customer. */
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface LotteryWinnerPage {
  items: LotteryAdminWinner[];
  total: number;
  page: number;
  pageSize: number;
}

/** One group as "Test the source" reports it: the numbers the source sent, no kyat (nothing is stored). */
export interface LotteryResultsSourceTestGroup {
  key: string;
  name: string;
  baht: number;
  count: number;
  numbers: string[];
}

/**
 * GET /lottery/admin/settings/results-test — one call to the saved source
 * for today's draw (today in Bangkok), answered 200 either way: `ok` says
 * whether the source worked, `error` why not.
 */
export interface LotteryResultsSourceTest {
  ok: boolean;
  /** The URL that was asked, after the {date} replacement; null when no source is set. */
  url: string | null;
  /** "YYYY-MM-DD", the date the source was asked for. */
  askedDate: string;
  sourceDate: string | null;
  /** True when `sourceDate` is `askedDate`; null when the source did not answer. */
  matches: boolean | null;
  groupsSummary: LotteryResultsSourceTestGroup[] | null;
  /** Oddities that did not block (near-first numbers that are not the 1st prize ±1). */
  warnings: string[];
  error: string | null;
}

/** A group a ticket won, as the ticket rows carry it once the draw is published. */
export interface LotteryTicketWonGroup {
  key: LotteryPrizeGroupKey;
  name: string;
  ks: number;
}

// ------------------------------------------------------------------- claims
// Prize payment by request (2026-10-24) — the staff side of
// /lottery/admin/claims. Publishing a draw AWARDS every prize (payout rows
// unclaimed, no money moves); the customer requests payment in the app —
// ONE claim per customer per draw bundling all their winning tickets — and
// a staff member holding LOTTERY.CLAIMS_CONFIRM confirms it (one wallet
// credit, one LOTTERY_PRIZE transaction) or rejects it with a reason the
// customer reads. There is no "pay all" anywhere. Money on this wire is a
// two-place decimal STRING, like the analytics; instants are ISO UTC.

/** A claim's own life: requested → paid | rejected (a rejected claim can be reopened to requested). */
export const LOTTERY_CLAIM_STATUSES = ["requested", "paid", "rejected"] as const;
export type LotteryClaimStatus = (typeof LOTTERY_CLAIM_STATUSES)[number];

/**
 * The claims page's tabs, in the order the board lists them: the server's
 * `status` filter. `not_requested` rows are synthesized from unclaimed
 * payouts (no claim row exists yet); `all` is requested first, then the rest.
 */
export const LOTTERY_CLAIM_LIST_STATUSES = ["requested", "paid", "rejected", "not_requested", "all"] as const;
export type LotteryClaimListStatus = (typeof LOTTERY_CLAIM_LIST_STATUSES)[number];

/** A list row's status: a claim's own, or not_requested for a synthesized row. */
export type LotteryAdminClaimRowStatus = LotteryClaimStatus | "not_requested";

/** Where one winning ticket's payment stands — the Claim column of the winners table. */
export const LOTTERY_WINNER_CLAIM_STATUSES = ["not_requested", "requested", "paid", "rejected", "expired"] as const;
export type LotteryWinnerClaimStatus = (typeof LOTTERY_WINNER_CLAIM_STATUSES)[number];

/** The preset reasons of a rejection, in the order the Reject dialog offers them. */
export const LOTTERY_CLAIM_REJECT_REASONS = [
  "suspicious_account",
  "duplicate_request",
  "ticket_under_review",
  "other",
] as const;
export type LotteryClaimRejectReason = (typeof LOTTERY_CLAIM_REJECT_REASONS)[number];

/** The backend's cap on a rejection note (VARCHAR(300)). */
export const LOTTERY_CLAIM_NOTE_MAX = 300;

/** The staff member who decided a claim (confirmed or rejected it). */
export interface LotteryClaimDecidedByRef {
  id: string;
  /** Login identity. Render `userLabel()` instead — never this raw. */
  username: string;
  displayName: string | null;
}

/**
 * One row of GET /lottery/admin/claims — one customer's winning tickets in
 * one draw. A `not_requested` row has no claim yet: `id` is null and `key`
 * is "<drawId>:<userId>"; every other row's `key` is its claim id.
 */
export interface LotteryAdminClaim {
  id: string | null;
  key: string;
  status: LotteryAdminClaimRowStatus;
  drawId: string;
  drawNo: number;
  /** "YYYY-MM-DD", the draw's own date. */
  thaiDrawDate: string;
  user: LotteryTicketUserRef;
  ticketsCount: number;
  /** Two-place decimal strings, e.g. "6000.00". */
  baht: string;
  ks: string;
  requestedAt: string | null;
  /** When it was confirmed or rejected; null while requested or not requested. */
  decidedAt: string | null;
  decidedBy: LotteryClaimDecidedByRef | null;
  rejectReason: LotteryClaimRejectReason | null;
  rejectNote: string | null;
  /** True for the claims the migration backfilled for a draw paid at publish, before claims existed. */
  paidAtPublish: boolean;
  /** The LOTTERY_PRIZE transaction once paid. */
  transactionId: string | null;
}

/** One group a ticket won, as the claim detail lists it. */
export interface LotteryClaimTicketGroup {
  key: LotteryPrizeGroupKey | (string & {});
  name: string;
  baht: number | string;
  ks: number | string;
}

/** One winning ticket inside a claim's detail. */
export interface LotteryAdminClaimTicket {
  ticketNo: string;
  number: string;
  groups: LotteryClaimTicketGroup[];
  /** Numbers or decimal strings — the row's convention is strings; read them with `moneyNumber()`. */
  baht: number | string;
  ks: number | string;
  boughtAt: string;
}

/** GET /lottery/admin/claims/:id — the row plus the customer, the tickets and the draw. */
export interface LotteryAdminClaimDetail extends LotteryAdminClaim {
  customer: {
    memberSince: string;
    /** Two-place decimal string. */
    walletBalance: string;
    earlierClaims: { paid: number; rejected: number };
    accountAgeDays: number;
    /** accountAgeDays < 30 — the review dialog's "New account" badge. */
    isNewAccount: boolean;
  };
  tickets: LotteryAdminClaimTicket[];
  draw: {
    id: string;
    drawNo: number;
    thaiDrawDate: string;
    /** Ks per Baht the claim's prizes were worked out at; null only for a draw published without a rate (never the case since phase 3). */
    exchangeRate: number | null;
    publishedAt: string | null;
    claimDeadlineAt: string | null;
  };
}

/** GET /lottery/admin/claims/summary?drawId — the four tiles (and the expired line). "Today" is the Myanmar calendar day. */
export interface LotteryClaimsSummary {
  waiting: { claims: number; ks: string };
  paidToday: { claims: number; ks: string };
  notRequested: { customers: number; tickets: number; ks: string };
  rejected: { claims: number; ks: string };
  expired: { tickets: number; ks: string };
}

export interface LotteryClaimListQuery {
  /** The backend's default is requested. */
  status?: LotteryClaimListStatus;
  drawId?: string;
  /** Matches a ticket number (exact or prefix), a lottery number prefix, or the customer (name, phone). */
  q?: string;
  page?: number;
  /** At most 100; the backend's default is 25. */
  pageSize?: number;
}

export interface LotteryClaimPage {
  items: LotteryAdminClaim[];
  total: number;
  page: number;
  pageSize: number;
}

/** POST /lottery/admin/claims/:id/reject — the note (≤300 chars) is required when the reason is `other`. */
export interface RejectLotteryClaimInput {
  reason: LotteryClaimRejectReason;
  note?: string;
}

/** Tickets and kyat in one claim state of a draw (the draw page's claims strip). */
export interface LotteryDrawClaimsBucket {
  tickets: number;
  ks: number;
}

/** `claims` on the admin draw view: the payouts grouped by status, kyat as numbers like the rest of the view. */
export interface LotteryDrawClaimsSummary {
  winningTickets: number;
  prizeTotalKs: number;
  waiting: LotteryDrawClaimsBucket;
  paid: LotteryDrawClaimsBucket;
  notRequested: LotteryDrawClaimsBucket;
  rejected: LotteryDrawClaimsBucket;
  expired: LotteryDrawClaimsBucket;
}
