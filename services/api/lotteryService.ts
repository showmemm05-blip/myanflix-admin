import { apiClient } from "./apiClient";
import type {
  CreateLotteryDrawInput,
  EnterLotteryResultsInput,
  LotteryAdminClaimDetail,
  LotteryAdminDraw,
  LotteryClaimListQuery,
  LotteryClaimPage,
  LotteryClaimsSummary,
  LotteryDrawListQuery,
  LotteryDrawPage,
  LotteryDrawResults,
  LotteryDream,
  LotteryDreamBook,
  LotteryDreamImportResult,
  LotteryDreamListQuery,
  LotteryDreamPage,
  LotteryPublishPreview,
  LotteryResultsSourceTest,
  LotterySettings,
  LotteryTicketListQuery,
  LotteryTicketPage,
  LotteryWinnerListQuery,
  LotteryWinnerPage,
  PublishLotteryDrawInput,
  RejectLotteryClaimInput,
  UpdateLotteryDrawInput,
  UpdateLotteryDreamInput,
  UpdateLotterySettingsInput,
} from "@/types/lottery";
import type {
  LotteryAnalyticsAcrossPage,
  LotteryAnalyticsAcrossQuery,
  LotteryAnalyticsActivity,
  LotteryAnalyticsActivityQuery,
  LotteryAnalyticsBeforeClose,
  LotteryAnalyticsDrawsPage,
  LotteryAnalyticsDrawsQuery,
  LotteryAnalyticsFrequency,
  LotteryAnalyticsHeatmap,
  LotteryAnalyticsNumbersPage,
  LotteryAnalyticsNumbersQuery,
  LotteryAnalyticsOverview,
  LotteryAnalyticsPeriodQuery,
} from "@/types/lottery-analytics";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Publishing marks every ticket and works out every prize in chunks inside
 * the one request, so a draw with thousands of tickets takes a while: the
 * call is given its own generous timeout instead of the client's untimed
 * default, so a stalled connection still surfaces.
 */
const PUBLISH_TIMEOUT_MS = 5 * 60_000;

/**
 * The Lottery admin pages. LOTTERY.VIEW reads everything; the dreams, the
 * draws and the settings each have their own MANAGE permission
 * (DREAMS_MANAGE, DRAWS_MANAGE, SETTINGS_MANAGE), the results — fetching,
 * entering by hand and publishing — RESULTS_PUBLISH, and paying or
 * rejecting a prize claim CLAIMS_CONFIRM; the backend audits every change.
 */
export const lotteryService = {
  /** One server page of a book, filtered and searched on the server. */
  listDreams(query: LotteryDreamListQuery) {
    return apiClient.get<LotteryDreamPage>("/lottery/admin/dreams", {
      params: query,
    });
  },

  /**
   * Absent = keep, null = clear. The number and the book never change.
   * `timeoutMs` bounds the wait for a caller that runs many of these in a
   * row (the pictures import), so a dead connection fails the one file
   * instead of hanging the run.
   */
  updateDream(id: string, input: UpdateLotteryDreamInput, options?: { timeoutMs?: number }) {
    return apiClient.patch<LotteryDream>(`/lottery/admin/dreams/${id}`, input, options);
  },

  /**
   * Checks (dryRun) or applies a names spreadsheet (.xlsx or UTF-8 .csv with
   * the columns book, number, name_en, name_my). A dry run changes nothing
   * and reports what the real run would do.
   */
  importDreams(file: File, dryRun: boolean) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<LotteryDreamImportResult>(
      "/lottery/admin/dreams/import",
      formData,
      {
        params: { dryRun },
      },
    );
  },

  /** Every row of one book as an .xlsx — it doubles as the import template. */
  exportDreams(book: LotteryDreamBook) {
    return apiClient.getBlob("/lottery/admin/dreams/export", {
      params: { book },
      headers: { Accept: `${XLSX_MIME},*/*` },
    });
  },

  // ---------------------------------------------------------------- settings

  /** The single settings row: price, per-number limit, exchange rate, closing offset, claim deadline, ticket frame. */
  getSettings() {
    return apiClient.get<LotterySettings>("/lottery/admin/settings");
  },

  /** Only the fields sent change. Price, limit and frame reach a draw only when it is created. */
  updateSettings(input: UpdateLotterySettingsInput) {
    return apiClient.patch<LotterySettings>("/lottery/admin/settings", input);
  },

  // ------------------------------------------------------------------- draws

  /** One server page of draws, newest draw number first, optionally one status. */
  listDraws(query: LotteryDrawListQuery) {
    return apiClient.get<LotteryDrawPage>("/lottery/admin/draws", {
      params: query,
    });
  },

  /** Copies the price, the per-number limit and the ticket frame from the settings into the new draw. */
  createDraw(input: CreateLotteryDrawInput) {
    return apiClient.post<LotteryAdminDraw>("/lottery/admin/draws", input);
  },

  /** The draw with its counters and its off-sale numbers. */
  getDraw(id: string) {
    return apiClient.get<LotteryAdminDraw>(`/lottery/admin/draws/${id}`);
  },

  updateDraw(id: string, input: UpdateLotteryDrawInput) {
    return apiClient.patch<LotteryAdminDraw>(
      `/lottery/admin/draws/${id}`,
      input,
    );
  },

  /** scheduled / paused → open, while the closing time is still ahead. 409 otherwise. */
  openDraw(id: string) {
    return apiClient.post<LotteryAdminDraw>(`/lottery/admin/draws/${id}/open`);
  },

  /** open → paused. 409 otherwise. */
  pauseDraw(id: string) {
    return apiClient.post<LotteryAdminDraw>(`/lottery/admin/draws/${id}/pause`);
  },

  /** open / paused → closed. 409 otherwise. */
  closeDraw(id: string) {
    return apiClient.post<LotteryAdminDraw>(`/lottery/admin/draws/${id}/close`);
  },

  /**
   * closed → open again (closedAt cleared, openedAt kept), only while the
   * closing time is still ahead and no results sheet is in (fetched or
   * published; a sheet entered by hand counts). 409 LOTTERY_DRAW_STATE
   * otherwise. The cron closes it again at the closing time as usual.
   */
  reopenDraw(id: string) {
    return apiClient.post<LotteryAdminDraw>(
      `/lottery/admin/draws/${id}/reopen`,
    );
  },

  /** Replaces the whole off-sale list (six-digit numbers, distinct, at most 1000). */
  setOffSaleNumbers(id: string, numbers: string[]) {
    return apiClient.put<LotteryAdminDraw>(
      `/lottery/admin/draws/${id}/off-sale`,
      { numbers },
    );
  },

  /** One server page of a draw's tickets, newest first, searched on the server. */
  listDrawTickets(id: string, query: LotteryTicketListQuery) {
    return apiClient.get<LotteryTicketPage>(
      `/lottery/admin/draws/${id}/tickets`,
      { params: query },
    );
  },

  // ----------------------------------------------------------------- results

  /** The draw's results record: status, source, the nine groups once fetched or entered. */
  getDrawResults(id: string) {
    return apiClient.get<LotteryDrawResults>(
      `/lottery/admin/draws/${id}/results`,
    );
  },

  /** Runs the results source for this draw now, ahead of the cron. The record comes back, with lastError when it failed. */
  fetchDrawResults(id: string) {
    return apiClient.post<LotteryDrawResults>(
      `/lottery/admin/draws/${id}/results/fetch`,
    );
  },

  /** Replaces the sheet with numbers typed by hand (all nine groups). Allowed until published. */
  enterDrawResults(id: string, input: EnterLotteryResultsInput) {
    return apiClient.put<LotteryDrawResults>(
      `/lottery/admin/draws/${id}/results`,
      input,
    );
  },

  /** What Publish would award (the prizes owed), counted without writing anything. */
  getPublishPreview(id: string) {
    return apiClient.get<LotteryPublishPreview>(
      `/lottery/admin/draws/${id}/publish-preview`,
    );
  },

  /**
   * closed + fetched results → published: marks every ticket won or not won
   * and awards every prize — nobody is paid; the winners request their
   * payment in the app and each claim is confirmed on Prize claims. 409
   * LOTTERY_DRAW_STATE on a wrong state; a second call resumes only when
   * payouts were left incomplete.
   */
  publishDraw(id: string, input: PublishLotteryDrawInput) {
    return apiClient.post<LotteryAdminDraw>(
      `/lottery/admin/draws/${id}/publish`,
      input,
      {
        timeoutMs: PUBLISH_TIMEOUT_MS,
      },
    );
  },

  /** One server page of a published draw's winning tickets (each with its claim status), searched on the server. */
  listDrawWinners(id: string, query: LotteryWinnerListQuery) {
    return apiClient.get<LotteryWinnerPage>(
      `/lottery/admin/draws/${id}/winners`,
      { params: query },
    );
  },

  /** Calls the results source with today's date and reports what it answered — the settings page's "Test the source". */
  testResultsSource() {
    return apiClient.get<LotteryResultsSourceTest>(
      "/lottery/admin/settings/results-test",
    );
  },

  // ------------------------------------------------------------------ claims
  // /lottery/admin/claims (2026-10-24). One claim = one customer's winning
  // tickets in one draw. LOTTERY.VIEW reads; confirm, reject and reopen need
  // LOTTERY.CLAIMS_CONFIRM and each writes one audit row.

  /** One server page of claims: the tab (`status`, default requested), a draw, a search. Not-requested rows are synthesized from the unclaimed payouts. */
  listClaims(query: LotteryClaimListQuery) {
    return apiClient.get<LotteryClaimPage>("/lottery/admin/claims", {
      params: query,
    });
  },

  /** The four tiles — waiting, paid today (Myanmar day), not yet requested, rejected — for every draw or one. */
  getClaimsSummary(drawId?: string) {
    return apiClient.get<LotteryClaimsSummary>("/lottery/admin/claims/summary", {
      params: { drawId },
    });
  },

  /** The claim with its customer, its tickets and its draw. 404 LOTTERY_CLAIM_NOT_FOUND. */
  getClaim(id: string) {
    return apiClient.get<LotteryAdminClaimDetail>(`/lottery/admin/claims/${id}`);
  },

  /**
   * requested → paid: ONE wallet credit for the whole claim and ONE
   * LOTTERY_PRIZE transaction; the payouts turn PAID and the draw's
   * prizesPaidKs grows. 409 LOTTERY_CLAIM_STATE when the claim is not
   * requested any more, 409 LOTTERY_CLAIM_TOTAL_MISMATCH when the payouts
   * no longer add up to the claim (never paid). Returns the detail.
   */
  confirmClaim(id: string) {
    return apiClient.post<LotteryAdminClaimDetail>(`/lottery/admin/claims/${id}/confirm`);
  },

  /** requested → rejected with a preset reason (the note is required for `other`); the customer reads both. Returns the detail. */
  rejectClaim(id: string, input: RejectLotteryClaimInput) {
    return apiClient.post<LotteryAdminClaimDetail>(`/lottery/admin/claims/${id}/reject`, input);
  },

  /** rejected → requested again ("Review again"): the reason and the note are cleared. Returns the detail. */
  reopenClaim(id: string) {
    return apiClient.post<LotteryAdminClaimDetail>(`/lottery/admin/claims/${id}/reopen`);
  },

  // --------------------------------------------------------------- analytics
  // GET /lottery/admin/analytics/* (2026-10-23) — aggregates for the
  // Analytics dashboard and its Reports page, all LOTTERY.VIEW. Periods are
  // MMT calendar dates (from..to); the dashboard always sends both, the
  // reports page sends neither for "All time". `drawId` restricts purchases
  // and tickets to one draw. Query props are passed through as they are:
  // `apiClient` drops the undefined ones.

  /** The six overview cards: this period, the equal period before it, and whether activity is tracked. */
  getAnalyticsOverview(query: LotteryAnalyticsPeriodQuery) {
    return apiClient.get<LotteryAnalyticsOverview>("/lottery/admin/analytics/overview", {
      params: query,
    });
  },

  /** Tickets / purchases / purchasing users / active users per bucket (hourly, daily, weekly or weekday). */
  getAnalyticsActivity(query: LotteryAnalyticsActivityQuery) {
    return apiClient.get<LotteryAnalyticsActivity>("/lottery/admin/analytics/activity", {
      params: query,
    });
  },

  /** One page of the numbers played in the selection, ranked by tickets whatever the sort. */
  getAnalyticsNumbers(query: LotteryAnalyticsNumbersQuery) {
    return apiClient.get<LotteryAnalyticsNumbersPage>("/lottery/admin/analytics/numbers", {
      params: query,
    });
  },

  /** The same over every draw in the period — never limited by the draw select. */
  getAnalyticsNumbersAcross(query: LotteryAnalyticsAcrossQuery) {
    return apiClient.get<LotteryAnalyticsAcrossPage>("/lottery/admin/analytics/numbers/across", {
      params: query,
    });
  },

  /** Buyers by how many purchases they made, and first-time against returning. */
  getAnalyticsFrequency(query: LotteryAnalyticsPeriodQuery) {
    return apiClient.get<LotteryAnalyticsFrequency>("/lottery/admin/analytics/frequency", {
      params: query,
    });
  },

  /** 7 weekdays × 24 hours (MMT), both measures in every cell. */
  getAnalyticsHeatmap(query: LotteryAnalyticsPeriodQuery) {
    return apiClient.get<LotteryAnalyticsHeatmap>("/lottery/admin/analytics/heatmap", {
      params: query,
    });
  },

  /**
   * Tickets by stretch before one draw's closing time. No drawId = the most
   * recent closed or published draw (404 LOTTERY_DRAW_NOT_FOUND when there
   * is none yet).
   */
  getAnalyticsBeforeClose(query: { drawId?: string }) {
    return apiClient.get<LotteryAnalyticsBeforeClose>("/lottery/admin/analytics/before-close", {
      params: query,
    });
  },

  /** One row per draw, newest first, whole sales windows. */
  getAnalyticsDraws(query: LotteryAnalyticsDrawsQuery) {
    return apiClient.get<LotteryAnalyticsDrawsPage>("/lottery/admin/analytics/draws", {
      params: query,
    });
  },
};
