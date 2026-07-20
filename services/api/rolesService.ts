import { apiClient } from "./apiClient";
import type { UserRole } from "@/types/user";

export interface RolePermissions {
  role: UserRole;
  permissions: string[];
}

export const rolesService = {
  getRolePermissionMatrix() {
    return apiClient.get<RolePermissions[]>("/roles");
  },
};
