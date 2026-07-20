import { apiClient } from "./apiClient";
import { tokenStore } from "@/lib/auth/token-store";
import { movieService } from "./movieService";
import { videoService } from "./videoService";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { AppUser, PurchaseEntry, UserRole, UserStatus, WatchHistoryEntry } from "@/types/user";

interface BackendUser {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  balance?: number;
  totalDeposited?: number;
  totalSpent?: number;
  moviesPurchased?: number;
}

function mapUser(u: BackendUser): AppUser {
  return {
    id: u.id,
    name: u.username,
    email: u.email,
    avatarUrl: u.avatar ?? `https://i.pravatar.cc/150?u=${encodeURIComponent(u.username)}`,
    role: u.role,
    status: u.status,
    balance: u.balance ?? 0,
    totalDeposited: u.totalDeposited ?? 0,
    totalSpent: u.totalSpent ?? 0,
    moviesPurchased: u.moviesPurchased ?? 0,
    joinDate: u.createdAt,
  };
}

function isSelf(userId: string): boolean {
  return tokenStore.getUser()?.id === userId;
}

export const userService = {
  async getMe(): Promise<AppUser> {
    const user = await apiClient.get<BackendUser>("/users/me");
    return mapUser(user);
  },

  async getUsers(pagination: PaginationParams = {}): Promise<PaginatedResponse<AppUser>> {
    const res = await apiClient.get<PaginatedResponse<BackendUser>>("/users", { params: pagination });
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

  /** Own history when `userId` is the caller; the Super-Admin-only admin view otherwise. */
  getWatchHistory(
    userId: string,
    pagination: PaginationParams = {},
  ): Promise<PaginatedResponse<WatchHistoryEntry>> {
    return isSelf(userId)
      ? videoService.getMyWatchHistory(pagination)
      : videoService.getUserWatchHistory(userId, pagination);
  },

  getPurchaseHistory(
    userId: string,
    pagination: PaginationParams = {},
  ): Promise<PaginatedResponse<PurchaseEntry>> {
    return isSelf(userId)
      ? movieService.getMyPurchases(pagination)
      : movieService.getUserPurchases(userId, pagination);
  },
};
