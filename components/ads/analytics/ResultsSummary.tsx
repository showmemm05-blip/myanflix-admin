"use client";

import { Fragment } from "react";
import { formatCount, formatShare } from "@/components/lottery/analytics/format";
import { useLanguage } from "@/lib/context/language-context";
import type { AdAnalyticsTotals } from "@/types/ad";

/**
 * Which sentence the summary uses: video ads only, corner pictures only, or
 * both (the "All" place with video plays AND corner viewings in the period).
 */
export type ResultsSummaryKind = "video" | "corner" | "both";

interface ResultsSummaryProps {
  kind: ResultsSummaryKind;
  /** The period's figures (overview `current`). */
  totals: AdAnalyticsTotals;
  /** "Last 7 days" — with the ad and the place when one is picked: "Last 7 days · Ad breaks". */
  lead: string;
  /** One ad is picked: "this ad played…" / "this picture was…" instead of "your video ads…". */
  oneAd: boolean;
}

/**
 * Fills a template from lib/i18n/ads/results.ts: each `{name}` becomes its
 * value in bold, the words around it stay as written — so the Burmese keeps
 * its own word order and the numbers still stand out. A name with no value
 * is left as typed, which shows a copy mistake instead of hiding it.
 */
function fill(template: string, values: Record<string, string>) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    const value = name === undefined ? undefined : values[name];
    return value === undefined ? (
      <Fragment key={i}>{part}</Fragment>
    ) : (
      <b key={i} className="font-semibold text-foreground">
        {value}
      </b>
    );
  });
}

/**
 * The one sentence above the cards (the `Results` board): "Last 7 days:
 * your video ads played 4,120 times to 1,380 people, and 57% were watched
 * to the end." Every number is one the cards show, with the same meaning:
 * plays = video plays (`videoImpressions`), people = `viewers`, watched =
 * `completionRate`, on screen = `shows`, viewings = corner openings
 * (`byPlacement.corner`), taps = `clicks`. People are distinct over every ad
 * the filters let in, so with both kinds counted they get a sentence of
 * their own rather than being credited to the video ads.
 */
export function ResultsSummary({ kind, totals, lead, oneAd }: ResultsSummaryProps) {
  const { t } = useLanguage();
  const s = t.adsUi.results.summary;
  const n = {
    plays: totals.videoImpressions,
    people: totals.viewers,
    shows: totals.shows,
    viewings: totals.byPlacement.corner,
    taps: totals.clicks,
  };
  const template =
    kind === "both"
      ? s.both(n)
      : kind === "corner"
        ? (oneAd ? s.cornerOneAd : s.corner)(n)
        : (oneAd ? s.videoOneAd : s.video)(n);
  const values: Record<string, string> = {
    period: lead,
    plays: formatCount(n.plays),
    people: formatCount(n.people),
    watched: formatShare(totals.completionRate, 0),
    shows: formatCount(n.shows),
    viewings: formatCount(n.viewings),
    taps: formatCount(n.taps),
  };

  return (
    <p className="rounded-xl border border-border bg-card/60 px-4 py-3 text-[15px] leading-relaxed text-foreground/90">
      {fill(template, values)}
    </p>
  );
}
