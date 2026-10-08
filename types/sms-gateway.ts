/**
 * GET /sms-gateway/status — the one company phone that texts OTP codes.
 * Mirrors the backend contract (backend/src/sms-gateway); staff-only.
 */

/** "log" is the dev stub (nothing is sent); "phone-gateway" is the real phone. */
export type SmsProvider = "log" | "phone-gateway";

/** The gateway phone's last heartbeat, as stored in `sms_gateway_devices`. */
export interface SmsGatewayDevice {
  /** The phone's own stable uuid (X-Device-Id). */
  id: string;
  /** ISO timestamp of the last heartbeat or job poll. */
  lastSeenAt: string;
  appVersion: string;
  /** 0–100. */
  battery: number;
  charging: boolean;
  /** 0 (none) – 4 (full), null when the phone could not read it. */
  signalLevel: number | null;
  /** e.g. "LTE", "5G", "WIFI". */
  networkType: string | null;
  /** The SIM's carrier name, e.g. "ATOM", "MPT". */
  simOperator: string | null;
  /** Send results the phone still has to upload. */
  pendingResults: number;
  lastError: string | null;
  /**
   * The phone's own verdict in its last heartbeat: false while it cannot
   * send (no signal, airplane mode, no SIM, no SMS permission, …). The
   * backend then refuses codes with its 503, as if the phone were offline.
   * True when the app does not report it.
   */
  canSend: boolean;
  /**
   * Why canSend is false — the app's short reason code (e.g. "no_service",
   * "airplane_mode"); null while it can send.
   */
  notReadyReason: string | null;
}

/**
 * Which phone the shared gateway token is bound to. The first device that
 * presents the token is pinned; every other device is refused (401) and
 * noted here so staff can see someone else tried to use the token.
 * DELETE /sms-gateway/binding (super admin only) clears the pin so a
 * reinstalled or replaced phone can register.
 */
export interface SmsGatewayBinding {
  /** The pinned phone's uuid (X-Device-Id); null while nothing is pinned. */
  deviceId: string | null;
  /** ISO timestamp. */
  pinnedAt: string | null;
  /** The last device that presented the right token under another uuid. */
  lastRejectedDeviceId: string | null;
  /** ISO timestamp of that last refusal. */
  lastRejectedAt: string | null;
  /** Refusals since the pin was set. */
  rejectedCount: number;
  /** ISO timestamp of the last staff reset. */
  resetAt: string | null;
}

/**
 * Today's messages (UTC day) by their CURRENT status — a message moves
 * SENT → DELIVERED | DELIVERY_FAILED when the carrier's delivery report lands,
 * so it is counted once, under the latest one.
 */
export interface SmsGatewayTodayCounts {
  queued: number;
  leased: number;
  sent: number;
  delivered: number;
  failed: number;
  deliveryFailed: number;
  expired: number;
  unknown: number;
  /** Replaced by a newer code (a resend) or a closed account before the phone took it — never sent. */
  cancelled: number;
}

export interface SmsGatewayStatus {
  provider: SmsProvider;
  /**
   * Codes are being accepted: a heartbeat arrived within
   * SMS_GATEWAY_OFFLINE_AFTER_SECONDS AND that phone did not say it cannot
   * send (device.canSend).
   */
  online: boolean;
  /**
   * The pinned phone's last heartbeat (the most recently seen phone while
   * nothing is pinned); null until a gateway phone has ever checked in.
   */
  device: SmsGatewayDevice | null;
  binding: SmsGatewayBinding;
  today: SmsGatewayTodayCounts;
  /** SMS_DAILY_CAP — codes are refused (503) once today's messages (every status) reach it. */
  dailyCap: number;
  /** SMS_DAILY_CAP_PER_PHONE — one number gets at most this many SMS per UTC day. */
  dailyCapPerPhone: number;
}
