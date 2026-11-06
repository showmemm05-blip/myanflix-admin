"use client";

import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { AlertTriangle, Info, Loader2, MonitorSmartphone, RotateCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import type { TranslationShape } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api/apiClient";
import { bankEventsService } from "@/services/api/bankEventsService";

type Copy = TranslationShape["dashboard"]["bankMonitor"];

/** A refused attempt is a money signal — re-read as often as the SMS card does. */
const POLL_MS = 30_000;

function absoluteTime(iso: string): string | undefined {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : format(date, "d MMM yyyy, HH:mm:ss");
}

function Notice({ tone, children }: { tone: "info" | "warning" | "danger"; children: ReactNode }) {
  const Icon = tone === "info" ? Info : tone === "warning" ? AlertTriangle : ShieldAlert;
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
 * The phone-monitor's device pin at a glance (SEC-004): which PC the
 * bank-events token is bound to, whether another PC tried it, and the
 * super admin's "Reset monitor". The exact twin of the pin block on the
 * SMS gateway card — the parent mounts both under the same SETTINGS.VIEW
 * gate; a 403 anyway simply hides the card. The reset button is for the
 * super admin alone — the backend refuses everyone else.
 */
export function BankMonitorCard() {
  const { t } = useLanguage();
  const { can, role } = useRole();
  const copy: Copy = t.dashboard.bankMonitor;
  const { data, isLoading, error, refetch } = useAsyncData(() => bankEventsService.getBinding(), []);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Same gate as DELETE /bank-events/binding on the backend: SETTINGS.MANAGE
  // AND the Super Admin role itself — the one deliberate role-name check,
  // mirrored from SmsGatewayCard for the same reason (the backend's gate is
  // a hard role check no permission expresses; this only hides a button).
  const canReset = role === "SUPER_ADMIN" && can("SETTINGS.MANAGE");

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
    return <Skeleton className="h-40 rounded-xl" />;
  }

  const rejected = data.lastRejectedAt !== null && data.lastRejectedDeviceSerial !== null;
  const notPinned = data.deviceSerial === null;
  const badge = rejected
    ? { label: copy.rejectedBadge, tone: "danger" as const }
    : notPinned
      ? { label: copy.notPinned, tone: "neutral" as const }
      : { label: copy.pinnedBadge, tone: "success" as const };

  const resetPin = async () => {
    setResetting(true);
    try {
      await bankEventsService.resetBinding();
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
          <MonitorSmartphone className="size-4 text-primary" />
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

      <CardContent className="flex flex-col gap-4">
        {(error || rejected || notPinned) && (
          <div className="flex flex-col gap-2">
            {error && <Notice tone="warning">{copy.staleNote}</Notice>}
            {rejected && (
              <Notice tone="danger">
                {copy.rejectedNote(
                  data.lastRejectedDeviceSerial!,
                  absoluteTime(data.lastRejectedAt!) ?? data.lastRejectedAt!,
                )}
              </Notice>
            )}
            {notPinned && <Notice tone="info">{copy.notPinnedNote}</Notice>}
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {rejected ? (
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-xs text-muted-foreground">{copy.pinnedMonitor}</p>
              <p
                className={cn("font-mono text-sm break-all", notPinned && "text-muted-foreground")}
                title={data.pinnedAt ? absoluteTime(data.pinnedAt) : undefined}
              >
                {data.deviceSerial ?? copy.notPinned}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {copy.pinnedMonitorHint}
                {data.rejectedCount > 0 && (
                  <span className="text-destructive"> · {copy.rejectedCount(data.rejectedCount)}</span>
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

        <p className="text-xs text-muted-foreground">{copy.screenshotRuleNote}</p>
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
