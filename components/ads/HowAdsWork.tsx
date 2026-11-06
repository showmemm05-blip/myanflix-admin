"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { movieTimeText } from "@/components/ads/adWords";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { CORNER_FIRST_SHOW_AFTER_SECONDS } from "@/types/ad";

/** The card's element id — the header's "How ads work" button controls it. */
export const HOW_ADS_WORK_ID = "how-ads-work";

/** Set once the card has been shown open: it opens by itself on the first visit only (SPEC §1). */
const HOW_SEEN_KEY = "myanflix-admin-ads-how";

/**
 * Whether this is the first visit, read straight from localStorage in a
 * lazy initializer — the shell never renders a page before the session is
 * known (the same reason app/ads/page.tsx reads its `?ad=` deep link this
 * way), so there is no server render to mismatch. Storage that is blocked
 * or full (a private window) reads as "seen": the card then starts closed,
 * and the header button still opens it.
 */
function isFirstVisit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HOW_SEEN_KEY) === null;
  } catch {
    return false;
  }
}

/**
 * The card's open state for the page: open on the first visit, closed
 * after that, remembered per browser. The page owns it because the toggle
 * sits in the page header, away from the card.
 */
export function useHowAdsWorkOpen() {
  const [open, setOpen] = useState(isFirstVisit);
  useEffect(() => {
    try {
      window.localStorage.setItem(HOW_SEEN_KEY, "seen");
    } catch {
      // Storage blocked: the card opens again next time, which is harmless.
    }
  }, []);
  return [open, setOpen] as const;
}

/** The example's marks on a 2-hour movie with breaks every 30 minutes, as % of its length. */
const EXAMPLE_MOVIE_MINUTES = 120;
const EXAMPLE_BREAK_MINUTES = [30, 60, 90] as const;
/** The last 2 minutes (no ads) — backend BREAK_END_GUARD_SECONDS, as a share of the example. */
const END_GUARD_SHARE = (2 / EXAMPLE_MOVIE_MINUTES) * 100;

interface HowAdsWorkProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "How ads work" (2026-11-04, the `HowAdsWork` board): the three places an
 * ad can appear, a 2-hour movie drawn as a line with its ad before, its
 * breaks and the last 2 minutes without ads, and the rules that surprise
 * owners ("Good to know" — the 12-hour break memory first, the reason the
 * owner's own test once "did not play"). Words only, no settings: the
 * numbers in it are the example's, the real ones are in Ad settings.
 */
export function HowAdsWork({ open, onOpenChange }: HowAdsWorkProps) {
  const { t } = useLanguage();
  const h = t.adsUi.how;
  const places = [
    ["PREROLL", h.places.PREROLL],
    ["MIDROLL", h.places.MIDROLL],
    ["CORNER", h.places.CORNER],
  ] as const;
  const marks = [
    { at: 0, time: h.timeline.start, label: h.timeline.adBefore },
    ...EXAMPLE_BREAK_MINUTES.map((minutes) => ({
      at: (minutes / EXAMPLE_MOVIE_MINUTES) * 100,
      time: movieTimeText(t, minutes * 60),
      label: h.timeline.adBreak,
    })),
    { at: 100, time: movieTimeText(t, EXAMPLE_MOVIE_MINUTES * 60), label: h.timeline.lastMinutes },
  ];
  const cornerNote = h.timeline.corner(movieTimeText(t, CORNER_FIRST_SHOW_AFTER_SECONDS));

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      {/* Kept in the page while closed (hidden), so the header button's aria-controls always points at it. */}
      <CollapsibleContent id={HOW_ADS_WORK_ID} keepMounted>
        <section aria-labelledby={`${HOW_ADS_WORK_ID}-title`} className="glass-card mb-6 flex flex-col gap-5 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={`${HOW_ADS_WORK_ID}-title`} className="text-base font-semibold">
                {h.title}
              </h2>
              <p className="text-sm text-muted-foreground">{h.intro}</p>
            </div>
            <Button variant="ghost" aria-expanded onClick={() => onOpenChange(false)}>
              {h.hide}
            </Button>
          </div>

          <ol className="grid gap-3 md:grid-cols-3">
            {places.map(([key, place], index) => (
              <li key={key} className="flex flex-col gap-2 rounded-lg border border-[var(--border-strong)] bg-secondary/30 p-4">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
                  >
                    {index + 1}
                  </span>
                  <span className="font-semibold">{place.title}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{place.text}</p>
              </li>
            ))}
          </ol>

          <figure className="flex flex-col gap-3 rounded-lg border border-[var(--border-strong)] p-4">
            <figcaption className="text-sm font-medium">{h.exampleTitle}</figcaption>
            {/* Wide screens: the movie as a line, the marks at their real places. */}
            <div className="hidden px-14 pt-2 pb-16 sm:block" aria-hidden>
              <div className="relative h-1.5 rounded-full bg-secondary">
                <div
                  className="absolute inset-y-0 right-0 rounded-r-full bg-muted-foreground/50"
                  style={{ width: `${END_GUARD_SHARE}%` }}
                />
                {marks.map((mark) => (
                  <div key={mark.at} className="absolute top-1/2" style={{ left: `${mark.at}%` }}>
                    <span
                      className={cn(
                        "absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
                        mark.at === 100 ? "bg-muted-foreground" : "bg-primary",
                      )}
                    />
                    <div className="absolute top-3 flex w-28 -translate-x-1/2 flex-col items-center gap-0.5 text-center">
                      <span className="text-xs font-semibold">{mark.time}</span>
                      <span className="text-xs leading-snug text-muted-foreground">{mark.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Phones, and screen readers everywhere: the same marks as a list. */}
            <ol className="flex flex-col gap-1.5 text-sm sm:sr-only">
              {marks.map((mark) => (
                <li key={mark.at} className="flex gap-2">
                  <span className="w-24 shrink-0 font-semibold">{mark.time}</span>
                  <span className="text-muted-foreground">{mark.label}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-info">{cornerNote}</p>
          </figure>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{h.goodToKnow}</h3>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              {h.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-info/25 bg-info/10 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            {h.stuck}
          </p>
        </section>
      </CollapsibleContent>
    </Collapsible>
  );
}
