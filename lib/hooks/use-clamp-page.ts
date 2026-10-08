"use client";

/**
 * Keeps a server-paged list from sitting on a page past its end.
 *
 * Rows removed somewhere else (another tab, another staff member, or users
 * dropping out of the active-users window between polls) can leave a later
 * page empty. Without this the page would show its full-page "nothing here
 * yet" screen with no footer, even though earlier pages still have rows.
 *
 * When the rows in hand are empty, the list is not loading, and the server's
 * own `total` says the current page no longer exists, it moves to the last
 * page that does (page 1 when the total is 0). It runs during render — React's
 * "adjust state when data changes" pattern — so the empty page never paints.
 * It only ever moves the page DOWN, to a page the same `total` says exists,
 * so it settles after one step and cannot loop.
 *
 * `onPageChange` must be the page's own page setter (or a handler that also
 * clears that page's local row overrides, as the tracking pages do).
 */
export function useClampPage({
  page,
  pageSize,
  rowCount,
  total,
  isLoading,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  /** Rows the server returned for the page on screen; undefined while there is no data yet. */
  rowCount: number | undefined;
  /** The server's total for the current query; undefined while there is no data yet. */
  total: number | undefined;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}) {
  if (isLoading || page <= 1 || rowCount === undefined || total === undefined) return;
  if (rowCount > 0) return;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (page > lastPage) onPageChange(lastPage);
}
