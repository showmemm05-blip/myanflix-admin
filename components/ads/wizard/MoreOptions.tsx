"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { isOvernight, moreOptionsSet, type AdFormState, type AdIssueCode } from "@/components/ads/adForm";
import { fill } from "@/components/ads/wizard/fill";
import { markedAny, type StepProps } from "@/components/ads/wizard/stepProps";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { AD_LIMITS } from "@/types/ad";

/** The problems that live in this section — any of them opens it. */
export const MORE_OPTIONS_ISSUES: readonly AdIssueCode[] = [
  "DAILY_WINDOW_INCOMPLETE",
  "DAILY_WINDOW_SAME",
  "FREQUENCY_RANGE",
  "MAX_PER_DAY_RANGE",
  "PRIORITY_RANGE",
];

/** What a switch turned on starts with — the examples under each, so a box never appears empty. */
const DEFAULTS = { dailyStartTime: "18:00", dailyEndTime: "23:00", wait: "60", perDay: "3" } as const;

/** Which of the three switches are on, as the form holds them now. */
function switchesOf(state: AdFormState) {
  return {
    hours: state.dailyStartTime !== "" || state.dailyEndTime !== "",
    wait: state.frequencyLimitMinutes.trim() !== "",
    perDay: state.maxImpressionsPerUserPerDay.trim() !== "",
  };
}

/** One option: a label with its switch (or its own box), what it holds when on, and the example. */
function Option({
  id,
  label,
  on,
  onToggle,
  disabled,
  children,
  example,
}: {
  id: string;
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  disabled: boolean;
  children: ReactNode;
  example: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <Switch id={id} checked={on} disabled={disabled} onCheckedChange={onToggle} />
      </div>
      {on && children}
      <p className="text-xs leading-relaxed text-muted-foreground">{example}</p>
    </div>
  );
}

interface MoreOptionsProps extends StepProps {
  /** Held by the wizard: a problem in here opens it there, and it outlives the When step. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Asked for ("Change hours", the Summary's row): comes into view as it mounts. */
  reveal: boolean;
  onRevealed: () => void;
}

/**
 * "More options" on the When step (the `Wiz5More` board, SPEC §2): the
 * rarely needed rules, closed by default — the hours of the day, the wait
 * before one viewer sees it again, the daily limit, and "which ad goes
 * first". The closed header says "most ads don't need these" or how many
 * are set; a problem in here opens it (AdWizard.tsx), so the red box never
 * points at something hidden, and fixing that problem leaves it open: closing
 * would take the box away mid-typing and save what was typed so far. A
 * switch turned on starts with its example's value; off clears it (= not set).
 */
export function MoreOptions({
  state,
  setState,
  set,
  disabled,
  marked,
  open,
  onOpenChange,
  reveal,
  onRevealed,
}: MoreOptionsProps) {
  const { t } = useLanguage();
  const m = t.adsUi.wizard.more;
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reveal) return;
    rootRef.current?.scrollIntoView({ block: "nearest" });
    onRevealed();
  }, [reveal, onRevealed]);
  // A switch stays on while its box is being retyped (an emptied box is
  // "not set" on the wire, but must not make the box vanish under the cursor).
  const [on, setOn] = useState(() => switchesOf(state));
  const count = moreOptionsSet(state);

  const numberBox = (
    key: "frequencyLimitMinutes" | "maxImpressionsPerUserPerDay",
    range: { min: number; max: number },
    label: string,
    invalid: boolean,
  ) => (
    <Input
      type="number"
      inputMode="numeric"
      min={range.min}
      max={range.max}
      step={1}
      value={state[key]}
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid || undefined}
      className="w-24"
      onChange={(e) => set(key, e.target.value)}
    />
  );

  const timeBox = (key: "dailyStartTime" | "dailyEndTime", label: string) => (
    <Input
      type="time"
      value={state[key]}
      disabled={disabled}
      aria-label={label}
      aria-invalid={markedAny(marked, "DAILY_WINDOW_INCOMPLETE", "DAILY_WINDOW_SAME") || undefined}
      className="w-32 [color-scheme:dark]"
      onChange={(e) => set(key, e.target.value)}
    />
  );

  return (
    <Collapsible
      ref={rootRef}
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-xl border border-[var(--border-strong)]"
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left outline-none transition-colors hover:bg-foreground/[0.03] focus-visible:ring-2 focus-visible:ring-ring",
          open && "rounded-b-none",
        )}
      >
        <span className="text-sm">
          <b className="font-semibold">{m.title}</b>{" "}
          <span className={cn("text-muted-foreground", count > 0 && "font-medium text-primary")}>
            · {count > 0 ? m.set(count) : m.notNeeded}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t border-border px-4 pt-3 pb-4">
        <p className="text-[13px] text-muted-foreground">{m.intro}</p>

        <Option
          id="ad-more-hours"
          label={m.hours.label}
          on={on.hours}
          disabled={disabled}
          onToggle={(next) => {
            setOn((prev) => ({ ...prev, hours: next }));
            setState((prev) =>
              next
                ? {
                    ...prev,
                    dailyStartTime: prev.dailyStartTime || DEFAULTS.dailyStartTime,
                    dailyEndTime: prev.dailyEndTime || DEFAULTS.dailyEndTime,
                  }
                : { ...prev, dailyStartTime: "", dailyEndTime: "" },
            );
          }}
          example={m.hours.example}
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {fill(m.hours.range, {
              from: timeBox("dailyStartTime", m.hours.fromLabel),
              to: timeBox("dailyEndTime", m.hours.toLabel),
            })}
          </div>
          {state.dailyStartTime && state.dailyEndTime && isOvernight(state.dailyStartTime, state.dailyEndTime) && (
            <p className="text-xs font-medium text-info">{m.hours.overnight}</p>
          )}
        </Option>

        <Option
          id="ad-more-wait"
          label={m.wait.label}
          on={on.wait}
          disabled={disabled}
          onToggle={(next) => {
            setOn((prev) => ({ ...prev, wait: next }));
            setState((prev) => ({
              ...prev,
              frequencyLimitMinutes: next ? prev.frequencyLimitMinutes.trim() || DEFAULTS.wait : "",
            }));
          }}
          example={m.wait.examples[state.format]}
        >
          <label className="flex flex-wrap items-center gap-2 text-sm">
            {fill(m.wait.input, {
              n: numberBox(
                "frequencyLimitMinutes",
                AD_LIMITS.frequencyLimitMinutes,
                m.wait.inputLabel,
                marked.has("FREQUENCY_RANGE"),
              ),
            })}
          </label>
        </Option>

        <Option
          id="ad-more-perDay"
          label={m.perDay.label}
          on={on.perDay}
          disabled={disabled}
          onToggle={(next) => {
            setOn((prev) => ({ ...prev, perDay: next }));
            setState((prev) => ({
              ...prev,
              maxImpressionsPerUserPerDay: next ? prev.maxImpressionsPerUserPerDay.trim() || DEFAULTS.perDay : "",
            }));
          }}
          example={m.perDay.examples[state.format]}
        >
          <label className="flex flex-wrap items-center gap-2 text-sm">
            {fill(m.perDay.input, {
              n: numberBox(
                "maxImpressionsPerUserPerDay",
                AD_LIMITS.maxImpressionsPerUserPerDay,
                m.perDay.inputLabel,
                marked.has("MAX_PER_DAY_RANGE"),
              ),
            })}
          </label>
        </Option>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="ad-more-priority" className="text-sm font-semibold">
              {m.priority.label}
            </label>
            <Input
              id="ad-more-priority"
              type="number"
              inputMode="numeric"
              min={AD_LIMITS.priority.min}
              max={AD_LIMITS.priority.max}
              step={1}
              value={state.priority}
              disabled={disabled}
              aria-invalid={marked.has("PRIORITY_RANGE") || undefined}
              className="w-24"
              onChange={(e) => set("priority", e.target.value)}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{m.priority.text}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
