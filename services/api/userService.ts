import { apiClient } from "./apiClient";
import { toPermissions, type Permission } from "@/lib/permissions";
import { userLabel } from "@/lib/user-label";
import type { AppLevel } from "@/types/level";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  AppUser,
  AuthenticatedProfile,
  UserRole,
  UserStatus,
} from "@/types/user";
import { ROLE_LABELS } from "@/types/user";
import type {
  CreateWalletAdjustmentValues,
  WalletAdjustment,
  WalletAdjustmentResult,
} from "@/types/wallet-adjustment";

interface BackendUser {
  id: string;
  username: string;
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  balance?: number;
  totalDeposited?: number;
  totalSpent?: number;
  isSubscribed?: boolean;
  subscriptionExpiresAt?: string | null;
  /** Resolved membership level — populated on the admin list route only. */
  level?: AppLevel | null;
}

/**
 * `GET /users/me` alone carries the caller's effective RBAC state — the
 * users list/detail routes return the plain profile shape, so these two
 * fields are optional on the wire type and only ever present here.
 */
interface BackendMe extends BackendUser {
  permissions?: string[];
  roleName?: string;
}

function mapUser(u: BackendUser): AppUser {
  return {
    id: u.id,
    // Phone signups carry a machine-generated username, so the label is the
    // display name they set — `username` rides along untouched for the
    // surfaces that must show the login identity.
    name: userLabel(u),
    username: u.username,
    displayName: u.displayName,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    role: u.role,
    status: u.status,
    balance: u.balance ?? 0,
    totalDeposited: u.totalDeposited ?? 0,
    totalSpent: u.totalSpent ?? 0,
    isSubscribed: u.isSubscribed ?? false,
    subscriptionExpiresAt: u.subscriptionExpiresAt ?? null,
    joinDate: u.createdAt,
    // Carried through explicitly: this mapper rebuilds the row field by
    // field, so a field the API sends but this list omits is silently
    // dropped — `level` shipped on the wire for a while and never reached
    // the table because of exactly that, and the optional type let it slip
    // through the type check.
    level: u.level ?? null,
  };
}

/**
 * `GET /users` query. `search` is matched server-side against the login
 * identity, the display name AND the phone number, so an account stays
 * findable by whichever of the three the admin happens to have in hand — a
 * client-side filter over the rendered label could only ever match one.
 */
export interface UsersQuery extends PaginationParams {
  search?: string;
}

export const userService = {
  /**
   * The signed-in caller, enriched with the effective permission set the
   * whole admin gates on. `permissions` is filtered through the local
   * catalogue so a permission this build doesn't know about is ignored
   * rather than trusted — the backend stays the real gate regardless.
   */
  async getMe(): Promise<AuthenticatedProfile> {
    const user = await apiClient.get<BackendMe>("/users/me");
    return {
      ...mapUser(user),
      permissions: toPermissions(user.permissions ?? []) as Permission[],
      roleName: user.roleName ?? ROLE_LABELS[user.role],
    };
  },

  async getUsers(query: UsersQuery = {}): Promise<PaginatedResponse<AppUser>> {
    const res = await apiClient.get<PaginatedResponse<BackendUser>>("/users", { params: query });
    return { ...res, items: res.items.map(mapUser) };
  },

  async getUserById(id: string): Promise<AppUser> {
    const user = await apiClient.get<BackendUser>(`/users/${id}`);
    return mapUser(user);
  },

  async updateUserRole(id: string, role: UserRole): Promise<AppUser> {
    const user = await apiClient.patch<BackendUser>(`/users/${id}/role`, { role });
    return mapUser(user);
  },

  async updateUserStatus(id: string, status: UserStatus): Promise<AppUser> {
    const user = await apiClient.patch<BackendUser>(`/users/${id}/status`, { status });
    return mapUser(user);
  },

  /**
   * Manually credit/debit a user's wallet — Super Admin only (WALLET_ADJUST).
   * Idempotent per `values.idempotencyKey`: resubmitting the same key returns
   * the original adjustment with `replayed: true` instead of double-charging.
   */
  adjustBalance(userId: string, values: CreateWalletAdjustmentValues): Promise<WalletAdjustmentResult> {
    return apiClient.post<WalletAdjustmentResult>(`/users/${userId}/wallet-adjustments`, values);
  },

  /** Audit trail of manual balance adjustments, newest first — Super Admin only (WALLET_ADJUST). */
  getWalletAdjustments(
    userId: string,
    pagination: PaginationParams = {},
  ): Promise<PaginatedResponse<WalletAdjustment>> {
    return apiClient.get<PaginatedResponse<WalletAdjustment>>(`/users/${userId}/wallet-adjustments`, {
      params: pagination,
    });
  },
};
