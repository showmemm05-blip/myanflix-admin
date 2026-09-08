import { normalizePhoneDigits } from "@/lib/phone";

/**
 * Client-side "find this person's rows" matching for the money tables.
 *
 * Those tables filter rows already in the browser (no server-side search
 * endpoint), and the column they filter renders `userLabel()` — a self-chosen
 * display name. Matching that alone would mean an admin holding the customer's
 * phone number or their login identity finds nothing, so every identity the
 * row carries is matched here instead: the label, the raw `username`, and the
 * phone. `services/api/userService.getUsers({ search })` applies the same
 * three-field rule server-side for the Users page.
 */

/** How many digits a term must have before it is tried as a phone number — fewer would match nearly every row. */
const MIN_PHONE_MATCH_DIGITS = 3;

/**
 * Every digit form the same Myanmar number reaches us in, so a term typed in
 * any of them hits: stored "+95950495369", national "950495369" and the local
 * "0950495369" an admin would actually dial.
 */
function phoneVariants(phone: string): string[] {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return [];
  const variants = new Set([digits]);
  if (digits.startsWith("95")) {
    const national = digits.slice(2);
    variants.add(national);
    variants.add(`0${national}`);
  }
  if (digits.startsWith("0")) variants.add(`95${digits.slice(1)}`);
  return [...variants];
}

export interface UserSearchFields {
  /** The rendered label (`userLabel()` output). */
  name?: string | null;
  /** The raw login identity. */
  username?: string | null;
  phone?: string | null;
  /** Optional e-mail (Google sign-ins have one and no phone). */
  email?: string | null;
}

export function matchesUserSearch(term: string, fields: UserSearchFields): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  if (fields.name?.toLowerCase().includes(needle)) return true;
  if (fields.username?.toLowerCase().includes(needle)) return true;
  if (fields.email?.toLowerCase().includes(needle)) return true;

  const digits = normalizePhoneDigits(needle);
  if (fields.phone && digits.length >= MIN_PHONE_MATCH_DIGITS) {
    return phoneVariants(fields.phone).some((variant) => variant.includes(digits));
  }
  return false;
}
