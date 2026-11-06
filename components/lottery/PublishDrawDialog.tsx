"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatRate, isDrawStateError, lotteryErrorMessage } from "@/components/lottery/drawFormat";
import { formatKs, prizeGroupName, prizeKs } from "@/components/lottery/resultsFormat";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { lotteryService } from "@/services/api/lotteryService";
import type { LotteryAdminDraw, LotteryPublishPreview } from "@/types/lottery";

interface PublishDrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draw: LotteryAdminDraw;
  /** Kyat per Baht the draw is published at — sent with the request. */
  rate: number;
  onPublished: () => void;
  /** The draw was not in the state the page showed (409): the parent reloads it. */
  onConflict: () => void;
}

/**
 * The totals of the preview, then the publish itself: every ticket marked
 * won or not won and every prize worked out inside the one request — nobody
 * is paid (2026-10-24): the winners request their payment in the app and
 * each claim is confirmed on Prize claims. The preview is counted at the
 * draw's (or the setting's) rate; when the admin typed a different rate on
 * the card, the kyat totals are scaled to it here and the dialog says so —
 * the backend recomputes exactly at the rate it is sent. Mounted with a
 * `key` per opening, so the preview loads fresh each time.
 */
export function PublishDrawDialog({ open, onOpenChange, draw, rate, onPublished, onConflict }: PublishDrawDialogProps) {
  const { t } = useLanguage();
  const r = t.lottery.draws.detail.results;
  const p = r.publishDialog;
  const [publishing, setPublishing] = useState(false);

  const { data: preview, isLoading, error, refetch } = useAsyncData(
    () => lotteryService.getPublishPreview(draw.id),
    [draw.id],
  );

  const totals = preview ? scaleToRate(preview, rate) : null;

  const handlePublish = async () => {
    if (!preview) return;
    setPublishing(true);
    try {
      await lotteryService.publishDraw(draw.id, { exchangeRate: rate });
      toast.success(r.publishedToast, {
        description: r.publishedDescription(preview.winners, formatKs(totals?.prizesKs ?? preview.prizesKs)),
      });
      onPublished();
      onOpenChange(false);
    } catch (err) {
      toast.error(r.publishFailedToast, { description: lotteryErrorMessage(err, t) });
      if (isDrawStateError(err)) {
        onConflict();
        onOpenChange(false);
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !publishing && onOpenChange(next)}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{p.title}</AlertDialogTitle>
          <AlertDialogDescription>{p.description(draw.drawNo)}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border border-[var(--border-strong)] bg-secondary/40 p-4">
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {r.counting}
            </p>
          ) : error || !preview || !totals ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-destructive">{r.previewFailedToast}</p>
              <Button size="sm" variant="outline" onClick={refetch}>
                {t.common.retry}
              </Button>
            </div>
          ) : publishing ? (
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              {p.paying}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-base font-semibold tabular-nums">
                  {preview.winners > 0 ? p.summary(preview.winners, formatKs(totals.prizesKs)) : p.noWinners}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {p.ticketsChecked(preview.tickets)} · {p.rateLine(formatRate(rate))}
                </p>
              </div>
              {totals.scaled && <p className="text-xs text-warning">{p.rateDiffers(formatRate(preview.rate))}</p>}
              {totals.byGroup.length > 0 && (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  <dt className="col-span-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {p.byGroup}
                  </dt>
                  {totals.byGroup.map((g) => (
                    <div key={g.key} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{prizeGroupName(g.key, t)}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {p.groupLine(g.winners, formatKs(g.ks))}
                      </span>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={publishing}>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction disabled={publishing || isLoading || !preview || !!error} onClick={handlePublish}>
            {publishing && <Loader2 className="size-4 animate-spin" />}
            {p.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The preview's kyat at the rate the admin will publish at. When the rates
 * agree the backend's numbers are shown untouched; otherwise the Baht total
 * is converted at the new rate and each group's kyat scaled by the ratio
 * (to the cent), which is what the backend will pay give or take rounding.
 */
function scaleToRate(preview: LotteryPublishPreview, rate: number) {
  const scaled = preview.rate > 0 && Math.abs(preview.rate - rate) > 1e-9;
  const factor = scaled ? rate / preview.rate : 1;
  return {
    scaled,
    prizesKs: scaled ? prizeKs(preview.prizesBaht, rate) : preview.prizesKs,
    byGroup: (preview.byGroup ?? [])
      .filter((g) => g.winners > 0)
      .map((g) => ({ ...g, ks: scaled ? Math.round(g.ks * factor * 100) / 100 : g.ks })),
  };
}
