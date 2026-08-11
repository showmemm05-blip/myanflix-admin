/**
 * User-facing phone numbers are stored normalized to +95 (see backend's
 * normalizePhone) but admins expect the local "09xxxxxxxxx" format they'd
 * actually dial — strip the country code back off for display.
 */
export function formatLocalPhone(phone: string | null): string | null {
  if (!phone) return phone;
  return phone.startsWith("+95") ? `0${phone.slice(3)}` : phone;
}
