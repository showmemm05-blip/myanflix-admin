"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, Loader2, RotateCw } from "lucide-react";
import { ActorAvatar } from "@/components/actors/columns";
import { movieTimeText } from "@/components/ads/adWords";
import { mediaTypeName } from "@/components/shared/MediaTypeSelect";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TmdbPoster } from "@/components/tmdb/TmdbResultSummary";
import {
  TMDB_CAST_COLLAPSED_COUNT,
  clearingFields,
  isEmptyValue,
  isLineOn,
  lineHasSwitch,
  lineNote,
  lineOf,
  orderedLines,
  selectedFields,
  type TmdbSwitches,
} from "@/components/tmdb/tmdbReview";
import { tmdbErrorMessage, tmdbFieldLabel, tmdbMatchLabel } from "@/components/tmdb/tmdbWords";
import { AGE_RATING_LABELS, type AgeRating } from "@/lib/constants/movie-options";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import type { TranslationShape } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import { API_ORIGIN } from "@/services/api/apiClient";
import { tmdbService } from "@/services/api/tmdbService";
import type { Movie } from "@/types/movie";
import type { Series } from "@/types/series";
import type {
  TmdbCastAction,
  TmdbField,
  TmdbFillReport,
  TmdbPreview,
  TmdbPreviewLine,
  TmdbPreviewValue,
} from "@/types/tmdb";

/**
 * What an Apply answered: the title as it is stored now, what was really
 * written, and the fields the Apply named (`sent`) — the summary tells a
 * detail that was taken back from one that was only not filled by them.
 */
export type TmdbApplied =
  | { kind: "movie"; movie: Movie; report: TmdbFillReport; sent: TmdbField[] }
  | { kind: "series"; series: Series; report: TmdbFillReport; sent: TmdbField[] };

/** No state read yet: nothing is known to be automatic. One array, so the prop's default never changes identity. */
const NO_AUTO_FIELDS: readonly TmdbField[] = [];

/** The four columns from `sm` up: detail · now · from TMDB · the switch. Below that a line stacks. */
const LINE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 sm:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem]";

const CAST_TAG_TONES: Record<TmdbCastAction, StatusTone> = {
  reuse: "neutral",
  create: "success",
  skip_same_name: "warning",
  skip_no_permission: "warning",
};

/** A stored picture's URL as an <img> can use it: a relative `/storage/…` path is resolved against the API origin, not the admin's own. */
function absoluteImageUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

interface ShownValue {
  text: string;
  /** A picture to show beside the words: ours (`own`) or TMDB's preview (`tmdb`). */
  image: { url: string; from: "own" | "tmdb" } | null;
}

/**
 * One cell of a line in words. `side` is which column: what the title holds
 * now, or what TMDB has. An empty "now" says so in the field's own way
 * ("Empty", "Not set", "None"); an empty TMDB side is a dash — the note
 * under the line explains it.
 */
function shownValue(
  t: TranslationShape,
  kind: "movie" | "series",
  line: TmdbPreviewLine,
  side: "current" | "proposed",
): ShownValue {
  const r = t.tmdb.review;
  const value: TmdbPreviewValue = side === "current" ? line.current : line.proposed;
  const picture = line.field === "poster" || line.field === "cover";

  if (isEmptyValue(value)) {
    if (side === "proposed") return { text: "—", image: null };
    return { text: picture ? r.noPicture : line.field === "ageRating" ? r.notSet : r.empty, image: null };
  }

  if (picture) {
    const fromTmdb = line.field === "poster" ? r.posterFromTmdb : r.bannerFromTmdb;
    const url = typeof value === "string" ? value : "";
    if (side === "proposed") return { text: fromTmdb, image: url ? { url, from: "tmdb" } : null };
    // The stored picture: staff's own once they replaced it, TMDB's while it
    // is still the automatic one (or already this very picture). When TMDB
    // has none to compare with, the preview does not say whose it is.
    const whose =
      line.state === "hand"
        ? r.yourUpload
        : line.state === "auto" || line.state === "same"
          ? fromTmdb
          : tmdbFieldLabel(t, line.field);
    return { text: whose, image: url ? { url: absoluteImageUrl(url), from: "own" } : null };
  }

  if (Array.isArray(value)) return { text: value.join(", "), image: null };
  if (line.field === "duration" && typeof value === "number") {
    return { text: movieTimeText(t, value * 60), image: null };
  }
  if (line.field === "ageRating" && typeof value === "string") {
    return { text: AGE_RATING_LABELS[value as AgeRating] ?? value, image: null };
  }
  if (line.field === "country" && typeof value === "string") {
    const word = mediaTypeName(t, value);
    return { text: kind === "movie" ? r.typeMovie(word) : r.typeSeries(word), image: null };
  }
  return { text: String(value), image: null };
}

function ValueCell({ shown, wide, muted }: { shown: ShownValue; wide: boolean; muted: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", muted && "text-muted-foreground")}>
      {shown.image &&
        (shown.image.from === "tmdb" ? (
          <TmdbPoster url={shown.image.url} className={wide ? "h-9 w-16" : "h-12 w-8"} />
        ) : (
          <span className={cn("relative shrink-0 overflow-hidden rounded-md bg-muted", wide ? "h-9 w-16" : "h-12 w-8")}>
            <Image src={shown.image.url} alt="" fill className="object-cover" sizes="64px" />
          </span>
        ))}
      <span className="min-w-0 [overflow-wrap:anywhere]">{shown.text}</span>
    </span>
  );
}

interface TmdbReviewStepProps {
  /** Which of our titles the details are for. */
  kind: "movie" | "series";
  titleId: string;
  /** The TMDB entry under review. */
  tmdbId: number;
  /** The picked candidate's small poster, when the step came from the list. */
  posterPreviewUrl?: string | null;
  /** After a pick: "The match you picked". A Refill reviews the entry the title already has: "The match in use now". */
  origin: "picked" | "current";
  /**
   * The fields of the title that still hold their automatic value (its TMDB
   * state's `autoFields`). Where TMDB has nothing for one of them, Apply
   * takes the old value back, and the line says so.
   */
  autoFields?: readonly TmdbField[];
  /** Back to the list. */
  onBack: () => void;
  onApplied: (result: TmdbApplied) => void;
  /** An Apply was refused or broke off: the page reloads its form from the server, so nothing half-done is shown. */
  onApplyFailed?: () => void;
  /** True while the Apply request runs: the dialog must not be closed under it. */
  onApplyingChange?: (applying: boolean) => void;
}

/**
 * Step 2, "Review details" (2026-11-06, the `Review` board): the chosen
 * match on top, then one line per detail — what is there now, what TMDB
 * has, and a switch — and a box each for the categories and the cast.
 *
 * How a line starts is the backend's answer, not a guess made here: empty
 * details and details that are still the automatic value are on; anything
 * staff changed by hand is off, with "You changed this. Switch on to replace
 * it."; a detail that is already the same, or that TMDB does not have, is
 * greyed with no switch. Apply sends exactly the lines left on
 * (tmdbReview.ts `selectedFields`), and the server writes exactly those.
 * Beyond them it only takes back what the previous match left in a detail
 * this entry has nothing for; those lines say "Apply removes the old
 * value", and they alone are enough to apply.
 *
 * Loading the review writes nothing and downloads no picture; the pictures
 * and the actors' photos are saved only by Apply ("Saving pictures and
 * cast…", a few seconds).
 */
export function TmdbReviewStep({
  kind,
  titleId,
  tmdbId,
  posterPreviewUrl = null,
  origin,
  autoFields = NO_AUTO_FIELDS,
  onBack,
  onApplied,
  onApplyFailed,
  onApplyingChange,
}: TmdbReviewStepProps) {
  const { t } = useLanguage();
  const r = t.tmdb.review;

  const {
    data: preview,
    isLoading,
    error,
    refetch,
  } = useAsyncData<TmdbPreview>(
    () => (kind === "movie" ? tmdbService.previewMovie(titleId, tmdbId) : tmdbService.previewSeries(titleId, tmdbId)),
    [kind, titleId, tmdbId],
  );

  const [switches, setSwitches] = useState<TmdbSwitches>({});
  const [castExpanded, setCastExpanded] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // A refetch keeps the previous preview in hand; only a preview with no error counts.
  const ready = !isLoading && !error && preview ? preview : null;
  const fields = ready ? selectedFields(ready, switches) : [];
  // Nothing switched on can still be an Apply: the title is linked to this
  // entry and the previous match's leftovers are taken back.
  const nothingToApply = fields.length === 0 && (!ready || clearingFields(ready, autoFields).length === 0);

  const setApplyingEverywhere = (next: boolean) => {
    setApplying(next);
    onApplyingChange?.(next);
  };

  const handleApply = async () => {
    if (!ready || nothingToApply) return;
    setApplyingEverywhere(true);
    setApplyError(null);
    try {
      if (kind === "movie") {
        const { movie, report } = await tmdbService.applyMovie(titleId, tmdbId, fields);
        onApplied({ kind: "movie", movie, report, sent: fields });
      } else {
        const { series, report } = await tmdbService.applySeries(titleId, tmdbId, fields);
        onApplied({ kind: "series", series, report, sent: fields });
      }
    } catch (err) {
      setApplyError(tmdbErrorMessage(err, t));
      onApplyFailed?.();
    } finally {
      setApplyingEverywhere(false);
    }
  };

  const fieldSwitch = (line: TmdbPreviewLine) =>
    lineHasSwitch(line) ? (
      <Switch
        checked={isLineOn(line, switches)}
        disabled={applying}
        aria-label={r.useFromTmdb(tmdbFieldLabel(t, line.field))}
        onCheckedChange={(checked) => setSwitches((previous) => ({ ...previous, [line.field]: checked }))}
      />
    ) : null;

  const noteOf = (line: TmdbPreviewLine) => {
    const note = lineNote(line, autoFields);
    if (!note) return null;
    return (
      <p className={cn("text-[13px]", note === "hand" || note === "clears" ? "text-warning" : "text-muted-foreground")}>
        {r.notes[note]}
      </p>
    );
  };

  // A Refill did not come through the list, so it has no candidate poster:
  // the review's own proposed poster stands in.
  const proposedPoster = ready ? lineOf(ready, "poster")?.proposed : null;
  const matchPoster = posterPreviewUrl ?? (typeof proposedPoster === "string" ? proposedPoster : null);

  const categoriesLine = ready ? lineOf(ready, "categories") : null;
  const castLine = ready ? lineOf(ready, "cast") : null;
  const cast = ready?.cast ?? [];
  const shownCast = castExpanded ? cast : cast.slice(0, TMDB_CAST_COLLAPSED_COUNT);
  const hiddenCast = cast.length - shownCast.length;

  const castTag = (action: TmdbCastAction, hasPhoto: boolean): string => {
    if (action === "reuse") return r.cast.reuse;
    if (action === "create") return hasPhoto ? r.cast.create : r.cast.createNoPhoto;
    return action === "skip_same_name" ? r.cast.skipSameName : r.cast.skipNoPermission;
  };

  return (
    <>
      <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex flex-col gap-2" role="status">
            <span className="sr-only">{r.loading}</span>
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
        ) : error || !ready ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0 translate-y-0.5" aria-hidden />
              {tmdbErrorMessage(error, t)}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={refetch}>
              <RotateCw className="size-3.5" />
              {t.tmdb.actions.retry}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 p-2.5">
              <TmdbPoster url={matchPoster} className="h-[52px] w-9" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold [overflow-wrap:anywhere]">{tmdbMatchLabel(t, ready.match)}</span>
                <span className="text-[13px] text-muted-foreground">
                  {origin === "picked" ? r.pickedMatch : r.currentMatch}
                </span>
              </span>
            </div>

            <div
              aria-hidden
              className="hidden grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-x-2.5 px-3 text-xs text-muted-foreground sm:grid"
            >
              <span>{r.columns.detail}</span>
              <span>{r.columns.now}</span>
              <span>{r.columns.fromTmdb}</span>
              <span>{r.columns.use}</span>
            </div>

            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
              {orderedLines(ready).map((line) => {
                const greyed = !lineHasSwitch(line);
                const wide = line.field === "cover";
                return (
                  <li key={line.field} className="flex flex-col gap-1 bg-secondary/20 px-3 py-2.5">
                    <div className={LINE_GRID}>
                      <span className="col-start-1 row-start-1 font-medium">{tmdbFieldLabel(t, line.field)}</span>
                      <span className="col-span-2 col-start-1 row-start-2 flex min-w-0 items-center gap-1.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                        <span className="shrink-0 text-xs text-muted-foreground sm:sr-only">{r.columns.now}:</span>
                        <ValueCell shown={shownValue(t, kind, line, "current")} wide={wide} muted />
                      </span>
                      <span className="col-span-2 col-start-1 row-start-3 flex min-w-0 items-center gap-1.5 sm:col-span-1 sm:col-start-3 sm:row-start-1">
                        <span className="shrink-0 text-xs text-muted-foreground sm:sr-only">{r.columns.fromTmdb}:</span>
                        <ValueCell shown={shownValue(t, kind, line, "proposed")} wide={wide} muted={greyed} />
                      </span>
                      <span className="col-start-2 row-start-1 flex justify-end sm:col-start-4">{fieldSwitch(line)}</span>
                    </div>
                    {noteOf(line)}
                  </li>
                );
              })}
            </ul>

            {categoriesLine && (
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{tmdbFieldLabel(t, "categories")}</p>
                  {fieldSwitch(categoriesLine)}
                </div>
                {ready.categories.add.length > 0 ? (
                  <p className="[overflow-wrap:anywhere]">
                    {r.categories.willAdd(ready.categories.add.map((category) => category.name).join(", "))}
                  </p>
                ) : (
                  <p className="text-muted-foreground">{r.categories.nothing}</p>
                )}
                {ready.categories.unmatched.length > 0 && (
                  <p className="text-muted-foreground [overflow-wrap:anywhere]">
                    {r.categories.unmatched(ready.categories.unmatched.join(", "))}
                  </p>
                )}
                {noteOf(categoriesLine)}
              </div>
            )}

            {castLine && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{r.cast.title}</p>
                  {fieldSwitch(castLine)}
                </div>
                {cast.length === 0 ? (
                  <p className="text-muted-foreground">{r.cast.none}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {shownCast.map((person) => (
                      <li key={person.tmdbPersonId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <ActorAvatar name={person.name} imageUrl={null} className="size-7" />
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{person.name}</span>
                        <StatusBadge
                          label={castTag(person.action, person.hasPhoto)}
                          tone={CAST_TAG_TONES[person.action]}
                          className="h-auto min-h-[22px] normal-case whitespace-normal"
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {cast.length > TMDB_CAST_COLLAPSED_COUNT && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="h-auto self-start px-0"
                    aria-expanded={castExpanded}
                    onClick={() => setCastExpanded((expanded) => !expanded)}
                  >
                    {castExpanded ? r.cast.showFewer : r.cast.more(hiddenCast)}
                  </Button>
                )}
                {noteOf(castLine)}
              </div>
            )}

            {applyError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertTriangle className="size-4 shrink-0 translate-y-0.5" aria-hidden />
                <span>
                  {r.applyFailed} {applyError}
                </span>
              </p>
            )}
          </>
        )}
      </div>

      <DialogFooter className="sm:items-center sm:justify-between">
        <Button type="button" variant="outline" disabled={applying} onClick={onBack}>
          <ArrowLeft className="size-4" />
          {r.back}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {ready && nothingToApply && !applying && (
            <span className="text-[13px] text-muted-foreground">{r.nothingSelected}</span>
          )}
          {applying && (
            <span className="text-[13px] text-muted-foreground" role="status">
              {r.applying}
            </span>
          )}
          <Button type="button" disabled={!ready || nothingToApply || applying} onClick={handleApply}>
            {applying && <Loader2 className="size-4 animate-spin" />}
            {r.apply}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
