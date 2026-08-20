import { apiClient } from "./apiClient";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  ActiveUsersQuery,
  ActiveUsersResponse,
  ModerateCommentResult,
  RecentSearch,
  TopSearchTerm,
  TrackedComment,
  TrackedFeedback,
  TrackingCommentsQuery,
  TrackingFeedbackQuery,
  TrackingSearchesQuery,
  TrackingSessionsQuery,
  UpdateFeedbackStatusPayload,
  UserSessionEntry,
  UserSessionSummary,
  WatchTimeQuery,
  WatchTimeReport,
  CommentStatus,
} from "@/types/tracking";

/**
 * The admin's Tracking API — one method per backend route, no more.
 *
 * Every route under `/tracking` is gated on `TRACKING.VIEW`; the two write
 * routes additionally need `TRACKING.COMMENTS_MODERATE` / `TRACKING.
 * FEEDBACK_MANAGE`. `apiClient` unwraps the `{ success, data }` envelope, so
 * these return the payload directly and throw `ApiError` otherwise — a 403
 * from a missing permission arrives as a thrown `ApiError`, which is what
 * `RequirePermission` on the page is there to make unreachable.
 *
 * Nothing here reshapes a response. The backend already decided what a row
 * looks like and, crucially, already masked its PII — a mapper in this file
 * would be a second place for those two facts to drift.
 */
export const trackingService = {
  // ------------------------------------------------------------- comments

  /**
   * Every comment posted anywhere, newest first — including HIDDEN ones, so
   * a moderator can review and undo their own decisions. Pass `status` to
   * narrow.
   */
  getComments(
    query: TrackingCommentsQuery = {},
  ): Promise<PaginatedResponse<TrackedComment>> {
    return apiClient.get<PaginatedResponse<TrackedComment>>(
      "/tracking/comments",
      { params: query },
    );
  },

  /**
   * Hides or restores one comment — the reversible half of moderation.
   * Needs `TRACKING.COMMENTS_MODERATE`.
   */
  moderateComment(
    id: string,
    status: CommentStatus,
  ): Promise<ModerateCommentResult> {
    return apiClient.patch<ModerateCommentResult>(`/tracking/comments/${id}`, {
      status,
    });
  },

  /**
   * Deletes a comment outright — the irreversible half, and a different
   * route: it lives on the user-facing comments controller, where an author
   * deleting their own comment is the primary case. Staff reach it with
   * `TRACKING.COMMENTS_MODERATE`. Responds 204, so there is nothing to
   * return; prefer `moderateComment(id, "HIDDEN")` when the row should stay
   * on record.
   */
  deleteComment(id: string): Promise<void> {
    return apiClient.delete<void>(`/comments/${id}`);
  },

  // ------------------------------------------------------------- feedback

  getFeedback(
    query: TrackingFeedbackQuery = {},
  ): Promise<PaginatedResponse<TrackedFeedback>> {
    return apiClient.get<PaginatedResponse<TrackedFeedback>>(
      "/tracking/feedback",
      { params: query },
    );
  },

  /**
   * Moves one feedback row through triage and returns the updated row.
   * Needs `TRACKING.FEEDBACK_MANAGE`. `handledBy`/`handledAt` are stamped by
   * the server from the authenticated caller — never send them.
   */
  updateFeedbackStatus(
    id: string,
    payload: UpdateFeedbackStatusPayload,
  ): Promise<TrackedFeedback> {
    return apiClient.patch<TrackedFeedback>(
      `/tracking/feedback/${id}`,
      payload,
    );
  },

  // --------------------------------------------------------- active users

  /**
   * Who is on the platform right now: live sockets unioned with sessions
   * seen in the last 5 minutes, deduped per user.
   *
   * `summary` describes the whole active set even when `platform` filters
   * the rows — render the cards from `summary`, never from `items`.
   */
  getActiveUsers(query: ActiveUsersQuery = {}): Promise<ActiveUsersResponse> {
    return apiClient.get<ActiveUsersResponse>("/tracking/active-users", {
      params: query,
    });
  },

  // ------------------------------------------------------------ watch time

  /**
   * WHEN people watch — hour-of-day, day-of-week and the 7x24 heatmap.
   *
   * The three params are picked out explicitly rather than spread: this
   * route is un-paginated and the backend rejects unknown query props, so a
   * `page` riding along on a filter object reused from another page would
   * turn the whole report into a 400.
   */
  getWatchTime(query: WatchTimeQuery = {}): Promise<WatchTimeReport> {
    const { from, to, platform } = query;
    return apiClient.get<WatchTimeReport>("/tracking/watch-time", {
      params: { from, to, platform },
    });
  },

  // -------------------------------------------------------------- searches

  /** Top search TERMS, grouped by normalised form, most-searched first. */
  getTopSearches(
    query: TrackingSearchesQuery = {},
  ): Promise<PaginatedResponse<TopSearchTerm>> {
    return apiClient.get<PaginatedResponse<TopSearchTerm>>(
      "/tracking/searches",
      { params: query },
    );
  },

  /** The raw search log, newest first — the companion to the grouped view. */
  getRecentSearches(
    query: TrackingSearchesQuery = {},
  ): Promise<PaginatedResponse<RecentSearch>> {
    return apiClient.get<PaginatedResponse<RecentSearch>>(
      "/tracking/searches/recent",
      { params: query },
    );
  },

  // -------------------------------------------------------------- sessions

  /** The Phone/IP view: one row per user, with the shared-IP / shared-phone flags. */
  getSessions(
    query: TrackingSessionsQuery = {},
  ): Promise<PaginatedResponse<UserSessionSummary>> {
    return apiClient.get<PaginatedResponse<UserSessionSummary>>(
      "/tracking/sessions",
      { params: query },
    );
  },

  /** One user's own sessions, newest first — the row's details drawer. */
  getUserSessions(
    userId: string,
    pagination: PaginationParams = {},
  ): Promise<PaginatedResponse<UserSessionEntry>> {
    return apiClient.get<PaginatedResponse<UserSessionEntry>>(
      `/tracking/sessions/${userId}`,
      { params: pagination },
    );
  },
};
