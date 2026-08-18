/**
 * User-facing phone numbers are stored normalized to +95 (see backend's
 * normalizePhone) but admins expect the local "09xxxxxxxxx" format they'd
 * actually dial — strip the country code back off for display.
 */
export function formatLocalPhone(phone: string | null): string | null {
  if (!phone) return phone;
  return phone.startsWith("+95") ? `0${phone.slice(3)}` : phone;
}

/**
 * Digits-only identity for a phone number — the ONLY form the relationship
 * network compares on, because the same number reaches us formatted a dozen
 * ways ("09 777 888 999", "+95777888999", "09-777-888-999"). Mirrors the
 * backend's normalization for `GET /users/relationships` so the admin can
 * pre-validate without a round trip. Keep the raw string for display.
 */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/** Fewer than 6 digits isn't a phone number — reject it before searching (matches the backend's rule). */
export const MIN_PHONE_DIGITS = 6;

export function isSearchablePhone(phone: string): boolean {
  return normalizePhoneDigits(phone).length >= MIN_PHONE_DIGITS;
}
