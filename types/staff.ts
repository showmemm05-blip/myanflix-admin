export type StaffRole = "SUPER_ADMIN" | "ADMIN" | "CONTENT_UPLOADER";
export type StaffStatus = "ACTIVE" | "SUSPENDED";

export interface StaffMember {
  id: string;
  /** Login identity — shown raw in the Username column and in the edit form. */
  username: string;
  /** Null for every staff account today; prose surfaces still resolve via `userLabel()`. */
  displayName: string | null;
  /** Coarse account kind — kept in sync by the backend when a built-in AppRole is assigned. */
  role: StaffRole;
  /** Granular RBAC assignment; null only for accounts still on the enum fallback. */
  appRoleId: string | null;
  appRoleKey: string | null;
  appRoleName: string | null;
  status: StaffStatus;
  lastLoginAt: string | null;
  createdAt: string;
}
