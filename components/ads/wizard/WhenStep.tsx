"use client";

import { useState } from "react";
import { ChoiceChips } from "@/components/ads/ChoiceChips";
import { fillBold } from "@/components/ads/wizard/fill";
import { MoreOptions } from "@/components/ads/wizard/MoreOptions";
import type { StepProps } from "@/components/ads/wizard/stepProps";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/context/language-context";
import { useNow } from "@/lib/hooks/use-now";
import { formatMmtDate, formatMmtTime, fromMmtInputValue } from "@/lib/myanmar-time";

/** The time a date gets until the admin picks one: the start of the day, the end of the day. */
const DEFAULT_START_TIME = "00:00";
const DEFAULT_END_TIME = "23:59";

interface DateTimeInputsProps {
  /** "YYYY-MM-DDTHH:mm" in Myanmar time, or "" while no date is picked. */
  value: string;
  defaultTime: string;
  onChange: (value: string) => void;
  dateLabel: string;
  timeLabel: string;
  disabled: boolean;
  invalid: boolean;
}

/**
 * A date box and a time box for one Myanmar-time instant ("30 Nov 2026 at
 * 23:59"). The form holds the two as one `datetime-local`-shaped value; the
 * time box keeps its own copy, so picking the date second does not reset it —
 * nor does retyping the date, which empties the value for a moment (Backspace
 * on the day).
 *
 * Retyping the time empties that copy instead: a cleared segment makes the
 * box's value "", and only a complete time reaches the form, so the ad's time
 * never jumps to the default under the cursor. With the copy "" too, React
 * leaves the half-typed segments alone; a box left that way gets the stored
 * time back when focus leaves it.
 */
function DateTimeInputs({
  value,
  defaultTime,
  onChange,
  dateLabel,
  timeLabel,
  disabled,
  invalid,
}: DateTimeInputsProps) {
  const { t } = useLanguage();
  const [date, storedTime] = value ? value.split("T") : ["", ""];
  const [draftTime, setDraftTime] = useState(() => storedTime || defaultTime);
  /** The time the value holds, or will hold once a date is picked, even while the box is half typed. */
  const time = storedTime || draftTime || defaultTime;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        value={date}
        disabled={disabled}
        aria-label={dateLabel}
        aria-invalid={invalid || undefined}
        className="w-44 [color-scheme:dark]"
        onChange={(e) => onChange(e.target.value ? `${e.target.value}T${time}` : "")}
      />
      <span className="text-sm text-muted-foreground">{t.adsUi.wizard.when.at}</span>
      <Input
        type="time"
        value={draftTime}
        disabled={disabled}
        aria-label={timeLabel}
        aria-invalid={invalid || undefined}
        className="w-32 [color-scheme:dark]"
        onChange={(e) => {
          setDraftTime(e.target.value);
          if (date && e.target.value) onChange(`${date}T${e.target.value}`);
        }}
        onBlur={() => {
          if (!draftTime) setDraftTime(time);
        }}
      />
    </div>
  );
}

export interface WhenStepProps extends StepProps {
  /** "On a date" is chosen — kept apart from the value, which stays "" until a date is picked. */
  startOnDate: boolean;
  endOnDate: boolean;
  onStartOnDate: (onDate: boolean) => void;
  onEndOnDate: (onDate: boolean) => void;
  /** "On a date" with no date yet, after Next or Save was refused here. */
  startDateMissing: boolean;
  endDateMissing: boolean;
  /** "More options" is open. */
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  /** "More options" was asked for, and is to bring itself into view. */
  revealMore: boolean;
  onMoreRevealed: () => void;
}

/**
 * Step 5 (the `Wiz5When` and `Wiz5More` boards): when it starts (right
 * away, or on a date) and ends (never, or on a date), in Myanmar time, the
 * schedule read back in one sentence, and the closed "More options".
 */
export function WhenStep({
  state,
  setState,
  set,
  existing,
  disabled,
  marked,
  startOnDate,
  endOnDate,
  onStartOnDate,
  onEndOnDate,
  startDateMissing,
  endDateMissing,
  moreOpen,
  onMoreOpenChange,
  revealMore,
  onMoreRevealed,
}: WhenStepProps) {
  const { t } = useLanguage();
  const w = t.adsUi.wizard.when;
  const nowMs = useNow();
  const windowInvalid = marked.has("WINDOW_INVALID");

  const startIso = state.startsAt ? fromMmtInputValue(state.startsAt) : null;
  const endIso = state.endsAt ? fromMmtInputValue(state.endsAt) : null;
  const words = (iso: string) => w.dateAt(formatMmtDate(iso), formatMmtTime(iso));
  const started = startIso !== null && new Date(startIso).getTime() <= nowMs;
  const s = w.sentences;
  const sentence = !startIso
    ? endIso
      ? fillBold(s.nowEnd, { end: words(endIso) })
      : s.nowNever
    : endIso
      ? fillBold(started ? s.startedEnd : s.startEnd, { start: words(startIso), end: words(endIso) })
      : fillBold(started ? s.startedNever : s.startNever, { start: words(startIso) });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <b className="text-sm font-semibold">{w.startsLabel}</b>
        <ChoiceChips
          label={w.startsLabel}
          disabled={disabled}
          value={startOnDate ? "DATE" : "NOW"}
          options={[
            { value: "NOW" as const, label: w.startsNow },
            { value: "DATE" as const, label: w.onDate },
          ]}
          onChange={(choice) => {
            onStartOnDate(choice === "DATE");
            if (choice === "NOW") set("startsAt", "");
          }}
        />
        {startOnDate && (
          <DateTimeInputs
            value={state.startsAt}
            defaultTime={DEFAULT_START_TIME}
            onChange={(value) => set("startsAt", value)}
            dateLabel={w.startDate}
            timeLabel={w.startTime}
            disabled={disabled}
            invalid={startDateMissing || windowInvalid}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <b className="text-sm font-semibold">{w.endsLabel}</b>
        <ChoiceChips
          label={w.endsLabel}
          disabled={disabled}
          value={endOnDate ? "DATE" : "NEVER"}
          options={[
            { value: "NEVER" as const, label: w.endsNever },
            { value: "DATE" as const, label: w.onDate },
          ]}
          onChange={(choice) => {
            onEndOnDate(choice === "DATE");
            if (choice === "NEVER") set("endsAt", "");
          }}
        />
        {endOnDate && (
          <DateTimeInputs
            value={state.endsAt}
            defaultTime={DEFAULT_END_TIME}
            onChange={(value) => set("endsAt", value)}
            dateLabel={w.endDate}
            timeLabel={w.endTime}
            disabled={disabled}
            invalid={endDateMissing || windowInvalid}
          />
        )}
      </div>

      <div className="rounded-lg border border-[var(--border-strong)] bg-muted/40 px-3.5 py-3 text-sm leading-relaxed">
        <p className="text-muted-foreground">{sentence}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{w.timesNote}</p>
      </div>

      <MoreOptions
        state={state}
        setState={setState}
        set={set}
        existing={existing}
        disabled={disabled}
        marked={marked}
        open={moreOpen}
        onOpenChange={onMoreOpenChange}
        reveal={revealMore}
        onRevealed={onMoreRevealed}
      />
    </div>
  );
}
