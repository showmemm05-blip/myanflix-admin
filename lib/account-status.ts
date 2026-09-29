import type { TranslationShape } from "@/lib/i18n/translations";
import { ApiError } from "@/services/api/apiClient";
import type { UserStatus } from "@/types/user";

/**
 * H-16: a customer can close their own account, and CLOSED is terminal. The
 * backend refuses every staff change to such an account (status, role,
 * manual deposit, balance adjustment) with a 409 carrying exactly this text.
 * Matched on the text, because other 409s exist on those routes, so the admin
 * can show its own translated wording instead of the raw English.
 */
const CLOSED_ACCOUNT_MESSAGE = "This account was closed by its owner and cannot be changed.";

export function isClosedAccountError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.message === CLOSED_ACCOUNT_MESSAGE;
}

/** The translated label for a user status pill. An unknown value (a newer backend) renders raw. */
export function userStatusLabel(t: TranslationShape, status: string): string {
  const labels: Record<UserStatus, string> = {
    ACTIVE: t.common.active,
    SUSPENDED: t.users.profile.statusSuspended,
    BANNED: t.users.profile.statusBanned,
    CLOSED: t.users.profile.statusClosed,
  };
  return (labels as Record<string, string | undefined>)[status] ?? status;
}
