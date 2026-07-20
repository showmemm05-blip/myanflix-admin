import type { UserRole } from "./user";

export interface RoleDefinition {
  role: UserRole;
  title: string;
  description: string;
  color: string;
  capabilities: string[];
}
