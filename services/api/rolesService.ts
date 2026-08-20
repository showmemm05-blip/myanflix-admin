import { apiClient } from "./apiClient";
import type { Permission } from "@/lib/permissions";
import type {
  AppRole,
  CreateRoleValues,
  PermissionCatalogue,
  UpdateRoleValues,
} from "@/types/role";

/**
 * The `/roles` management API. Every route is gated behind `ROLES.*` on the
 * backend, so a caller without them gets a 403 `ApiError` here regardless of
 * what the UI chose to render.
 */
export const rolesService = {
  async getRoles(): Promise<AppRole[]> {
    const res = await apiClient.get<{ items: AppRole[] }>("/roles");
    return res.items;
  },

  /**
   * The module/action tree the matrix renders. Served by the backend rather
   * than derived locally so labels and ordering can never drift from the
   * permissions the guard actually enforces.
   */
  getCatalogue(): Promise<PermissionCatalogue> {
    return apiClient.get<PermissionCatalogue>("/roles/catalogue");
  },

  getRoleById(id: string): Promise<AppRole> {
    return apiClient.get<AppRole>(`/roles/${id}`);
  },

  /** `key` is derived server-side from `name` (uppercase snake, deduped). */
  createRole(values: CreateRoleValues): Promise<AppRole> {
    return apiClient.post<AppRole>("/roles", values);
  },

  /** Rename/describe only — 409 on the protected SUPER_ADMIN role. */
  updateRole(id: string, values: UpdateRoleValues): Promise<AppRole> {
    return apiClient.patch<AppRole>(`/roles/${id}`, values);
  },

  /**
   * Replaces the whole set — this is the matrix save, not a delta. `[]` is a
   * valid body. 409 when the role is protected, or when the save would leave
   * no active account able to manage roles.
   */
  setPermissions(id: string, permissions: Permission[]): Promise<AppRole> {
    return apiClient.put<AppRole>(`/roles/${id}/permissions`, { permissions });
  },

  /** 204 on success; 409 when the role is built-in or still has members. */
  deleteRole(id: string): Promise<void> {
    return apiClient.delete<void>(`/roles/${id}`);
  },
};
