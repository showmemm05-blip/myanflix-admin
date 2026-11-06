"use client";

import type { ComponentProps } from "react";
import { ArrowLeft, Check, CircleCheck, CircleX, Info, Lightbulb, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatAdDuration } from "@/components/ads/adForm";
import {
  TEST_MOVIE_EXTRA_MINUTES,
  diagnoseAd,
  type AdCheck,
  type AdFix,
  type AdNote,
  type AdNoteCode,
  type AdTestPlan,
} from "@/components/ads/adHealth";
import { movieTimeText } from "@/components/ads/adWords";
import { useLanguage } from "@/lib/context/language-context";
import type { TranslationShape } from "@/lib/i18n/translations";
import { formatMmt } from "@/lib/myanmar-time";
import { cn } from "@/lib/utils";
import type { Ad, AdSettings } from "@/types/ad";

/** "12,345" — the admin's en-US grouping everywhere, in both languages. */
const count = (value: number) => value.toLocaleString("en-US");

/** Minutes (as adHealth.ts gives them) in the page's words: "30 min", "1 h". */
const minutesText = (t: TranslationShape, minutes: number) => movieTimeText(t, minutes * 60);

/** One ✓ / ✗ line of "Your settings". */
function checkText(t: TranslationShape, check: AdCheck): string {
  const c = t.adsUi.why.checks;
  switch (check.code) {
    case "ALL_ADS":
      return check.ok ? c.ALL_ADS.ok : c.ALL_ADS.bad;
    case "AD_SWITCH":
      return check.ok ? c.AD_SWITCH.ok : c.AD_SWITCH.bad;
    case "MEDIA": {
      const p = check.params;
      if (p.format === "CORNER") {
        const size =
          p.imageWidth !== null && p.imageHeight !== null
            ? t.adsUi.list.meta.pictureSize(p.imageWidth, p.imageHeight)
            : null;
        return check.ok ? c.MEDIA.pictureOk(size) : c.MEDIA.pictureBad;
      }
      return check.ok ? c.MEDIA.videoOk(formatAdDuration(p.durationSeconds)) : c.MEDIA.videoBad;
    }
    case "START": {
      const { startsAt } = check.params;
      if (startsAt === null) return c.START.none;
      return check.ok ? c.START.started(formatMmt(startsAt)) : c.START.later(formatMmt(startsAt));
    }
    case "END": {
      const { endsAt } = check.params;
      if (endsAt === null) return c.END.none;
      return check.ok ? c.END.ends(formatMmt(endsAt)) : c.END.ended(formatMmt(endsAt));
    }
    case "MOVIES_OK": {
      const { count: movies, missing, hidden } = check.params;
      return check.ok ? c.MOVIES_OK.ok(movies - missing - hidden) : c.MOVIES_OK.bad(movies);
    }
    case "HOURS": {
      const { start, end, overnight, now } = check.params;
      if (start === null || end === null) return c.HOURS.any;
      const line = check.ok ? c.HOURS.inside(start, end, now) : c.HOURS.outside(start, end, now);
      return overnight ? `${line} ${c.HOURS.overnight}` : line;
    }
    case "BREAKS": {
      const { playsBeforeMovie, playsAtBreaks, intervalMinutes } = check.params;
      if (!check.ok) return c.BREAKS.blocked;
      if (!playsAtBreaks) return c.BREAKS.before;
      if (intervalMinutes === 0) return c.BREAKS.bothBreaksOff;
      const every = minutesText(t, intervalMinutes);
      return playsBeforeMovie ? c.BREAKS.both(every) : c.BREAKS.breaks(every);
    }
  }
}

/** The words on a fix button, which depend on the line it fixes ("Change hours" vs "Change dates"). */
function fixLabel(t: TranslationShape, check: AdCheck, fix: AdFix, ad: Ad): string {
  const f = t.adsUi.why.fixes;
  switch (fix.kind) {
    case "OPEN_SETTINGS":
      return f.openSettings;
    case "TURN_ON":
      return f.turnOn;
    case "ALSO_BEFORE_MOVIE":
      return f.alsoBefore;
    case "EDIT":
      if (check.code === "MEDIA") return ad.format === "CORNER" ? f.addPicture : f.addVideo;
      if (check.code === "HOURS") return f.changeHours;
      if (check.code === "MOVIES_OK") return f.changeMovies;
      if (check.code === "START" || check.code === "END") return f.changeDates;
      return f.changePart;
  }
}

/** One note, said about viewers in general. */
function noteText(t: TranslationShape, note: AdNote): string {
  const n = t.adsUi.why.notes;
  switch (note.code) {
    case "MOVIES": {
      const { count: movies, missing, hidden } = note.params;
      return [n.MOVIES(movies), missing > 0 ? n.moviesMissing(missing) : null, hidden > 0 ? n.moviesHidden(hidden) : null]
        .filter((part): part is string => part !== null)
        .join(" ");
    }
    case "AUDIENCE":
      if (note.params.format === "CORNER") return n.AUDIENCE.corner;
      return note.params.playsBeforeMovie ? n.AUDIENCE.breaksAndBefore : n.AUDIENCE.breaksOnly;
    case "WAIT":
      return n.WAIT(minutesText(t, note.params.minutes));
    case "PER_DAY":
      return n.PER_DAY[note.params.format](note.params.times);
    case "SHARING": {
      const { slots, priority } = note.params;
      return [...slots.map(({ slot, others }) => n.SHARING[slot](others)), priority > 0 ? n.SHARING.goesFirst(priority) : n.SHARING.turns].join(" ");
    }
    case "BREAK_MEMORY":
      return n.BREAK_MEMORY(note.params.hours);
    case "LAST_MINUTES": {
      const { guardMinutes, intervalMinutes, minMovieMinutes } = note.params;
      const guard = minutesText(t, guardMinutes);
      if (intervalMinutes === null || minMovieMinutes === null) return n.LAST_MINUTES.base(guard);
      return n.LAST_MINUTES.withInterval(guard, minutesText(t, minMovieMinutes), minutesText(t, intervalMinutes));
    }
    case "JUMP":
      return n.JUMP;
    case "CORNER_FIRST":
      return n.CORNER_FIRST(minutesText(t, note.params.afterMinutes), minutesText(t, note.params.neverUpToMinutes));
    case "CORNER_HIDES":
      return n.CORNER_HIDES(minutesText(t, note.params.guardMinutes));
    case "CORNER_CLOSE":
      return n.CORNER_CLOSE;
    case "NEXT_OPEN":
      return n.NEXT_OPEN;
  }
}

/** The same rule said to the owner who tested it himself; null for a note that is never the likely reason. */
function likelyText(t: TranslationShape, note: AdNote): string | null {
  const l = t.adsUi.why.likely;
  switch (note.code) {
    case "BREAK_MEMORY":
      return l.BREAK_MEMORY(note.params.hours);
    case "PER_DAY":
      return l.PER_DAY[note.params.format](note.params.times);
    case "WAIT":
      return l.WAIT(minutesText(t, note.params.minutes));
    case "AUDIENCE":
      return l.AUDIENCE;
    case "SHARING":
      return l.SHARING;
    case "CORNER_FIRST":
      return l.CORNER_FIRST(minutesText(t, note.params.afterMinutes), minutesText(t, note.params.neverUpToMinutes));
    default:
      return null;
  }
}

/** "How to test it yourself", one whole sentence per step. */
function testSentences(t: TranslationShape, test: AdTestPlan): string[] {
  const x = t.adsUi.why.test;
  const steps: string[] = [];
  if (test.fixFirst > 0) steps.push(x.fixFirst(test.fixFirst));
  if (test.needsNonPremium) steps.push(x.nonPremium);
  if (test.anyMovie) {
    steps.push(test.chosenMovies !== null ? x.anyChosen(test.chosenMovies) : x.anyMovie);
  } else {
    // No number while the break interval is unknown: the sentence names the rule.
    const longer =
      test.movieLongerThanMinutes === null
        ? x.intervalPlus(minutesText(t, TEST_MOVIE_EXTRA_MINUTES))
        : minutesText(t, test.movieLongerThanMinutes);
    steps.push(
      test.chosenMovies !== null
        ? x.chosenMovie(test.chosenMovies, longer, test.notWatchedWithinHours)
        : x.movie(longer, test.notWatchedWithinHours),
    );
  }
  if (test.hours) steps.push(x.hours(test.hours.start, test.hours.end));
  if (test.noSkipping) steps.push(x.noSkipping);
  return steps;
}

interface WhyNotPlayingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The ad as the page last saw it — a fix that saves (the switch, "Also play before the movie") updates it here. */
  ad: Ad;
  /** The Ad settings; null while they load (the two settings checks are left out). */
  settings: AdSettings | null;
  /** The page's clock. */
  now: number;
  /** ADS.MANAGE — the fixes that change something and "Edit ad". "Open Ad settings" only shows them. */
  canManage: boolean;
  /** A fix for this ad is being saved. */
  busy: boolean;
  onFix: (ad: Ad, fix: AdFix) => void;
  onEdit: (ad: Ad) => void;
  /** Where focus goes on close — the page sends it to the Ad settings card after "Open Ad settings". */
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
}

/**
 * "Will it show?" (2026-11-04, the `WillYes` / `WillNo` boards; full screen
 * on phones per `PhoneWill`): why an ad is or is not reaching viewers, from
 * adHealth.ts `diagnoseAd`. The verdict first; then "Your settings" as ✓/✗
 * lines, each ✗ with the button that fixes it (open Ad settings, turn the
 * ad on, open the wizard at the right step, also play before the movie) and
 * the ad's own choices as notes; then the rules that depend on the viewer
 * and the movie, with the likeliest one singled out when the ad CAN show
 * (the owner's case: it had played, but each break plays once per viewer
 * per movie for 12 hours); then how to test it yourself.
 */
export function WhyNotPlaying({
  open,
  onOpenChange,
  ad,
  settings,
  now,
  canManage,
  busy,
  onFix,
  onEdit,
  finalFocus,
}: WhyNotPlayingProps) {
  const { t } = useLanguage();
  const w = t.adsUi.why;
  const s = t.adsUi.shared;
  const diagnosis = diagnoseAd(ad, settings, now);
  const { verdict } = diagnosis;

  // The likely reason is singled out only when nothing on our side stops
  // the ad — and then it leaves the lists below, so it is said once.
  const likelyNote =
    verdict === "CAN_SHOW" && diagnosis.likelyReason
      ? [...diagnosis.infoNotes, ...diagnosis.viewerNotes].find((note) => note.code === diagnosis.likelyReason)
      : undefined;
  const likely = likelyNote ? likelyText(t, likelyNote) : null;
  const skip: AdNoteCode | null = likely ? (likelyNote?.code ?? null) : null;
  const infoNotes = diagnosis.infoNotes.filter((note) => note.code !== skip);
  const viewerNotes = diagnosis.viewerNotes.filter((note) => note.code !== skip);

  const played =
    diagnosis.played > 0 ? w.played[ad.format](diagnosis.played, count(diagnosis.played)) : w.notPlayed[ad.format];
  const verdictLines = [
    played,
    verdict === "CAN_SHOW" ? w.hint : verdict === "UNKNOWN" ? w.unknownHint : null,
  ].filter((line): line is string => line !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        finalFocus={finalFocus}
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl",
          // Phones: the whole screen, a back arrow at the top and the buttons at the bottom (`PhoneWill`).
          "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
        )}
      >
        <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
          <DialogClose
            render={<Button variant="ghost" size="icon-sm" className="sm:hidden" aria-label={w.back} />}
          >
            <ArrowLeft className="size-4" />
          </DialogClose>
          <DialogTitle className="min-w-0 flex-1 text-base leading-snug font-semibold break-words">
            {w.title(ad.title)}
          </DialogTitle>
          <DialogClose
            render={<Button variant="ghost" size="icon-sm" className="max-sm:hidden" aria-label={s.close} />}
          >
            <X className="size-4" />
          </DialogClose>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-5">
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              verdict === "CAN_SHOW" && "border-success/25 bg-success/10",
              verdict === "NOT_NOW" && "border-destructive/25 bg-destructive/10",
              verdict === "UNKNOWN" && "border-[var(--border-strong)] bg-secondary/40",
            )}
          >
            {verdict === "CAN_SHOW" ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            ) : verdict === "NOT_NOW" ? (
              <CircleX className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            ) : (
              <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <div className="flex flex-col gap-1">
              <p className="font-semibold">
                {verdict === "NOT_NOW" ? w.verdict.NOT_NOW(diagnosis.problems) : w.verdict[verdict]}
              </p>
              {verdictLines.map((line) => (
                <p key={line} className="text-sm leading-relaxed text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <section aria-labelledby="why-settings" className="flex flex-col gap-2">
            <h3 id="why-settings" className="text-sm font-semibold">
              {w.yourSettings}
            </h3>
            <ul className="flex flex-col gap-2">
              {diagnosis.checks.map((check) => {
                const fixes = check.fixes.filter((fix) => canManage || fix.kind === "OPEN_SETTINGS");
                return (
                  <li
                    key={check.code}
                    className={cn(
                      "flex flex-col gap-2 text-sm leading-relaxed",
                      !check.ok && "rounded-lg border border-destructive/25 bg-destructive/10 p-3",
                    )}
                  >
                    {/* The sentence itself says yes or no ("This ad is turned off."), so the mark is decoration. */}
                    <div className="flex items-start gap-2">
                      {check.ok ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      ) : (
                        <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                      )}
                      <span>{checkText(t, check)}</span>
                    </div>
                    {fixes.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-6">
                        {fixes.map((fix) => (
                          <Button
                            key={fix.kind}
                            variant="outline"
                            size="sm"
                            disabled={busy && fix.kind !== "OPEN_SETTINGS" && fix.kind !== "EDIT"}
                            onClick={() => onFix(ad, fix)}
                          >
                            {busy && (fix.kind === "TURN_ON" || fix.kind === "ALSO_BEFORE_MOVIE") && (
                              <Loader2 className="size-3.5 animate-spin" />
                            )}
                            {fixLabel(t, check, fix, ad)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
              {infoNotes.map((note) => (
                <li key={note.code} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                  <span>{noteText(t, note)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="why-viewer" className="flex flex-col gap-2">
            <h3 id="why-viewer" className="text-sm font-semibold">
              {w.viewerHeading}
            </h3>
            {likely && (
              <div className="flex items-start gap-2 rounded-lg border border-info/25 bg-info/10 p-3 text-sm leading-relaxed">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold">{w.likelyHeading}</p>
                  <p>{likely}</p>
                </div>
              </div>
            )}
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              {viewerNotes.map((note) => (
                <li key={note.code}>{noteText(t, note)}</li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="why-test"
            className="flex flex-col gap-1.5 rounded-lg border border-[var(--border-strong)] bg-secondary/30 p-3"
          >
            <h3 id="why-test" className="text-sm font-semibold">
              {w.testHeading}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{testSentences(t, diagnosis.test).join(" ")}</p>
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t bg-muted/40 px-4 py-3 sm:px-5">
          <DialogClose render={<Button variant="outline" />}>{s.close}</DialogClose>
          {canManage && <Button onClick={() => onEdit(ad)}>{s.editAd}</Button>}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
