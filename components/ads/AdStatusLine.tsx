"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { adShowState, type AdShowStateSettings } from "@/components/ads/adHealth";
import { statusBadge, statusSentence } from "@/components/ads/adWords";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { Ad } from "@/types/ad";

interface AdStatusLineProps {
  ad: Ad;
  /** The Ad settings; null while they load (then "Paused by settings" can't be told yet). */
  settings: AdShowStateSettings | null;
  /** The page's clock (lib/hooks/use-now.ts), so "Outside its hours" turns into "Showing" on its own. */
  now: number;
  /** Opens "Will it show?" for this ad. */
  onWhy: (ad: Ad) => void;
  className?: string;
}

/**
 * One ad's visible status (2026-11-04, the `Statuses` board): the badge from
 * adHealth.ts `adShowState` — which, unlike the backend's `liveState`, also
 * knows the master switch, "ad breaks off" and the ad's hours of the day —
 * with "Why?" beside it and the reason written underneath ("It only shows
 * 18:00–23:00 each day. It's 14:05 in Myanmar now."). Never a hover tooltip:
 * a phone never shows one.
 */
export function AdStatusLine({ ad, settings, now, onWhy, className }: AdStatusLineProps) {
  const { t } = useLanguage();
  const badge = statusBadge(t, adShowState(ad, settings, now), ad.format, settings);
  return (
    <div className={cn("flex flex-col gap-1.5 whitespace-normal", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={badge.label} tone={badge.tone} className="normal-case" />
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0"
          aria-label={t.adsUi.status.whyFor(ad.title)}
          onClick={() => onWhy(ad)}
        >
          {t.adsUi.shared.why}
        </Button>
      </div>
      <p className="text-[13px] leading-snug text-muted-foreground">{statusSentence(t, ad, settings, now)}</p>
    </div>
  );
}
