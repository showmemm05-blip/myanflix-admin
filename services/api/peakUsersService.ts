import { apiClient } from "./apiClient";
import type { PeakUsersAdminView } from "@/types/peak-users";

export const peakUsersService = {
  getAdmin() {
    return apiClient.get<PeakUsersAdminView>("/peak-users/admin");
  },

  updateAdditional(additionalPeak: number) {
    return apiClient.patch<PeakUsersAdminView>("/peak-users/additional", { additionalPeak });
  },
};
