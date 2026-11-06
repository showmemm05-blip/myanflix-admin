"use client";

import { Check } from "lucide-react";
import type { AdStepId, AdWizardMode } from "@/components/ads/adSteps";
import type { TranslationShape } from "@/lib/i18n/translations";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { AdFormat } from "@/types/ad";

/** A step's short name: "Video" or "Picture" for step 2, "Where" or "Timing" for step 3, "Check" or (editing) "Summary" last. */
export function stepName(t: TranslationShape, step: AdStepId, format: AdFormat, mode: AdWizardMode): string {
  const names = t.adsUi.wizard.steps.names;
  switch (step) {
    case "media":
      return format === "CORNER" ? names.picture : names.video;
    case "check":
      return mode === "edit" ? names.summary : names.check;
    default:
      return names[step];
  }
}

interface StepNavProps {
  mode: AdWizardMode;
  format: AdFormat;
  steps: readonly AdStepId[];
  current: AdStepId;
  /** Creating: the furthest step reached so far (an index into `steps`) — every step up to it can be opened again. */
  reached: number;
  /** Steps that hold a problem — a red dot on each (editing). */
  problemSteps: ReadonlySet<AdStepId>;
  onGoTo: (step: AdStepId) => void;
  /** Moving between steps waits (a picked picture is still being measured, or a save runs). */
  disabled: boolean;
}

/** The thin bar over each step's name: the current one full colour, the ones behind it dimmer. */
function Bar({ state }: { state: "current" | "done" | "visited" | "ahead" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-1 w-full rounded-full",
        state === "current" ? "bg-primary" : state === "done" ? "bg-primary/45" : "bg-[var(--border-strong)]",
      )}
    />
  );
}

/**
 * Where the admin is in the wizard. Creating (the `Wiz*` boards): the
 * numbered steps with a bar each, the finished ones ticked; every step
 * reached so far can be opened again (going forward checks the steps in
 * between, as Next would); on a phone just "Step 3 of 6" and a progress bar (the
 * `PhoneStep` board — the line itself is in the header). Editing (the
 * `EditMode` board): the parts of the ad, every one clickable, a red dot on
 * a part that needs fixing.
 */
export function StepNav({ mode, format, steps, current, reached, problemSteps, onGoTo, disabled }: StepNavProps) {
  const { t } = useLanguage();
  const s = t.adsUi.wizard.steps;
  const index = steps.indexOf(current);
  const columns = { gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` };

  if (mode === "edit") {
    return (
      <nav
        aria-label={s.partsLabel}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0"
        style={columns}
      >
        {steps.map((step) => {
          const active = step === current;
          const problem = problemSteps.has(step);
          return (
            <button
              key={step}
              type="button"
              aria-current={active ? "step" : undefined}
              disabled={disabled && !active}
              onClick={() => onGoTo(step)}
              className={cn(
                "flex min-w-24 shrink-0 flex-col gap-1.5 rounded-sm text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:min-w-0",
                active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
                problem && !active && "text-destructive hover:text-destructive",
              )}
            >
              <Bar state={active ? "current" : "ahead"} />
              <span className="inline-flex items-center gap-1.5">
                {stepName(t, step, format, mode)}
                {problem && (
                  <>
                    <span aria-hidden className="size-2 shrink-0 rounded-full bg-destructive" />
                    <span className="sr-only">({s.hasProblem})</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      <ol aria-label={s.listLabel} className="hidden gap-1.5 text-xs sm:grid" style={columns}>
        {steps.map((step, i) => {
          const state = i === index ? "current" : i < index ? "done" : i <= reached ? "visited" : "ahead";
          const label = (
            <>
              <Bar state={state} />
              <span className="inline-flex items-center gap-1">
                {s.numbered(i + 1, stepName(t, step, format, mode))}
                {state === "done" && (
                  <>
                    <Check className="size-3 shrink-0" aria-hidden />
                    <span className="sr-only">({s.done})</span>
                  </>
                )}
              </span>
            </>
          );
          return (
            <li key={step} aria-current={state === "current" ? "step" : undefined}>
              {state === "done" || state === "visited" ? (
                // A step already reached can be opened again: going back is
                // Back; going forward checks the steps in between first.
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onGoTo(step)}
                  className="flex w-full flex-col gap-1.5 rounded-sm text-left text-foreground/80 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {label}
                </button>
              ) : (
                <span
                  className={cn(
                    "flex flex-col gap-1.5",
                    state === "current" ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
        aria-label={s.progress(index + 1, steps.length)}
        className="h-1 w-full overflow-hidden rounded-full bg-[var(--border-strong)] sm:hidden"
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${((index + 1) / steps.length) * 100}%` }}
        />
      </div>
    </>
  );
}
