"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Clapperboard } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { RequirePermission } from "@/components/shared/RequirePermission";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChoiceChips } from "@/components/ads/ChoiceChips";
import {
  AD_SHOW_STATES,
  adShowState,
  clockAt,
  showStateOfLiveState,
  type AdShowState,
} from "@/components/ads/adHealth";
import { formatLabel, placementLabel, statusBadge } from "@/components/ads/adWords";
import { AdDailyChart, videoOnlyBuckets } from "@/components/ads/analytics/AdDailyChart";
import { ALL_ADS, AdSelect } from "@/components/ads/analytics/AdSelect";
import { ResultCard, type ResultFigure, type ResultTrend } from "@/components/ads/analytics/ResultCard";
import { ResultsSummary, type ResultsSummaryKind } from "@/components/ads/analytics/ResultsSummary";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { ExportButton } from "@/components/lottery/analytics/ExportButton";
import { PeriodChips } from "@/components/lottery/analytics/PeriodChips";
import { csvFileName, csvPct, downloadCsv, type CsvValue } from "@/components/lottery/analytics/csv";
import {
  formatCount,
  formatDay,
  formatRange,
  formatShare,
  formatShortDate,
  formatSignedPct,
} from "@/components/lottery/analytics/format";
import {
  DASHBOARD_PERIODS,
  type DashboardPeriodKey,
  type DateRange,
  daySpan,
  mmtToday,
  previousRange,
  resolveDashboardPeriod,
} from "@/components/lottery/analytics/period";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useNow } from "@/lib/hooks/use-now";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { adService } from "@/services/api/adService";
import {
  AD_PLACEMENTS,
  AD_TZ_OFFSET_MINUTES,
  type Ad,
  type AdAnalyticsAdRow,
  type AdAnalyticsTotals,
} from "@/types/ad";

/** The ad select offers this many of the newest ads — the platform-wide page cap. */
const AD_SELECT_SIZE = 100;

/** The Where filter: every place, or one (before the movie, ad breaks, corner pictures). */
const PLACEMENT_FILTERS = ["ALL", ...AD_PLACEMENTS] as const;
type PlacementFilter = (typeof PLACEMENT_FILTERS)[number];

/** A labelled group in the filter bar: "Time period", "Which ad", "Where". */
function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * The change against the comparison period as a ratio (0.12 = +12%); null
 * when there was nothing before to compare with (the card then says so
 * instead of showing a meaningless +∞).
 */
function changeOf(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/**
 * The "Ad results" page (2026-11-03 as "Ad analytics"; reworded and laid
 * out per the `Results` board 2026-11-04, docs/ads-admin-ux-2026-11-04):
 * the Time period chips, the Which ad select and the Where filter (all /
 * before the movie / ad breaks / corner pictures), a one-sentence summary,
 * four video cards (times played, watched to the end, skipped, people
 * reached — each against the equal period before, each with a (?) saying
 * what it counts), the corner pictures' four (times on screen, taps, taps
 * per viewing, closed with ✕) when corner pictures are in the picture, the
 * day-by-day chart and the table of every ad with its visible status.
 *
 * The numbers are the same as before the rewording, one for one: the video
 * cards and the video chart always stand on VIDEO plays — under "All" a
 * corner viewing is counted apart (2026-11-04 review), never mixed into the
 * plays a rate is a share of. Every date is a Myanmar calendar day worked
 * out in the browser (the lottery pages' period.ts); the backend
 * aggregates. Each part loads on its own; only the overview failing takes
 * the whole page to the error state, because the summary and the cards
 * come from it.
 */
function AdResultsContent() {
  const { t } = useLanguage();
  const r = t.adsUi.results;
  // Ticks every minute: the table's "Outside its hours" and today's dates move with it.
  const now = useNow();

  const [periodKey, setPeriodKey] = useState<DashboardPeriodKey>("last7");
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [adId, setAdId] = useState(ALL_ADS);
  const [placementFilter, setPlacementFilter] = useState<PlacementFilter>("ALL");

  const today = mmtToday(now);
  const range = resolveDashboardPeriod(periodKey, custom, now);
  const placement = placementFilter === "ALL" ? undefined : placementFilter;
  const query = { from: range.from, to: range.to, adId: adId || undefined, placement };
  const queryDeps = [range.from, range.to, adId, placement];

  const ads = useAsyncData(() => adService.getAds({ page: 1, limit: AD_SELECT_SIZE }), []);
  // Only for the table's status, as the Advertisements list shows it: without
  // the settings (still loading, or refused) "Paused by settings" is left
  // out and a clean ad reads "Settings not checked", never the page.
  const settings = useAsyncData(() => adService.getSettings(), []);
  // The load time rides with the data so "Updated …" is the moment these figures were read, not a render.
  const overview = useAsyncData(
    () => adService.getAnalyticsOverview(query).then((data) => ({ data, loadedAt: Date.now() })),
    queryDeps,
  );
  const byDate = useAsyncData(() => adService.getAnalyticsByDate(query), queryDeps);
  // Under "All" with every ad, the days mix videos and corner pictures; the
  // same days filtered to Corner are fetched alongside and taken out, so the
  // chart's "Times played" bar is video plays like the cards. One ad is one
  // format, so a chosen ad never mixes and needs no second report.
  const splitCorners = !placement && !adId;
  const cornerByDate = useAsyncData(
    () => (splitCorners ? adService.getAnalyticsByDate({ ...query, placement: "CORNER" }) : Promise.resolve(null)),
    [...queryDeps, splitCorners],
  );
  // The per-ad table is never limited by the ad select: it IS the list of ads.
  const perAd = useAsyncData(
    () => adService.getAnalyticsAds({ from: range.from, to: range.to, placement }),
    [range.from, range.to, placement],
  );
  // The select stops at the newest ads, but the table lists them all and its
  // status needs the whole ad (its hours, where it plays): with more ads than
  // that, the rest of the list is read too. An empty page ends it early, should
  // ads be deleted meanwhile.
  const adsTotal = ads.data?.total ?? 0;
  const olderAds = useAsyncData(async () => {
    const older: Ad[] = [];
    for (let page = 2; (page - 1) * AD_SELECT_SIZE < adsTotal; page += 1) {
      const { items } = await adService.getAds({ page, limit: AD_SELECT_SIZE });
      if (items.length === 0) break;
      older.push(...items);
    }
    return older;
  }, [adsTotal]);

  const ov = overview.data?.data ?? null;
  const loadedAt = overview.data?.loadedAt ?? null;
  const adList = ads.data?.items ?? null;
  const selectedAd = adList?.find((ad) => ad.id === adId) ?? null;
  const oneAd = !!adId;
  const placeText = placement ? placementLabel(t, placement) : null;
  const isEmpty = ov !== null && ov.current.impressions === 0;

  // "Last 7 days · Ad breaks" — what the summary and the chart are about.
  const periodName = periodKey === "custom" ? formatRange(t, range) : r.periods[periodKey];
  const lead = [periodName, oneAd ? (selectedAd?.title ?? adId) : null, placeText]
    .filter((part): part is string => !!part)
    .join(" · ");

  // The dates line: a period that ends today stops at the moment its figures
  // were read; one day that is today is compared with the WHOLE day before.
  const days = daySpan(range);
  const endsToday = range.to === today;
  const partialDay = days === 1 && endsToday;
  const readAt = clockAt(loadedAt ?? now, AD_TZ_OFFSET_MINUTES);
  const datesText = endsToday ? r.dates.upTo(formatRange(t, range), readAt) : formatRange(t, range);
  const previous = previousRange(range);
  const comparedText = partialDay
    ? r.dates.comparedWithWholeDay(formatDay(t, previous.from, false))
    : r.dates.comparedWith(days === 1 ? formatDay(t, previous.from, false) : formatRange(t, previous, false));

  const trendOf = (current: number, before: number): ResultTrend => {
    const change = changeOf(current, before);
    if (change === null) return { change, text: r.trend.nothingBefore };
    const pct = formatSignedPct(change);
    const text = days > 1 ? r.trend.days(pct, days) : partialDay ? r.trend.wholeYesterday(pct) : r.trend.dayBefore(pct);
    return { change, text };
  };

  const retryAll = () => {
    overview.refetch();
    byDate.refetch();
    cornerByDate.refetch();
    perAd.refetch();
  };

  // A chosen ad that is a corner picture: from the ad list, or — for an ad
  // past the list's first page — from its figures (corner plays, no video).
  const adIsCorner = selectedAd
    ? selectedAd.format === "CORNER"
    : !!adId &&
      !!ov &&
      ov.current.videoImpressions === 0 &&
      ov.previous.videoImpressions === 0 &&
      (ov.current.byPlacement.corner > 0 || ov.previous.byPlacement.corner > 0);

  // Corner pictures are never watched to the end or skipped: under the
  // Corner pictures place, or with a corner ad chosen, the video cards give
  // way to the corner ones; with all places they join them as soon as a
  // corner picture showed in either period.
  const cornerOnly = placement === "CORNER" || adIsCorner;
  const cornerOpenings = ov?.current.byPlacement.corner ?? 0;
  const showCornerCards =
    !!ov && (cornerOnly || (!placement && (cornerOpenings > 0 || ov.previous.byPlacement.corner > 0)));

  // The video cards: video plays are the base of both rates, so Times played
  // counts them alone. Under "All" its (?) says so, and while corner viewings
  // are in the period its note says where they went instead of the platform
  // split (which counts every play, corner viewings included).
  const allPlaces = !placement;
  const cards: ResultFigure[] | null = ov
    ? [
        {
          key: "played",
          label: r.cards.played,
          help: allPlaces && showCornerCards ? `${r.help.played} ${r.help.playedVideoOnly}` : r.help.played,
          value: formatCount(ov.current.videoImpressions),
          note:
            allPlaces && cornerOpenings > 0
              ? r.notes.videoOnly
              : r.notes.platforms(formatCount(ov.current.byPlatform.web), formatCount(ov.current.byPlatform.mobile)),
          trend: trendOf(ov.current.videoImpressions, ov.previous.videoImpressions),
        },
        {
          key: "watched",
          label: r.cards.watched,
          help: r.help.watched,
          value: formatCount(ov.current.completions),
          note: r.notes.ofPlays(formatShare(ov.current.completionRate, 0)),
          trend: trendOf(ov.current.completions, ov.previous.completions),
        },
        {
          key: "skipped",
          label: r.cards.skipped,
          help: r.help.skipped,
          value: formatCount(ov.current.skips),
          note: r.notes.ofPlays(formatShare(ov.current.skipRate, 0)),
          trend: trendOf(ov.current.skips, ov.previous.skips),
        },
        {
          key: "people",
          label: r.cards.people,
          help: r.help.people,
          value: formatCount(ov.current.viewers),
          note: r.notes.failed(formatCount(ov.current.loadFailures), formatCount(ov.current.failures)),
          trend: trendOf(ov.current.viewers, ov.previous.viewers),
        },
      ]
    : null;

  const cornerCards: ResultFigure[] | null = ov
    ? [
        {
          key: "onScreen",
          label: r.cards.onScreen,
          help: r.help.onScreen,
          value: formatCount(ov.current.shows),
          note: r.notes.viewings(ov.current.byPlacement.corner),
          trend: trendOf(ov.current.shows, ov.previous.shows),
        },
        {
          key: "taps",
          label: r.cards.taps,
          help: r.help.taps,
          value: formatCount(ov.current.clicks),
          note: r.notes.taps,
          trend: trendOf(ov.current.clicks, ov.previous.clicks),
        },
        {
          key: "tapsPerViewing",
          label: r.cards.tapsPerViewing,
          help: r.help.tapsPerViewing,
          value: formatShare(ov.current.tapRate, 1),
          note: "",
          trend: trendOf(ov.current.tapRate, ov.previous.tapRate),
        },
        {
          key: "closed",
          label: r.cards.closed,
          help: r.help.closed,
          value: formatCount(ov.current.closes),
          note: r.notes.ofViewings(formatShare(ov.current.closeRate, 0)),
          trend: trendOf(ov.current.closes, ov.previous.closes),
        },
      ]
    : null;

  // Which summary sentence: corner pictures alone, both kinds side by side,
  // or video ads — the same split the cards make.
  const summaryKind: ResultsSummaryKind = cornerOnly
    ? "corner"
    : allPlaces && cornerOpenings > 0
      ? ov && ov.current.videoImpressions > 0
        ? "both"
        : "corner"
      : "video";

  // The chart's days: video plays only under "All" (see cornerByDate), or as sent.
  const allBuckets = byDate.data?.buckets ?? null;
  const cornerBuckets = cornerByDate.data?.buckets ?? null;
  const chartBuckets = useMemo(
    () =>
      !splitCorners ? allBuckets : allBuckets && cornerBuckets ? videoOnlyBuckets(allBuckets, cornerBuckets) : null,
    [splitCorners, allBuckets, cornerBuckets],
  );
  const chartError = byDate.error ?? (splitCorners ? cornerByDate.error : null);
  const retryChart = () => {
    byDate.refetch();
    if (splitCorners) cornerByDate.refetch();
  };

  // The table's status is the one the Advertisements list shows (adHealth.ts),
  // worked out from the whole ad. A row whose ad didn't load (the older pages
  // are still coming, or were refused) falls back on its own liveState, which
  // knows the master switch but not the hours or the breaks — so it never
  // claims "Showing" (its badge passes null as the settings: see stateBadge).
  const adById = useMemo(
    () => new Map([...(adList ?? []), ...(olderAds.data ?? [])].map((ad): [string, Ad] => [ad.id, ad])),
    [adList, olderAds.data],
  );
  const adSettings = settings.data ?? null;
  const stateOf = (row: AdAnalyticsAdRow): AdShowState => {
    const ad = adById.get(row.id);
    return ad ? adShowState(ad, adSettings, now) : showStateOfLiveState(row.liveState, adSettings);
  };
  const stateBadge = (row: AdAnalyticsAdRow) =>
    statusBadge(t, stateOf(row), row.format, adById.has(row.id) ? adSettings : null);

  const none = <span className="text-muted-foreground">{t.lottery.analytics.none}</span>;
  const tableColumns: ColumnDef<AdAnalyticsAdRow>[] = [
    {
      accessorKey: "title",
      header: r.table.columns.ad,
      cell: ({ row }) => <span className="block max-w-72 truncate font-medium">{row.original.title}</span>,
    },
    {
      id: "type",
      accessorFn: (row) => formatLabel(t, row.format),
      header: r.table.columns.type,
      cell: ({ row }) => <span className="text-muted-foreground">{formatLabel(t, row.original.format)}</span>,
    },
    {
      // Sorted in the statuses' own order (Needs a video … Showing), not alphabetically.
      id: "status",
      accessorFn: (row) => AD_SHOW_STATES.indexOf(stateOf(row)),
      header: r.table.columns.status,
      cell: ({ row }) => {
        const { label, tone } = stateBadge(row.original);
        return <StatusBadge label={label} tone={tone} />;
      },
    },
    {
      // A video ad's plays; a corner picture's times on screen, with the
      // viewings (its plays) under it — the corner cards' two numbers.
      id: "played",
      accessorFn: (row) => (row.format === "CORNER" ? row.shows : row.impressions),
      header: r.table.columns.played,
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.format === "CORNER" ? (
          <span className="flex flex-col items-end">
            <span className="tabular-nums">{r.table.onScreen(row.original.shows)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{r.table.inViewings(row.original.impressions)}</span>
          </span>
        ) : (
          <span className="tabular-nums">{formatCount(row.original.impressions)}</span>
        ),
    },
    // A corner picture is never watched to the end or skipped, and a video
    // is never tapped: those cells show a dash rather than a misleading 0.
    {
      accessorKey: "completions",
      header: r.table.columns.watched,
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.format === "CORNER" ? (
          none
        ) : (
          <span className="tabular-nums">
            {formatCount(row.original.completions)}
            {row.original.impressions > 0 && (
              <span className="text-muted-foreground"> ({formatShare(row.original.completionRate, 0)})</span>
            )}
          </span>
        ),
    },
    {
      accessorKey: "skips",
      header: r.table.columns.skipped,
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.format === "CORNER" ? none : <span className="tabular-nums">{formatCount(row.original.skips)}</span>,
    },
    {
      accessorKey: "clicks",
      header: r.table.columns.taps,
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.format === "CORNER" ? <span className="tabular-nums">{formatCount(row.original.clicks)}</span> : none,
    },
  ];

  /** One file for the whole page: a `section` column tells the overview, the days and the ads apart. */
  const exportAll = () => {
    if (!ov) throw new Error(r.states.partError);
    // "plays" counts every play (corner openings too); "video_plays" is the base of the two rates.
    const totals = (key: string, x: AdAnalyticsTotals): CsvValue[] => [
      "overview", key, "", x.impressions, x.videoImpressions, x.completions, x.skips, x.loadFailures, x.failures, x.viewers, csvPct(x.completionRate), csvPct(x.skipRate), x.byPlatform.web, x.byPlatform.mobile, x.shows, x.clicks, x.closes, csvPct(x.tapRate),
    ];
    // A day's video plays are known only once the corner days are in (under "All"), or when nothing mixes.
    const videoByKey = new Map((splitCorners ? (chartBuckets ?? []) : cornerOnly ? [] : (allBuckets ?? [])).map((b) => [b.key, b.impressions]));
    const rows: CsvValue[][] = [
      totals("current", ov.current),
      totals("previous", ov.previous),
      ...(allBuckets ?? []).map((b): CsvValue[] => ["by-date", b.key, "", b.impressions, cornerOnly ? 0 : (videoByKey.get(b.key) ?? ""), b.completions, b.skips, "", "", "", "", "", "", "", "", b.clicks, b.closes, ""]),
      ...(perAd.data?.items ?? []).map((row): CsvValue[] => ["by-ad", row.title, row.format, row.impressions, row.format === "CORNER" ? 0 : row.impressions, row.completions, row.skips, "", "", "", csvPct(row.completionRate), "", "", "", row.shows, row.clicks, row.closes, ""]),
    ];
    const suffix = [placement?.toLowerCase(), selectedAd?.id.slice(0, 8)].filter(Boolean).join("-");
    const file = csvFileName("ad-results", range, suffix || undefined);
    downloadCsv(
      file,
      ["section", "key", "type", "plays", "video_plays", "completions", "skips", "failed_to_load", "stopped_partway", "viewers", "completion_pct", "skip_pct", "web", "mobile", "shows", "taps", "closes", "tap_pct"],
      rows,
    );
    return file;
  };

  // "Updated 14:05" — with the day once the figures are from an earlier one (a page left open overnight).
  const updated =
    loadedAt === null
      ? "…"
      : r.updated(mmtToday(loadedAt) === today ? readAt : `${formatShortDate(t, mmtToday(loadedAt))}, ${readAt}`);

  return (
    <div>
      <PageHeader
        title={r.title}
        description={`${r.description} ${t.adsUi.shared.myanmarTime} · ${updated}`}
        actions={
          <ExportButton
            onExport={exportAll}
            disabled={!ov || isEmpty}
            size="sm"
            label={r.filters.download}
            exportedToast={r.filters.downloaded}
          />
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterGroup label={r.filters.period}>
              <PeriodChips
                keys={DASHBOARD_PERIODS}
                value={periodKey}
                custom={custom}
                today={today}
                compared
                words={{
                  custom: r.filters.pickDates,
                  customChip: r.filters.pickedDates,
                  dialogTitle: r.filters.pickDatesTitle,
                  dialogDescription: r.filters.pickDatesNote,
                }}
                onChange={(key, nextCustom) => {
                  if (nextCustom) setCustom(nextCustom);
                  setPeriodKey(key);
                }}
              />
            </FilterGroup>
            <FilterGroup label={r.filters.ad}>
              <AdSelect ads={adList} value={adId} onChange={setAdId} className="w-64 max-w-full" />
            </FilterGroup>
            <FilterGroup label={r.filters.where}>
              <ChoiceChips
                options={PLACEMENT_FILTERS.map((value) => ({
                  value,
                  label: value === "ALL" ? r.filters.allPlaces : placementLabel(t, value),
                }))}
                value={placementFilter}
                label={r.filters.where}
                onChange={setPlacementFilter}
              />
            </FilterGroup>
          </div>
          <p className="text-xs text-muted-foreground">
            {datesText} · {comparedText}
          </p>
          {ads.error && <p className="text-xs text-warning">{r.filters.adsLoadError}</p>}
        </div>

        {overview.error ? (
          <ErrorState title={r.states.errorTitle} description={r.states.errorDescription(datesText)} onRetry={retryAll} />
        ) : overview.isInitialLoading || !ov || !cards || !cornerCards ? (
          <>
            <p className="sr-only" aria-live="polite">
              {r.states.loading(lead)}
            </p>
            <Skeleton className="h-14 rounded-xl bg-secondary/60" />
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[132px] rounded-xl bg-secondary/60" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-xl bg-secondary/60" />
            <Skeleton className="h-80 rounded-xl bg-secondary/60" />
          </>
        ) : (
          <div
            className={cn("flex flex-col gap-4 transition-opacity", overview.isRefreshing && "opacity-60")}
            aria-busy={overview.isRefreshing || undefined}
          >
            {isEmpty ? (
              <EmptyState
                icon={Clapperboard}
                title={r.states.emptyTitle}
                description={
                  oneAd
                    ? r.states.emptyOneAd(selectedAd?.title ?? adId, datesText)
                    : r.states.emptyAll(datesText)
                }
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPeriodKey("last30")}>
                      {r.states.showLast30}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAdId(ALL_ADS)} disabled={!adId}>
                      {r.states.allAds}
                    </Button>
                    {placement && (
                      <Button variant="outline" size="sm" onClick={() => setPlacementFilter("ALL")}>
                        {r.states.allPlaces}
                      </Button>
                    )}
                  </div>
                }
              />
            ) : (
              <>
                <ResultsSummary kind={summaryKind} totals={ov.current} lead={lead} oneAd={oneAd} />

                {!cornerOnly && (
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {cards.map((figure) => (
                      <ResultCard key={figure.key} figure={figure} />
                    ))}
                  </div>
                )}
                {showCornerCards &&
                  (cornerOnly ? (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                      {cornerCards.map((figure) => (
                        <ResultCard key={figure.key} figure={figure} />
                      ))}
                    </div>
                  ) : (
                    // Next to the video cards, the corner pictures are one panel of four (the board).
                    <Card className="glass-card gap-3 py-4">
                      <h2 className="px-4 text-sm font-semibold">{t.adsUi.shared.formatsPlural.CORNER}</h2>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-4 xl:grid-cols-4">
                        {cornerCards.map((figure) => (
                          <ResultCard key={figure.key} figure={figure} variant="plain" />
                        ))}
                      </div>
                    </Card>
                  ))}

                <AdDailyChart
                  buckets={chartBuckets}
                  isLoading={byDate.isLoading || (splitCorners && cornerByDate.isLoading)}
                  error={chartError}
                  onRetry={retryChart}
                  description={r.chart.description(lead)}
                  series={cornerOnly ? "corner" : "video"}
                />

                <AnalyticsCard
                  title={r.table.title}
                  description={
                    placement
                      ? r.table.descriptionWhere(formatRange(t, range), r.table.places[placement])
                      : r.table.description(formatRange(t, range))
                  }
                  refreshing={perAd.isLoading && perAd.data !== null}
                >
                  {perAd.error ? (
                    <ErrorState description={r.states.partError} onRetry={perAd.refetch} />
                  ) : !perAd.data ? (
                    <Skeleton className="h-48 rounded-xl" />
                  ) : (
                    <DataTable
                      columns={tableColumns}
                      data={perAd.data.items}
                      pageSize={10}
                      emptyState={<p className="text-sm text-muted-foreground">{r.table.empty}</p>}
                    />
                  )}
                </AnalyticsCard>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdResultsPage() {
  const { t } = useLanguage();
  const r = t.adsUi.results;
  return (
    <RequirePermission permission="ADS.VIEW" title={r.title} description={r.description}>
      <AdResultsContent />
    </RequirePermission>
  );
}
