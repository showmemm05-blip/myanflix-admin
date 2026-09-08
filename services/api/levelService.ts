import { apiClient } from "./apiClient";
import type { AppLevel, UserLevelStatus } from "@/types/level";

export interface LevelValues {
  name: string;
  threshold: number;
  icon: string;
  color: string;
  order?: number;
  enabled?: boolean;
}

export interface LevelOrderItem {
  id: string;
  order: number;
}

/**
 * Membership-level administration. Reads hit /levels/all (includes disabled
 * rungs) rather than the public /levels ladder, because the management page
 * must show what it can re-enable.
 */
export const levelService = {
  getAllLevels(signal?: AbortSignal) {
    return apiClient.get<AppLevel[]>("/levels/all", { signal });
  },

  /** One user's resolved standing (USERS.VIEW) — held rung, next rung, progress. */
  getUserLevel(userId: string, signal?: AbortSignal) {
    return apiClient.get<UserLevelStatus>(`/users/${userId}/level`, { signal });
  },

  createLevel(values: LevelValues, signal?: AbortSignal) {
    return apiClient.post<AppLevel>("/levels", values, { signal });
  },

  updateLevel(id: string, values: Partial<LevelValues>, signal?: AbortSignal) {
    return apiClient.put<AppLevel>(`/levels/${id}`, values, { signal });
  },

  deleteLevel(id: string) {
    return apiClient.delete<void>(`/levels/${id}`);
  },

  // Object wrapper (not a bare array) so the backend's global ValidationPipe
  // whitelist applies cleanly.
  reorderLevels(items: LevelOrderItem[], signal?: AbortSignal) {
    return apiClient.put<AppLevel[]>("/levels/reorder", { items }, { signal });
  },
};
