import { apiClient } from "./apiClient";
import type {
  CreateHomePromoInput,
  HomePromo,
  HomePromoKind,
  HomeSettings,
  UpdateHomePromoInput,
  UpdateHomeSettingsInput,
} from "@/types/home-promo";

/**
 * The "Home promos" admin page: hero slides, the spotlight, coming-soon
 * cards, and the home settings. HOME.VIEW reads, HOME.MANAGE changes; the
 * backend audits every change and refreshes the apps' home page cache.
 */
export const homePromoService = {
  /** Every promo (or one kind's), ordered by kind, then position. */
  getPromos(kind?: HomePromoKind) {
    return apiClient.get<HomePromo[]>("/home/promos", { params: { kind } });
  },

  getPromo(id: string) {
    return apiClient.get<HomePromo>(`/home/promos/${id}`);
  },

  /** New promos join the END of their list. */
  createPromo(input: CreateHomePromoInput) {
    return apiClient.post<HomePromo>("/home/promos", input);
  },

  /** Absent = keep, null = clear. `kind` cannot change. */
  updatePromo(id: string, input: UpdateHomePromoInput) {
    return apiClient.patch<HomePromo>(`/home/promos/${id}`, input);
  },

  deletePromo(id: string) {
    return apiClient.delete<void>(`/home/promos/${id}`);
  },

  /** `ids` must be every promo of that kind, exactly once, in the new order. */
  reorderPromos(kind: HomePromoKind, ids: string[]) {
    return apiClient.patch<HomePromo[]>("/home/promos/reorder", { kind, ids });
  },

  getSettings() {
    return apiClient.get<HomeSettings>("/home/settings");
  },

  updateSettings(input: UpdateHomeSettingsInput) {
    return apiClient.put<HomeSettings>("/home/settings", input);
  },
};
