/**
 * GET / DELETE /bank-events/binding — which phone-monitor PC the shared
 * BANK_EVENTS_TOKEN is bound to (security audit 2026-10-09, SEC-004).
 * Mirrors the backend contract (backend/src/bank-events); staff-only. The
 * exact twin of `SmsGatewayBinding`, keyed on the monitor's serial.
 */
export interface BankEventsBinding {
  /** The pinned monitor's serial (X-Device-Serial); null while nothing is pinned. */
  deviceSerial: string | null;
  /** ISO timestamp. */
  pinnedAt: string | null;
  /** The last monitor that presented the right token under another serial. */
  lastRejectedDeviceSerial: string | null;
  /** ISO timestamp of that last refusal. */
  lastRejectedAt: string | null;
  /** Refusals since the pin was set. */
  rejectedCount: number;
  /** ISO timestamp of the last staff reset. */
  resetAt: string | null;
}
