"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import type { TranslationShape } from "@/lib/i18n/translations";
import { adService } from "@/services/api/adService";
import { CORNER_FIRST_SHOW_AFTER_SECONDS, type Ad } from "@/types/ad";
import { CornerPreview } from "@/components/ads/CornerPreview";
import { adMetaLine } from "@/components/ads/AdCells";
import { linkHost } from "@/components/ads/adForm";
import { movieTimeText } from "@/components/ads/adWords";

/**
 * "Appears after 1 minute of watching, stays 10 seconds, and comes back
 * every 15 minutes of watching." — a corner picture's timing as a viewer
 * meets it (the `Corner3` board's sentence).
 */
function cornerTimingSentence(t: TranslationShape, ad: Pick<Ad, "cornerShowSeconds" | "cornerRepeatMinutes">): string {
  const c = t.adsUi.list.preview.cornerTiming;
  const first = movieTimeText(t, CORNER_FIRST_SHOW_AFTER_SECONDS);
  if (ad.cornerShowSeconds === null) return c.untilClosed(first);
  if (ad.cornerRepeatMinutes === null) return c.once(first, ad.cornerShowSeconds);
  return c.repeat(first, ad.cornerShowSeconds, movieTimeText(t, ad.cornerRepeatMinutes * 60));
}

interface AdPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ad: Ad;
}

/**
 * Shows the ad as viewers get it: a video ad plays, with where it plays
 * (before the movie, at ad breaks); a corner picture sits on a mock player
 * with its timing in one sentence (2026-11-04). The row's own `videoUrl` is
 * a signed link that expires four hours after the list was read, so the
 * dialog reads the ad again for a fresh one rather than trusting a URL that
 * may be stale — and a corner picture is read again too, so the preview is
 * the stored picture and timing, not the list's copy. The line under the
 * title is the row's own (AdCells.tsx `adMetaLine`), so both say the same.
 */
export function AdPreviewDialog({ open, onOpenChange, ad }: AdPreviewDialogProps) {
  const { t } = useLanguage();
  const d = t.adsUi.list.preview;
  const { data, isLoading, error, refetch } = useAsyncData(() => adService.getAd(ad.id), [ad.id]);
  const fresh = data ?? null;
  const corner = ad.format === "CORNER";

  const host = linkHost(fresh?.linkUrl);
  const meta = !fresh || !(corner ? fresh.imageUrl : fresh.videoUrl) ? null : adMetaLine(t, fresh);
  // A corner picture's link is already in the meta line ("opens example.com"); without one, say so.
  const where = !fresh
    ? null
    : corner
      ? host
        ? null
        : d.noLink
      : fresh.playsBeforeMovie && fresh.playsAtBreaks
        ? d.slots.both
        : fresh.playsAtBreaks
          ? d.slots.breaks
          : d.slots.before;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8 leading-snug break-words">{d.title(ad.title)}</DialogTitle>
          {meta && <DialogDescription>{meta}</DialogDescription>}
          {where && <p className="text-xs text-muted-foreground">{where}</p>}
        </DialogHeader>
        {error ? (
          <ErrorState description={d.loadError} onRetry={refetch} />
        ) : isLoading || !fresh ? (
          <Skeleton className="aspect-video w-full rounded-lg" />
        ) : corner ? (
          fresh.imageUrl ? (
            <CornerPreview
              src={fresh.imageUrl}
              width={fresh.imageWidth}
              height={fresh.imageHeight}
              closable={fresh.cornerClosable}
              linkUrl={fresh.linkUrl}
              timeline={cornerTimingSentence(t, fresh)}
              title={fresh.title}
            />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{d.noPicture}</p>
          )
        ) : fresh.videoUrl ? (
          <div className="overflow-hidden rounded-lg border border-[var(--border-strong)] bg-black">
            {/* A short clip checked by eye — there is no caption track to offer. */}
            <video key={fresh.videoUrl} src={fresh.videoUrl} controls preload="metadata" playsInline className="aspect-video w-full" />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{d.noVideo}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
