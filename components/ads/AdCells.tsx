"use client";

import Image from "next/image";
import { AlertTriangle, Clapperboard, Eye, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/tables/RowActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { adHasMedia, formatAdDuration, isOvernight, linkHost } from "@/components/ads/adForm";
import { formatLabel, movieTimeText, moviesText, slotsText } from "@/components/ads/adWords";
import { useLanguage } from "@/lib/context/language-context";
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatMmtDate } from "@/lib/myanmar-time";
import { cn } from "@/lib/utils";
import type { Ad, AdFormat } from "@/types/ad";

/**
 * The pieces of one ad's row on the Advertisements list (2026-11-04, the
 * `Main` and `Statuses` boards), shared by the table (columns.tsx) and the
 * phone cards (AdCardList.tsx) so both say the same thing in the same words:
 * who the ad is, its "Show to viewers" switch, where and when it shows, which
 * movies, and its results. Every sentence is written out — nothing hides in
 * a hover, which a phone never shows. The status line is AdStatusLine.tsx.
 */

/** "12,345" — the admin's en-US grouping everywhere, in both languages. */
const count = (value: number) => value.toLocaleString("en-US");

const FORMAT_ICONS = { VIDEO: Clapperboard, CORNER: ImageIcon } as const;

/** "Video ad" / "Corner picture" with its icon — the list's type chip, and the Ad results table's. */
export function AdFormatBadge({ format, t }: { format: AdFormat; t: TranslationShape }) {
  const Icon = FORMAT_ICONS[format];
  return (
    <Badge variant="outline" className="h-5 shrink-0 gap-1 px-1.5 text-[10px] font-medium text-muted-foreground">
      <Icon className="size-3" />
      {formatLabel(t, format)}
    </Badge>
  );
}

/**
 * The line under the name: a video ad's length and skip rule ("0:30 long ·
 * Can't skip"), a corner picture's size and the site a tap opens ("480 ×
 * 160 px · opens example.com"), or what is still missing.
 */
export function adMetaLine(t: TranslationShape, ad: Ad): string {
  const m = t.adsUi.list.meta;
  if (!adHasMedia(ad)) return ad.format === "CORNER" ? m.noPicture : m.noVideo;
  if (ad.format === "CORNER") {
    const host = linkHost(ad.linkUrl);
    return [
      ad.imageWidth !== null && ad.imageHeight !== null ? m.pictureSize(ad.imageWidth, ad.imageHeight) : null,
      host ? m.opens(host) : null,
    ]
      .filter((part): part is string => part !== null)
      .join(" · ");
  }
  const skip = ad.isSkippable && ad.skipAfterSeconds !== null ? m.canSkipAfter(ad.skipAfterSeconds) : m.cantSkip;
  return `${m.videoLength(formatAdDuration(ad.durationSeconds))} · ${skip}`;
}

/**
 * Where it shows: a video ad's places ("Before the movie and at ad
 * breaks"), or a corner picture's timing ("In the corner · 10 sec on screen
 * · back every 15 min"; one that stays until closed shows once).
 */
export function adWhereText(t: TranslationShape, ad: Ad): string {
  if (ad.format === "VIDEO") return slotsText(t, ad);
  const w = t.adsUi.list.where;
  if (ad.cornerShowSeconds === null) return `${w.inCorner} · ${w.untilClosed}`;
  const back = ad.cornerRepeatMinutes === null ? w.once : w.backEvery(movieTimeText(t, ad.cornerRepeatMinutes * 60));
  return `${w.inCorner} · ${w.staysSeconds(ad.cornerShowSeconds)} · ${back}`;
}

/**
 * When it shows: its dates ("10 Nov 2026 – 30 Nov 2026", "From 1 Nov
 * 2026"), then its hours of the day ("Every day 18:00–23:00"). "Any day"
 * only when it has neither — with hours alone, the hours say it all.
 */
export function adWhenLines(t: TranslationShape, ad: Ad): string[] {
  const w = t.adsUi.list.when;
  const from = ad.startsAt ? formatMmtDate(ad.startsAt) : null;
  const to = ad.endsAt ? formatMmtDate(ad.endsAt) : null;
  const dates = from && to ? w.range(from, to) : from ? w.from(from) : to ? w.until(to) : null;
  const hours =
    ad.dailyStartTime && ad.dailyEndTime
      ? isOvernight(ad.dailyStartTime, ad.dailyEndTime)
        ? w.everyNight(ad.dailyStartTime, ad.dailyEndTime)
        : w.everyDay(ad.dailyStartTime, ad.dailyEndTime)
      : null;
  const lines = [dates, hours].filter((line): line is string => line !== null);
  return lines.length > 0 ? lines : [w.anyDay];
}

/**
 * The all-time results in words: "Played 1,204 times" + "58% watched to
 * the end"; a corner picture's viewings and showings + its taps. For a
 * chosen period the Ad results page has the same counts.
 */
export function adResultLines(t: TranslationShape, ad: Ad): string[] {
  const r = t.adsUi.list.results;
  const { impressions, completions, shows, clicks } = ad.counters;
  if (ad.format === "CORNER") {
    if (impressions === 0) return [r.notShown];
    return [r.cornerSeen(impressions, count(impressions), shows, count(shows)), r.taps(clicks, count(clicks))];
  }
  if (impressions === 0) return [r.notPlayed];
  return [r.played(impressions, count(impressions)), r.watched(`${Math.round((completions / impressions) * 100)}%`)];
}

/**
 * The rarely used settings, only when they are set (there is no Priority
 * column any more): "Goes first: 5", the daily limit, the wait.
 */
export function adLimitChips(t: TranslationShape, ad: Ad): string[] {
  const c = t.adsUi.list.chips;
  return [
    ad.priority > 0 ? c.goesFirst(ad.priority) : null,
    ad.maxImpressionsPerUserPerDay !== null ? c.perDay[ad.format](ad.maxImpressionsPerUserPerDay) : null,
    ad.frequencyLimitMinutes !== null ? c.wait(movieTimeText(t, ad.frequencyLimitMinutes * 60)) : null,
  ].filter((chip): chip is string => chip !== null);
}

/** A small look at the ad: the corner picture itself (a GIF animates here too), or a film icon for a video ad. */
export function AdThumb({ ad, className }: { ad: Ad; className?: string }) {
  const { t } = useLanguage();
  const box = cn(
    "relative flex h-[34px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-strong)]",
    className,
  );
  if (ad.format === "CORNER" && ad.imageUrl) {
    return (
      <span className={cn(box, "bg-black")}>
        <Image
          src={ad.imageUrl}
          alt={t.adsUi.list.thumbnailAlt(ad.title)}
          fill
          sizes="56px"
          unoptimized
          loading="lazy"
          className="object-contain"
        />
      </span>
    );
  }
  const Icon = FORMAT_ICONS[ad.format];
  return (
    <span className={cn(box, "bg-secondary/60 text-muted-foreground")} aria-hidden>
      <Icon className="size-4" />
    </span>
  );
}

/** Small rounded chips ("Goes first: 5", "At most 3 a day per viewer"). */
export function AdChips({ chips, className }: { chips: readonly string[]; className?: string }) {
  if (chips.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-[var(--border-strong)] bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

/** The Ad column: thumbnail, name, type chip, the line under it, and the private note when there is one. */
export function AdIdentityCell({ ad }: { ad: Ad }) {
  const { t } = useLanguage();
  const media = adHasMedia(ad);
  return (
    <div className="flex max-w-80 min-w-56 items-start gap-3 whitespace-normal">
      <AdThumb ad={ad} className="mt-0.5" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold break-words">{ad.title}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <AdFormatBadge format={ad.format} t={t} />
          <span className={cn("text-xs", media ? "text-muted-foreground" : "text-warning")}>{adMetaLine(t, ad)}</span>
        </div>
        {ad.description && (
          <span className="truncate text-xs text-muted-foreground/80" title={ad.description}>
            {ad.description}
          </span>
        )}
      </div>
    </div>
  );
}

interface AdActiveSwitchProps {
  ad: Ad;
  /** ADS.MANAGE — without it the state is shown in words, with no switch. */
  canManage: boolean;
  /** This ad's switch is being saved, so a second tap waits. */
  busy: boolean;
  onToggle: (ad: Ad, isActive: boolean) => void;
  className?: string;
}

/**
 * "Show to viewers · On/Off" — the switch says what it does. The backend
 * refuses to turn an ad on without its video (or a corner picture's
 * picture), so until then the switch is greyed and says why, in words.
 */
export function AdActiveSwitch({ ad, canManage, busy, onToggle, className }: AdActiveSwitchProps) {
  const { t } = useLanguage();
  const s = t.adsUi.shared;
  const status = t.adsUi.status;
  const media = adHasMedia(ad);
  const state = <span className="text-foreground">{ad.isActive ? s.on : s.off}</span>;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {canManage ? (
        <label
          className={cn(
            "flex w-fit items-center gap-2 text-xs text-muted-foreground",
            media && !busy ? "cursor-pointer" : "cursor-not-allowed",
          )}
        >
          <Switch
            checked={ad.isActive}
            disabled={busy || !media}
            onCheckedChange={(checked) => onToggle(ad, checked)}
            aria-label={status.switchFor(ad.title)}
          />
          <span aria-hidden>
            {s.showToViewers} · {state}
          </span>
        </label>
      ) : (
        <span className="text-xs text-muted-foreground">
          {s.showToViewers} · {state}
        </span>
      )}
      {canManage && !media && (
        <span className="text-xs text-warning">
          {ad.format === "CORNER" ? status.needsPictureFirst : status.needsVideoFirst}
        </span>
      )}
    </div>
  );
}

/** The "Where and when" column, with the chips for the settings that are set. */
export function AdWhereWhenCell({ ad }: { ad: Ad }) {
  const { t } = useLanguage();
  return (
    <div className="flex max-w-64 min-w-44 flex-col gap-1 text-[13px] leading-snug whitespace-normal">
      <span>{adWhereText(t, ad)}</span>
      {adWhenLines(t, ad).map((line) => (
        <span key={line} className="text-muted-foreground">
          {line}
        </span>
      ))}
      <AdChips chips={adLimitChips(t, ad)} className="mt-0.5" />
    </div>
  );
}

/** "All movies and episodes" / "12 chosen movies", and a warning for chosen movies viewers can't open. */
export function AdMoviesCell({ ad, className }: { ad: Ad; className?: string }) {
  const { t } = useLanguage();
  const m = t.adsUi.list.movies;
  const missing = ad.targetMovies.filter((movie) => movie.missing).length;
  const hidden = ad.targetMovies.filter((movie) => !movie.missing && !movie.isVisible).length;
  return (
    <div className={cn("flex max-w-52 min-w-32 flex-col gap-1 text-[13px] whitespace-normal", className)}>
      <span>{moviesText(t, ad)}</span>
      {missing > 0 && (
        <span className="flex items-start gap-1 text-xs text-destructive">
          <AlertTriangle className="mt-px size-3 shrink-0" />
          {m.missing(missing)}
        </span>
      )}
      {hidden > 0 && (
        <span className="flex items-start gap-1 text-xs text-warning">
          <AlertTriangle className="mt-px size-3 shrink-0" />
          {m.hidden(hidden)}
        </span>
      )}
    </div>
  );
}

/** The Results column: the first line in full colour, the second muted. */
export function AdResultsCell({ ad }: { ad: Ad }) {
  const { t } = useLanguage();
  const [first, second] = adResultLines(t, ad);
  return (
    <div className="flex max-w-56 min-w-36 flex-col gap-0.5 text-[13px] leading-snug tabular-nums whitespace-normal">
      <span>{first}</span>
      {second && <span className="text-muted-foreground">{second}</span>}
    </div>
  );
}

interface AdRowActionsProps {
  ad: Ad;
  canManage: boolean;
  onWillItShow: (ad: Ad) => void;
  onPreview: (ad: Ad) => void;
  onEdit: (ad: Ad) => void;
  onDelete: (ad: Ad) => void;
}

/**
 * The row's actions: "Will it show?" in words (the question the owner
 * actually has), then Preview (ADS.VIEW; nothing to preview without the
 * video or picture), Edit and Delete (ADS.MANAGE).
 */
export function AdRowActions({ ad, canManage, onWillItShow, onPreview, onEdit, onDelete }: AdRowActionsProps) {
  const { t } = useLanguage();
  const s = t.adsUi.shared;
  const a = t.adsUi.list.actions;
  const media = adHasMedia(ad);
  return (
    <RowActions className="gap-1">
      <Button variant="outline" size="sm" onClick={() => onWillItShow(ad)}>
        {s.willItShow}
      </Button>
      <RowActionButton
        icon={Eye}
        label={media ? s.preview : ad.format === "CORNER" ? a.previewNoPicture : a.previewNoVideo}
        disabled={!media}
        onClick={() => onPreview(ad)}
      />
      {canManage && <RowActionButton icon={Pencil} label={s.edit} onClick={() => onEdit(ad)} />}
      {canManage && <RowActionButton icon={Trash2} label={s.delete} destructive onClick={() => onDelete(ad)} />}
    </RowActions>
  );
}
