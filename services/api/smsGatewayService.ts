import { apiClient } from "./apiClient";
import type { SmsGatewayBinding, SmsGatewayStatus } from "@/types/sms-gateway";

export const smsGatewayService = {
  /** Staff-only snapshot of the OTP SMS gateway phone and today's messages. */
  getStatus() {
    return apiClient.get<SmsGatewayStatus>("/sms-gateway/status");
  },

  /**
   * Super admin only: clears which phone the gateway token is pinned to, so
   * a reinstalled or replaced phone can register. The next device to present
   * the token becomes the pinned one.
   */
  resetBinding() {
    return apiClient.delete<SmsGatewayBinding>("/sms-gateway/binding");
  },
};
