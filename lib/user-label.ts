/**
 * The single source of truth for how a person is NAMED in the admin.
 *
 * End users register by phone and get a machine-generated username
 * (`user_95950495369`), then choose a real name in the profile modal which the
 * backend stores as `User.displayName`. Rendering the raw username labels every
 * one of those accounts with gibberish, so every admin surface that prints a
 * person's name resolves it through here instead.
 *
 * The rule, in one place: the display name they set, falling back to the
 * username when they haven't set one (or set only whitespace). `username` is
 * NEVER overwritten or dropped — it is the login identity, and detail surfaces
 * keep showing it as a muted `@username` line so a display name can't hide who
 * an account actually is.
 *
 * No component may inline `displayName ?? username` itself.
 */

/** Any user reference on the wire: every one carries `displayName` next to `username`. */
export interface UserLabelRef {
  displayName?: string | null;
  username: string;
}

export function userLabel(u: UserLabelRef): string {
  return u.displayName?.trim() || u.username;
}

/**
 * Same rule for the many refs that are nullable on the wire (a deleted staff
 * account, an unjoined relation), so the null branch stays a caller's choice of
 * copy — "Unknown user", an em-dash, "System" — while the naming rule itself
 * stays here.
 */
export function userLabelOr(u: UserLabelRef | null | undefined, fallback: string): string {
  return u ? userLabel(u) : fallback;
}
