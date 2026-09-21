/**
 * The admin rating field → API value. Empty means "not rated": the API's 0
 * sentinel renders as a dash on every client, so clearing the field is how an
 * admin removes a rating. One decimal is what the API accepts, so a typed
 * 7.55 is rounded here rather than bounced by validation — and rounded BEFORE
 * the range check, so "10.04" means 10 rather than a refused save. Anything
 * still outside 0–10, or not a number at all, is null so the dialog can
 * refuse the save.
 */
export function parseRatingInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  if (rounded < 0 || rounded > 10) return null;
  return rounded;
}

/** The stored rating as the field shows it: 0 (unrated) is an empty field, not a literal 0 to delete. */
export function ratingToInput(rating: number | undefined): string {
  return rating && rating > 0 ? String(rating) : "";
}
