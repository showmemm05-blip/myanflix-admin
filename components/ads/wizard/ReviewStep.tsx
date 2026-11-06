"use client";

import { Info } from "lucide-react";
import {
  formatAdDuration,
  hasMedia,
  issueText,
  reviewSummary,
  type AdIssue,
  type AdIssueCode,
  type AdReviewSummary,
} from "@/components/ads/adForm";
import { stepOfIssue, type AdStepId, type AdWizardMode } from "@/components/ads/adSteps";
import { formatLabel, slotsText } from "@/components/ads/adWords";
import { fill, fillBold } from "@/components/ads/wizard/fill";
import { MORE_OPTIONS_ISSUES } from "@/components/ads/wizard/MoreOptions";
import { OptionCards } from "@/components/ads/wizard/OptionCards";
import { SettingsLink } from "@/components/ads/wizard/SettingsLink";
import type { StepProps } from "@/components/ads/wizard/stepProps";
import { Button } from "@/components/ui/button";
import type { TranslationShape } from "@/lib/i18n/translations";
import { useLanguage } from "@/lib/context/language-context";
import { useNow } from "@/lib/hooks/use-now";
import { formatMmt } from "@/lib/myanmar-time";
import { CORNER_FIRST_SHOW_AFTER_SECONDS, type AdSettings } from "@/types/ad";

/** How many chosen movies the Movies row names before "+N more". */
const NAMED_MOVIES = 3;

/** "a 30-second" video, "an 8-second" video, "a 2-minute" video, "a 1 min 30 s" video. */
function videoLengthWords(t: TranslationShape, seconds: number): string {
  const words = t.adsUi.wizard.review.videoLength;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return words.seconds(rest);
  return rest === 0 ? words.minutes(minutes) : words.minutesSeconds(minutes, rest);
}

/** The corner picture's timing as one sentence (the same words as its step). */
function cornerTimeline(t: TranslationShape, summary: AdReviewSummary) {
  const l = t.adsUi.wizard.look;
  const first = l.minutes(CORNER_FIRST_SHOW_AFTER_SECONDS / 60);
  const { showSeconds, repeatMinutes } = summary.timing;
  const number = (value: number, unit: (n: number) => string) => (Number.isFinite(value) ? unit(value) : "…");
  if (showSeconds === null) return fillBold(l.timeline.untilClosed, { first });
  const stay = number(showSeconds, l.seconds);
  if (repeatMinutes === null) return fillBold(l.timeline.once, { first, stay });
  return fillBold(l.timeline.repeat, { first, stay, every: number(repeatMinutes, l.minutes) });
}

export interface ReviewStepProps extends StepProps {
  mode: AdWizardMode;
  settings: AdSettings | null;
  /** Every problem the form has now — shown under the row it belongs to. */
  issues: readonly AdIssue[];
  /** "Choose the start date…" — the wizard's own date checks, shown under When. */
  dateProblems: readonly string[];
  /** Opens a step ("Change" / "Fix" on a row). */
  onGoTo: (step: AdStepId) => void;
  /** Opens the When step with "More options" open, in view (that row's "Change" / "Fix"). */
  onGoToMore: () => void;
  /** "Turn it on now?" was answered (so arriving here again does not answer it for the admin). */
  onActiveChosen: (active: boolean) => void;
  /** Leaves the wizard for the Ad settings card (the notes' link). */
  onOpenSettings?: () => void;
}

interface Row {
  key: string;
  label: string;
  value: string;
  step: AdStepId;
  problems: string[];
}

/**
 * The last step (the `Wiz6Check` and `EditMode` boards): the whole ad in a
 * few plain sentences, a row per part with "Change" (or "Fix" in red when
 * that part holds a problem), and — when creating — "Turn it on now?",
 * which starts on Yes when the ad has its video or picture. Notes say when
 * the Ad settings would keep it from viewers anyway.
 */
export function ReviewStep({
  state,
  existing,
  disabled,
  marked,
  mode,
  settings,
  issues,
  dateProblems,
  onGoTo,
  onGoToMore,
  onActiveChosen,
  onOpenSettings,
}: ReviewStepProps) {
  const { t } = useLanguage();
  const r = t.adsUi.wizard.review;
  const v = r.values;
  const nowMs = useNow();
  const summary = reviewSummary(state, existing);
  const corner = summary.format === "CORNER";
  const edit = mode === "edit";

  const isPast = (iso: string) => new Date(iso).getTime() <= nowMs;
  const name = `“${summary.title}”`;
  const lengthText = summary.durationSeconds === null ? null : formatAdDuration(summary.durationSeconds);
  const sentenceSlots = !summary.playsBeforeMovie
    ? r.slots.breaks
    : summary.playsAtBreaks
      ? r.slots.both
      : r.slots.before;
  const moviesPhrase =
    summary.targetType === "ALL" ? r.movies.all : r.movies.chosen(summary.movieTitles.length);

  // ---------------------------------------------------------- the sentences
  const sentences = [
    corner
      ? fillBold(r.sentences.cornerIs, { name })
      : summary.media.source === "none"
        ? fillBold(r.sentences.videoNone, { name })
        : summary.durationSeconds === null
          ? fillBold(r.sentences.videoNoLength, { name })
          : fillBold(r.sentences.videoIs, { name, length: videoLengthWords(t, summary.durationSeconds) }),
    corner
      ? fillBold(r.sentences.cornerShows, { movies: moviesPhrase })
      : fillBold(r.sentences.videoPlays, { where: sentenceSlots, movies: moviesPhrase }),
    corner ? cornerTimeline(t, summary) : null,
    summary.daily ? fillBold(r.sentences.hours, { from: summary.daily.start, to: summary.daily.end }) : null,
    (() => {
      const { startsAt, endsAt } = summary;
      if (!startsAt) {
        if (!endsAt) return r.sentences.noEnd;
        return fillBold(isPast(endsAt) ? r.sentences.endedOn : r.sentences.endsOn, { end: formatMmt(endsAt) });
      }
      const started = isPast(startsAt);
      if (!endsAt) {
        return fillBold(started ? r.sentences.startedNoEnd : r.sentences.startsNoEnd, { start: formatMmt(startsAt) });
      }
      if (isPast(endsAt)) return fillBold(r.sentences.endedOn, { end: formatMmt(endsAt) });
      return fillBold(started ? r.sentences.startedEnds : r.sentences.startsEnds, {
        start: formatMmt(startsAt),
        end: formatMmt(endsAt),
      });
    })(),
    corner
      ? summary.linkHost
        ? fillBold(r.sentences.link, { host: summary.linkHost })
        : r.sentences.noLink
      : summary.skipAfterSeconds !== null
        ? fillBold(r.sentences.skip(summary.skipAfterSeconds), { n: summary.skipAfterSeconds })
        : r.sentences.noSkip,
    edit ? (summary.isActive ? r.sentences.turnedOn : r.sentences.turnedOff) : null,
  ];

  // --------------------------------------------------------------- the rows
  const problemsOf = (step: AdStepId, keep: (code: AdIssueCode) => boolean = () => true) =>
    issues.filter((issue) => stepOfIssue(issue.code) === step && keep(issue.code)).map((issue) => issueText(t, issue));
  const isLink = (code: AdIssueCode) => code === "LINK_INVALID" || code === "LINK_TOO_LONG";
  const isMore = (code: AdIssueCode) => MORE_OPTIONS_ISSUES.includes(code);

  const mediaValue = (() => {
    const { media } = summary;
    if (media.source === "none") return corner ? v.noPicture : v.noVideo;
    const label = media.source === "picked" ? media.fileName : corner ? v.currentPicture : v.currentVideo;
    const detail = corner
      ? summary.pictureSize && t.adsUi.wizard.picture.size(summary.pictureSize.width, summary.pictureSize.height)
      : lengthText && v.videoLong(lengthText);
    return detail ? v.picked(label, detail) : label;
  })();

  const timingValue = (() => {
    const { showSeconds, repeatMinutes } = summary.timing;
    const typed = (value: number) => (Number.isFinite(value) ? String(value) : "…");
    const parts =
      showSeconds === null
        ? [v.staysUntilClosed]
        : [v.stays(typed(showSeconds)), repeatMinutes === null ? v.once : v.comesBack(typed(repeatMinutes))];
    return [...parts, summary.closable ? v.closable : v.notClosable].join(" · ");
  })();

  const moviesValue = (() => {
    if (summary.targetType === "ALL") return t.adsUi.shared.movies.all;
    const titles = summary.movieTitles;
    if (titles.length === 0) return t.adsUi.wizard.picker.noneChosen;
    const named = titles.slice(0, NAMED_MOVIES).map((title) => title ?? v.deletedMovie);
    const more = titles.length - named.length;
    return v.chosenList(titles.length, [...named, ...(more > 0 ? [v.moreNames(more)] : [])].join(v.listSeparator));
  })();

  const whenValue = (() => {
    const { startsAt, endsAt } = summary;
    if (!startsAt) return endsAt ? v.fromNowUntil(formatMmt(endsAt)) : v.fromNowNoEnd;
    const start = formatMmt(startsAt);
    if (isPast(startsAt)) return endsAt ? v.startedUntil(start, formatMmt(endsAt)) : v.startedNoEnd(start);
    return endsAt ? v.fromUntil(start, formatMmt(endsAt)) : v.fromNoEnd(start);
  })();

  const moreValue =
    [
      summary.daily && v.hours(summary.daily.start, summary.daily.end),
      summary.waitMinutes !== null && v.wait(summary.waitMinutes),
      summary.perDay !== null && v.perDay[summary.format](summary.perDay),
      summary.priority > 0 && v.priority(summary.priority),
    ]
      .filter((part): part is string => typeof part === "string")
      .join(" · ") || v.none;

  const rows: Row[] = [
    // Editing has no type step: the type can't change after the create.
    ...(edit
      ? []
      : [{ key: "type", label: r.rows.type, value: formatLabel(t, summary.format), step: "type" as const, problems: [] }]),
    {
      key: "media",
      label: corner ? r.rows.picture : r.rows.video,
      value: mediaValue,
      step: "media",
      problems: problemsOf("media", (code) => !isLink(code) && code !== "DESCRIPTION_TOO_LONG"),
    },
    ...(corner
      ? [
          {
            key: "link",
            label: r.rows.link,
            value: summary.linkHost ?? v.noLink,
            step: "media" as const,
            problems: problemsOf("media", isLink),
          },
          {
            key: "timing",
            label: r.rows.timing,
            value: timingValue,
            step: "look" as const,
            problems: problemsOf("look"),
          },
        ]
      : [
          {
            key: "where",
            label: r.rows.where,
            value: [
              slotsText(t, summary),
              summary.skipAfterSeconds !== null ? v.skipAfter(summary.skipAfterSeconds) : v.noSkip,
            ]
              .filter(Boolean)
              .join(" · "),
            step: "where" as const,
            problems: problemsOf("where"),
          },
        ]),
    { key: "movies", label: r.rows.movies, value: moviesValue, step: "movies", problems: problemsOf("movies") },
    {
      key: "when",
      label: r.rows.when,
      value: whenValue,
      step: "when",
      problems: [...problemsOf("when", (code) => !isMore(code)), ...dateProblems],
    },
    { key: "more", label: r.rows.more, value: moreValue, step: "when", problems: problemsOf("when", isMore) },
    // The note is staff-only and optional: a row only when there is one.
    ...(summary.note
      ? [
          {
            key: "note",
            label: r.rows.note,
            value: summary.note ?? "",
            step: "media" as const,
            problems: problemsOf("media", (code) => code === "DESCRIPTION_TOO_LONG"),
          },
        ]
      : []),
  ];
  const anyProblem = rows.some((row) => row.problems.length > 0);

  // ------------------------------------------------------------ the notes
  const mediaReady = hasMedia(state, existing);
  const notes = [
    settings && !settings.adsEnabled ? r.adsOffNote : null,
    settings && settings.adsEnabled && !corner && !summary.playsBeforeMovie && settings.midrollIntervalMinutes === 0
      ? t.adsUi.shared.statusSentences.BREAKS_OFF
      : null,
  ].filter((note): note is string => note !== null);

  return (
    <div className="flex flex-col gap-5">
      {edit && <p className="-mt-2 text-[13px] text-muted-foreground">{r.editIntro}</p>}

      <p className="rounded-xl border border-[var(--border-strong)] bg-muted/40 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
        {sentences
          .filter((sentence) => sentence !== null)
          .map((sentence, index) => (
            <span key={index}>
              {index > 0 && " "}
              {sentence}
            </span>
          ))}
      </p>

      <dl className="flex flex-col divide-y divide-border rounded-xl border border-[var(--border-strong)]">
        {rows.map((row) => {
          const problem = row.problems.length > 0;
          return (
            <div key={row.key} className="flex items-start gap-3 px-4 py-3">
              <dt className="w-28 shrink-0 text-[13px] text-muted-foreground sm:w-32">{row.label}</dt>
              <dd className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <span className="break-words">{row.value}</span>
                {row.problems.map((text) => (
                  <span key={text} className="text-xs text-destructive">
                    {text}
                  </span>
                ))}
              </dd>
              <Button
                type="button"
                size="sm"
                variant={problem ? "destructive" : "outline"}
                disabled={disabled}
                onClick={() => (row.key === "more" ? onGoToMore() : onGoTo(row.step))}
                aria-label={`${problem ? r.fix : r.change}: ${row.label}`}
              >
                {problem ? r.fix : r.change}
              </Button>
            </div>
          );
        })}
      </dl>

      {notes.map((note) => (
        <div
          key={note}
          className="flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/10 px-3.5 py-3 text-sm leading-relaxed"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            {note}{" "}
            {fill(t.adsUi.wizard.where.changeInSettings, { settings: <SettingsLink onOpen={onOpenSettings} /> })}
          </p>
        </div>
      ))}

      {!edit && (
        <div className="flex flex-col gap-2.5">
          <b className="text-sm font-semibold">{r.active.label}</b>
          <OptionCards<"YES" | "NO">
            label={r.active.label}
            value={state.isActive ? "YES" : "NO"}
            disabled={disabled}
            invalid={marked.has("VIDEO_REQUIRED") || marked.has("PICTURE_REQUIRED")}
            className="sm:grid-cols-2"
            onChange={(choice) => onActiveChosen(choice === "YES")}
            options={[
              {
                value: "YES",
                title: r.active.yes,
                description: mediaReady
                  ? r.active.yesDescription
                  : corner
                    ? r.active.yesNeedsPicture
                    : r.active.yesNeedsVideo,
              },
              { value: "NO", title: r.active.no, description: r.active.noDescription },
            ]}
          />
        </div>
      )}

      {edit && anyProblem && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-destructive" />
          {r.dotLegend}
        </p>
      )}
    </div>
  );
}
