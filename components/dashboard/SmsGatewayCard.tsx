"use client";

import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  Info,
  Loader2,
  MessageSquareText,
  RotateCw,
  ShieldAlert,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useNow } from "@/lib/hooks/use-now";
import type { TranslationShape } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api/apiClient";
import { smsGatewayService } from "@/services/api/smsGatewayService";
import type { SmsGatewayStatus } from "@/types/sms-gateway";

type Copy = TranslationShape["dashboard"]["smsGateway"];

/**
 * Re-read the status as often as the phone sends its heartbeat, so "online"
 * flips within one beat of the phone dropping off (the backend calls it
 * offline after SMS_GATEWAY_OFFLINE_AFTER_SECONDS, 90 s by default).
 */
const POLL_MS = 30_000;
/** Battery at or under this, not charging, is worth a warning colour. */
const LOW_BATTERY = 20;

/** How stale the last heartbeat is — an operator reads age, not o'clock. */
function lastSeenAgo(iso: string, now: number, copy: Copy): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return copy.notReported;
  // A future timestamp (server/browser clock skew) reads as "just now".
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 10) return copy.justNow;
  if (seconds < 60) return copy.secondsAgo(seconds);
  if (seconds < 3600) return copy.minutesAgo(Math.floor(seconds / 60));
  if (seconds < 86_400) return copy.hoursAgo(Math.floor(seconds / 3600));
  return copy.daysAgo(Math.floor(seconds / 86_400));
}

function absoluteTime(iso: string): string | undefined {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : format(date, "d MMM yyyy, HH:mm:ss");
}

/** 0–4 bars, the way a phone's status bar draws it. */
function SignalBars({ level, label }: { level: number; label: string }) {
  const clamped = Math.max(0, Math.min(4, Math.round(level)));
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex h-3.5 items-end gap-0.5">
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={cn("w-1 rounded-[1px]", bar <= clamped ? "bg-foreground" : "bg-muted-foreground/30")}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </span>
  );
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {/* No letter-spacing and no uppercase: the Burmese labels break under both. */}
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium">{children}</dd>
    </div>
  );
}

function Count({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "danger" | "warning";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-heading text-xl font-semibold tabular-nums",
          value > 0 && tone === "danger" && "text-destructive",
          value > 0 && tone === "warning" && "text-warning",
        )}
      >
        {value.toLocaleString("en-US")}
      </p>
      <p className="truncate text-[11px] text-muted-foreground" title={hint}>
        {hint}
      </p>
    </div>
  );
}

function Notice({ tone, children }: { tone: "info" | "warning" | "danger"; children: ReactNode }) {
  const Icon = tone === "info" ? Info : tone === "warning" ? AlertTriangle : WifiOff;
  return (
    <div
      role={tone === "info" ? undefined : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        tone === "info" && "border-info/25 bg-info/10 text-info",
        tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
        tone === "danger" && "border-destructive/25 bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p className="text-foreground/90">{children}</p>
    </div>
  );
}

/**
 * The phone's notReadyReason code in the reader's language — the same words
 * as the gateway app's own screen. A code this card does not know is shown
 * as the phone sent it.
 */
function notReadyText(reason: string | null, copy: Copy): string {
  if (!reason) return copy.notReported;
  return copy.notReadyReasons[reason] ?? reason;
}

/**
 * True when the phone's last heartbeat said it cannot send. The backend then
 * refuses codes (503) exactly as for an offline phone, so `online` is false.
 */
function phoneCannotSend(status: SmsGatewayStatus): boolean {
  return status.device !== null && !status.device.canSend;
}

function badgeFor(status: SmsGatewayStatus, copy: Copy): { label: string; tone: StatusTone } {
  if (status.provider === "log") return { label: copy.logMode, tone: "neutral" };
  if (status.online) return { label: copy.online, tone: "success" };
  return phoneCannotSend(status) ? { label: copy.notReady, tone: "danger" } : { label: copy.offline, tone: "danger" };
}

/**
 * The OTP SMS gateway at a glance: is the company phone online, how is it
 * doing (battery, signal, SIM), which phone the gateway token is pinned to
 * (and whether another device tried it), and what happened to today's codes
 * against the daily cap. The parent mounts it only for staff whose
 * permissions let them read GET /sms-gateway/status; a 403 anyway (the
 * backend's gate is the real one) simply hides the card instead of showing
 * an error. The "Reset phone" button is for the super admin alone — the
 * backend refuses everyone else.
 */
export function SmsGatewayCard() {
  const { t } = useLanguage();
  const { can, role } = useRole();
  const copy = t.dashboard.smsGateway;
  const { data, isLoading, error, refetch } = useAsyncData(() => smsGatewayService.getStatus(), []);
  const now = useNow(5_000);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Same gate as DELETE /sms-gateway/binding on the backend: SETTINGS.MANAGE
  // AND the Super Admin role itself. The admin's rule is "never branch on a
  // role name — everything goes through can()" (role-context.tsx); this is
  // the one deliberate exception, because the backend's own gate here is a
  // hard role check that no permission expresses: the owner can grant
  // SETTINGS.MANAGE to another role and its holders still get 403. Mirroring
  // it only hides a button that would fail; the backend remains the gate.
  const canReset = role === "SUPER_ADMIN" && can("SETTINGS.MANAGE");

  // Poll while the tab is visible; catch up the moment it becomes visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);

  if (error instanceof ApiError && error.status === 403) return null;

  if (!data) {
    if (error) {
      return <ErrorState description={copy.loadError} onRetry={refetch} className="py-10" />;
    }
    return <Skeleton className="h-72 rounded-xl" />;
  }

  const { device, binding, today, dailyCap, dailyCapPerPhone } = data;
  const badge = badgeFor(data, copy);
  const isGateway = data.provider === "phone-gateway";
  const cannotSend = phoneCannotSend(data);
  const rejected = binding.lastRejectedAt !== null && binding.lastRejectedDeviceId !== null;
  const notPinned = isGateway && binding.deviceId === null;

  // Every message queued today counts toward the cap, whatever became of it
  // (a cancelled one too: the backend's cap counts every row created today).
  const used =
    today.queued +
    today.leased +
    today.sent +
    today.delivered +
    today.failed +
    today.deliveryFailed +
    today.expired +
    today.unknown +
    today.cancelled;
  const capReached = dailyCap > 0 && used >= dailyCap;
  const usedPercent = dailyCap > 0 ? Math.min(100, (used / dailyCap) * 100) : 0;
  const usageText = copy.usage(used, dailyCap);
  // Counts are by CURRENT status: a sent message moves on to DELIVERED or
  // DELIVERY_FAILED when the carrier's report lands, so all three were sent.
  const sentTotal = today.sent + today.delivered + today.deliveryFailed;

  const lowBattery = device !== null && !device.charging && device.battery <= LOW_BATTERY;
  const BatteryIcon = device?.charging ? BatteryCharging : lowBattery ? BatteryLow : BatteryMedium;

  const resetPin = async () => {
    setResetting(true);
    try {
      await smsGatewayService.resetBinding();
      toast.success(copy.resetPinDone);
      setResetOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : copy.resetPinFailed);
    } finally {
      setResetting(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <MessageSquareText className="size-4 text-primary" />
          {copy.title}
          <StatusBadge label={badge.label} tone={badge.tone} className="normal-case tracking-normal" />
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
        <CardAction>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            onClick={refetch}
            disabled={isLoading}
            aria-label={isLoading ? copy.refreshing : copy.refresh}
          >
            {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
            <span className="hidden sm:inline">{isLoading ? copy.refreshing : copy.refresh}</span>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {(error || !isGateway || !device || !data.online || capReached || rejected || notPinned) && (
          <div className="flex flex-col gap-2">
            {error && <Notice tone="warning">{copy.staleNote}</Notice>}
            {!isGateway && <Notice tone="info">{copy.logModeNote}</Notice>}
            {rejected && (
              <Notice tone="danger">
                {copy.rejectedNote(
                  binding.lastRejectedDeviceId!,
                  absoluteTime(binding.lastRejectedAt!) ?? binding.lastRejectedAt!,
                )}
              </Notice>
            )}
            {notPinned && <Notice tone="info">{copy.notPinnedNote}</Notice>}
            {isGateway && !device && <Notice tone="warning">{copy.noDevice}</Notice>}
            {isGateway && device && !data.online && (
              <Notice tone="danger">
                {cannotSend ? copy.notReadyNote(notReadyText(device.notReadyReason, copy)) : copy.offlineNote}
              </Notice>
            )}
            {capReached && <Notice tone="danger">{copy.capReached}</Notice>}
          </div>
        )}

        {isGateway && (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              {rejected ? (
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-xs text-muted-foreground">{copy.pinnedPhone}</p>
                <p
                  className={cn("font-mono text-sm break-all", binding.deviceId === null && "text-muted-foreground")}
                  title={binding.pinnedAt ? absoluteTime(binding.pinnedAt) : undefined}
                >
                  {binding.deviceId ?? copy.notPinned}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {copy.pinnedPhoneHint}
                  {binding.rejectedCount > 0 && (
                    <span className="text-destructive"> · {copy.rejectedCount(binding.rejectedCount)}</span>
                  )}
                </p>
              </div>
            </div>
            {canReset && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setResetOpen(true)}
                disabled={resetting}
              >
                {copy.resetPin}
              </Button>
            )}
          </div>
        )}

        <div className={cn("grid grid-cols-1 gap-6", device && "lg:grid-cols-2")}>
          {device && (
            <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-4 sm:grid-cols-3">
              <Fact label={copy.canSend} className="col-span-2 sm:col-span-3">
                {device.canSend ? (
                  <span className="text-success">{copy.canSendYes}</span>
                ) : (
                  <span className="block break-words text-destructive">
                    {notReadyText(device.notReadyReason, copy)}
                  </span>
                )}
              </Fact>
              <Fact label={copy.lastSeen}>
                <span
                  title={absoluteTime(device.lastSeenAt)}
                  className={cn("tabular-nums", isGateway && !data.online && "text-destructive")}
                >
                  {lastSeenAgo(device.lastSeenAt, now, copy)}
                </span>
              </Fact>
              <Fact label={copy.battery}>
                <span className={cn("inline-flex items-center gap-1.5 tabular-nums", lowBattery && "text-warning")}>
                  <BatteryIcon className="size-4 shrink-0" />
                  {device.battery}%
                  {device.charging && (
                    <span className="text-xs font-normal text-muted-foreground">{copy.charging}</span>
                  )}
                </span>
              </Fact>
              <Fact label={copy.signal}>
                {device.signalLevel === null && !device.networkType ? (
                  copy.notReported
                ) : (
                  <span className="inline-flex max-w-full items-center gap-2">
                    {device.signalLevel !== null && (
                      <SignalBars level={device.signalLevel} label={copy.signalLevel(device.signalLevel)} />
                    )}
                    {device.networkType && <span className="truncate">{device.networkType}</span>}
                  </span>
                )}
              </Fact>
              <Fact label={copy.sim}>
                <span className="block truncate" title={device.simOperator ?? undefined}>
                  {device.simOperator || copy.notReported}
                </span>
              </Fact>
              <Fact label={copy.appVersion}>
                <span className="block truncate tabular-nums">{device.appVersion || copy.notReported}</span>
              </Fact>
              <Fact label={copy.pendingResults}>
                <span className={cn("tabular-nums", device.pendingResults > 0 && "text-warning")}>
                  {device.pendingResults.toLocaleString("en-US")}
                </span>
              </Fact>
              {device.lastError && (
                <Fact label={copy.lastError} className="col-span-2 sm:col-span-3">
                  <span className="block font-normal break-words text-muted-foreground">{device.lastError}</span>
                </Fact>
              )}
            </dl>
          )}

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">{copy.todayTitle}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Count label={copy.sent} value={sentTotal} hint={copy.sentHint(today.delivered, today.deliveryFailed)} />
              <Count label={copy.failed} value={today.failed} hint={copy.failedHint} tone="danger" />
              <Count label={copy.unknown} value={today.unknown} hint={copy.unknownHint} tone="warning" />
              <Count label={copy.expired} value={today.expired} hint={copy.expiredHint} tone="warning" />
              <Count label={copy.cancelled} value={today.cancelled} hint={copy.cancelledHint} />
              <Count label={copy.waiting} value={today.queued + today.leased} hint={copy.waitingHint} />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className={cn("text-xs tabular-nums text-muted-foreground", capReached && "text-destructive")}>
                {usageText}
              </p>
              <Progress
                value={usedPercent}
                aria-label={usageText}
                className={cn(capReached && "[&_[data-slot=progress-indicator]]:bg-destructive")}
              />
              <p className="text-xs text-muted-foreground">{copy.perPhoneCap(dailyCapPerPhone)}</p>
            </div>
          </div>
        </div>
      </CardContent>

      {canReset && (
        <ConfirmDialog
          open={resetOpen}
          onOpenChange={(open) => {
            if (!resetting) setResetOpen(open);
          }}
          title={copy.resetPinTitle}
          description={copy.resetPinDescription}
          confirmLabel={copy.resetPin}
          variant="destructive"
          loading={resetting}
          onConfirm={resetPin}
        />
      )}
    </Card>
  );
}
