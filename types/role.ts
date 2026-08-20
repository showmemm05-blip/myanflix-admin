import type { Permission } from "@/lib/permissions";

/**
 * A database-backed role. `key` is derived once at creation and immutable;
 * `name`/`description` are freely editable except on the protected
 * SUPER_ADMIN row, which the backend refuses to change at all (409).
 */
export interface AppRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  /** One of the four built-ins — cannot be deleted, only re-permissioned. */
  isSystem: boolean;
  /** SUPER_ADMIN only — name and permissions are frozen. */
  isProtected: boolean;
  /** Always in catalogue order, so two sets are directly comparable. */
  permissions: Permission[];
  /** Accounts on this role, including the fallback for un-migrated users. */
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

/** One checkbox in the matrix. */
export interface PermissionCatalogueAction {
  key: string;
  label: string;
  permission: Permission;
}

/** One row group in the matrix. */
export interface PermissionCatalogueModule {
  key: string;
  label: string;
  actions: PermissionCatalogueAction[];
}

export interface PermissionCatalogue {
  modules: PermissionCatalogueModule[];
  permissions: Permission[];
}

export interface CreateRoleValues {
  name: string;
  description?: string;
  permissions?: Permission[];
}

export interface UpdateRoleValues {
  name?: string;
  description?: string;
}
