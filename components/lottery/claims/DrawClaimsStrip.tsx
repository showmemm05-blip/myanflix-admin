"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  Clock,
  Lock,
  Ticket,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKs } from "@/components/lottery/resultsFormat";
import { useLanguage } from "@/lib/context/language-context";
import { formatMmt } from "@/lib/myanmar-time";
import { cn } from "@/lib/utils";
import type { LotteryAdminDraw, LotteryDrawClaimsBucket } from "@/types/lottery";

interface Cell {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  className?: string;
}

/** Where the strip's button and the audit log land: the claims page filtered to this draw's waiting claims. */
export function drawClaimsHref(drawId: string): string {
  return `/lottery/claims?draw=${encodeURIComponent(drawId)}&status=requested`;
}

/**
 * The board's claims strip on a published draw's Results card (2026-10-24):
 * Winning tickets · Prize total · Waiting · Paid · Not requested · Rejected
 * (+ Expired once there are any), each status cell counting TICKETS with
 * their kyat, then the deadline for requests and "Open prize claims for
 * this draw". The figures are the draw view's `claims` (payouts grouped by
 * status); when an older backend leaves them out, the strip still offers
 * the button.
 */
export function DrawClaimsStrip({ draw }: { draw: LotteryAdminDraw }) {
  const { t } = useLanguage();
  const c = t.lottery.draws.detail.results.claims;
  const claims = draw.claims ?? null;

  const bucket = (key: string, icon: LucideIcon, label: string, b: LotteryDrawClaimsBucket, tone?: string): Cell => ({
    key,
    icon,
    label,
    value: b.tickets.toLocaleString("en-US"),
    unit: b.tickets > 0 ? `${c.tickets(b.tickets)} · ${formatKs(b.ks)}` : c.tickets(b.tickets),
    className: b.tickets > 0 ? tone : undefined,
  });

  const cells: Cell[] = claims
    ? [
        { key: "winning", icon: Ticket, label: c.winningTickets, value: claims.winningTickets.toLocaleString("en-US"), unit: "" },
        { key: "total", icon: Wallet, label: c.prizeTotal, value: formatKs(claims.prizeTotalKs), unit: "" },
        bucket("waiting", Clock, c.waiting, claims.waiting, "border-warning/40"),
        bucket("paid", CircleCheck, c.paid, claims.paid, "border-success/40"),
        bucket("notRequested", CircleMinus, c.notRequested, claims.notRequested),
        bucket("rejected", CircleX, c.rejected, claims.rejected, "border-destructive/40"),
        ...(claims.expired.tickets > 0 ? [bucket("expired", Lock, c.expired, claims.expired)] : []),
      ]
    : [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-strong)] bg-secondary/30 p-3" role="group" aria-label={c.title}>
      <p className="text-sm font-semibold">{c.title}</p>
      {claims ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {cells.map((cell) => {
            const Icon = cell.icon;
            return (
              <div
                key={cell.key}
                className={cn("flex flex-col gap-1 rounded-md border border-[var(--border-strong)] bg-background/60 p-2.5", cell.className)}
              >
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{cell.label}</span>
                </p>
                <p className="truncate font-heading text-lg font-bold tabular-nums" title={cell.value}>
                  {cell.value}
                </p>
                {cell.unit && <p className="truncate text-xs tabular-nums text-muted-foreground" title={cell.unit}>{cell.unit}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{c.unavailable}</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {c.note}
          {draw.claimDeadlineAt && <> {c.deadline(formatMmt(draw.claimDeadlineAt))}</>}
        </p>
        <Button size="sm" render={<Link href={drawClaimsHref(draw.id)} />} nativeButton={false}>
          {c.open}
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
