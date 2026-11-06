import { apiClient } from "./apiClient";
import type { BankEventsBinding } from "@/types/bank-events";

export const bankEventsService = {
  /** Staff-only: which phone-monitor PC the bank-events token is pinned to (SETTINGS.VIEW). */
  getBinding() {
    return apiClient.get<BankEventsBinding>("/bank-events/binding");
  },

  /**
   * Super admin only: clears which monitor the token is pinned to, so a
   * reinstalled or moved phone-monitor can register. The next monitor to
   * present the token becomes the pinned one.
   */
  resetBinding() {
    return apiClient.delete<BankEventsBinding>("/bank-events/binding");
  },
};
