/**
 * Admin-side mirror of the backend permission catalogue
 * (`backend/src/roles/permission-catalogue.ts`).
 *
 * It exists purely for *type safety* — `can("MOVIES.VEIW")` has to be a
 * compile error, and `nav-config` has to be unable to name a permission the
 * backend has never heard of. The runtime source of truth for the roles
 * matrix is still the server (`GET /roles/catalogue`), so labels and module
 * ordering are never duplicated here.
 *
 * Adding a module or action is a one-line change in this array, exactly as it
 * is on the backend — the `Permission` union follows automatically.
 */
export const PERMISSION_CATALOGUE = [
  { key: "DASHBOARD", actions: ["VIEW"] },
  {
    key: "MOVIES",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "PUBLISH", "UNPUBLISH"],
  },
  {
    key: "SERIES",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "PUBLISH", "UNPUBLISH"],
  },
  { key: "MEDIA", actions: ["VIEW", "UPLOAD", "DELETE"] },
  { key: "CATEGORIES", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
  { key: "USERS", actions: ["VIEW", "EDIT", "SUSPEND", "WALLET_ADJUST"] },
  { key: "STAFF", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
  { key: "ROLES", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
  { key: "DEPOSITS", actions: ["VIEW", "APPROVE", "REJECT", "CREATE", "EDIT"] },
  { key: "WITHDRAWALS", actions: ["VIEW", "APPROVE", "REJECT", "EDIT"] },
  { key: "PAYMENT_METHODS", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
  {
    key: "PAYMENT_ACCOUNTS",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "LEDGER_MANAGE"],
  },
  { key: "FINANCE", actions: ["VIEW", "EXPORT", "SETTINGS_MANAGE"] },
  { key: "SUBSCRIPTIONS", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
  { key: "PEAK_USERS", actions: ["VIEW", "MANAGE"] },
  {
    // VIEW gates all six Tracking screens (comments, feedback, active users,
    // watch time, searches, phone/IP). The other three are separately
    // grantable because they do more than look: COMMENTS_MODERATE hides and
    // deletes other people's words, FEEDBACK_MANAGE writes triage state
    // back, and PII_VIEW is what unmasks phone numbers and IP addresses.
    //
    // PII_VIEW is deliberately NOT something the admin acts on by hiding a
    // column: the backend masks the values before they are ever serialised,
    // so a caller without it receives `09*****369` and there is nothing for
    // the client to re-hide. Gate the *unmask affordances* on it if you
    // like; never treat a rendered value as trustworthy PII on its own.
    key: "TRACKING",
    actions: ["VIEW", "COMMENTS_MODERATE", "FEEDBACK_MANAGE", "PII_VIEW"],
  },
  { key: "SETTINGS", actions: ["VIEW", "MANAGE"] },
] as const;

type CatalogueEntry = (typeof PERMISSION_CATALOGUE)[number];

/** Every module key, as a literal union. */
export type PermissionModule = CatalogueEntry["key"];

type PermissionsOf<T extends CatalogueEntry> = T extends {
  key: infer K extends string;
  actions: readonly (infer A extends string)[];
}
  ? `${K}.${A}`
  : never;

/** `MODULE.ACTION` — the only string shape `can()` accepts. */
export type Permission = PermissionsOf<CatalogueEntry>;

/** Flat list in catalogue order (module order, then action order). */
export const ALL_PERMISSIONS: Permission[] = PERMISSION_CATALOGUE.flatMap(
  (module) =>
    (module.actions as readonly string[]).map(
      (action) => `${module.key}.${action}` as Permission,
    ),
);

const PERMISSION_SET: ReadonlySet<string> = new Set<string>(ALL_PERMISSIONS);

/**
 * Narrows an arbitrary string coming off the wire to a known permission.
 * A permission the backend knows but this build doesn't is dropped rather
 * than trusted — the backend stays the real gate either way.
 */
export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/** Filters an untyped wire list down to the permissions this build knows. */
export function toPermissions(values: readonly string[]): Permission[] {
  return values.filter(isPermission);
}
