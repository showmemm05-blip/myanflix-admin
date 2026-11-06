"use client";

import { Info } from "lucide-react";
import { ChoiceChips } from "@/components/ads/ChoiceChips";
import { effectiveDurationSeconds, formatAdDuration, type AdFormState } from "@/components/ads/adForm";
import { movieTimeText } from "@/components/ads/adWords";
import { fill } from "@/components/ads/wizard/fill";
import { OptionCards } from "@/components/ads/wizard/OptionCards";
import { SettingsLink } from "@/components/ads/wizard/SettingsLink";
import { markedAny, type StepProps } from "@/components/ads/wizard/stepProps";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/context/language-context";
import { AD_LIMITS, type AdSettings } from "@/types/ad";

/** "Where should it play?" as one choice over the two slot flags; null = neither (a state the backend never stores). */
type PlaysChoice = "BEFORE" | "BREAKS" | "BOTH";
const PLAYS_CHOICES = ["BEFORE", "BREAKS", "BOTH"] as const;

function playsChoiceOf(state: AdFormState): PlaysChoice | null {
  if (state.playsBeforeMovie && state.playsAtBreaks) return "BOTH";
  if (state.playsBeforeMovie) return "BEFORE";
  return state.playsAtBreaks ? "BREAKS" : null;
}

/** What "Yes, after a few seconds" starts with — the board's example, so the box is never empty when it appears. */
const DEFAULT_SKIP_SECONDS = "5";

export interface WhereStepProps extends StepProps {
  /** The Ad settings, for the break line; null while they load. */
  settings: AdSettings | null;
  /** Leaves the wizard for the Ad settings card. */
  onOpenSettings?: () => void;
}

/**
 * Step 3 of a video ad (the `Wiz3Where` and `PhoneStep` boards): before
 * the movie, at ad breaks, or both (recommended), with a line saying how
 * often breaks come now — or that they are off, so an ad that only plays at
 * breaks would never play — and whether viewers can skip it.
 */
export function WhereStep({
  state,
  setState,
  set,
  existing,
  disabled,
  marked,
  settings,
  onOpenSettings,
}: WhereStepProps) {
  const { t } = useLanguage();
  const w = t.adsUi.wizard.where;
  const interval = settings?.midrollIntervalMinutes ?? null;
  const duration = effectiveDurationSeconds(state, existing);

  return (
    <div className="flex flex-col gap-5">
      <OptionCards<PlaysChoice>
        label={w.groupLabel}
        value={playsChoiceOf(state)}
        disabled={disabled}
        invalid={marked.has("SLOTS_REQUIRED")}
        className="sm:grid-cols-3"
        onChange={(choice) =>
          setState((prev) => ({ ...prev, playsBeforeMovie: choice !== "BREAKS", playsAtBreaks: choice !== "BEFORE" }))
        }
        options={PLAYS_CHOICES.map((value) => ({
          value,
          title: w.options[value].title,
          description: w.options[value].description,
          recommended: value === "BOTH",
        }))}
      />

      {state.playsAtBreaks && interval !== null && (
        <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/10 px-3.5 py-3 text-sm leading-relaxed">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <p>
            {interval === 0 ? w.breaksOff : w.breaksEvery(movieTimeText(t, interval * 60))}{" "}
            {fill(w.changeInSettings, { settings: <SettingsLink onOpen={onOpenSettings} /> })}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5 border-t border-border pt-5">
        <b className="text-sm font-semibold">{w.skipLabel}</b>
        <ChoiceChips
          label={w.skipLabel}
          disabled={disabled}
          value={state.isSkippable ? "YES" : "NO"}
          options={[
            { value: "NO" as const, label: w.skipNo },
            { value: "YES" as const, label: w.skipYes },
          ]}
          onChange={(choice) =>
            setState((prev) => ({
              ...prev,
              isSkippable: choice === "YES",
              skipAfterSeconds:
                choice === "YES" && prev.skipAfterSeconds.trim() === "" ? DEFAULT_SKIP_SECONDS : prev.skipAfterSeconds,
            }))
          }
        />
        {state.isSkippable && (
          <>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              {fill(w.skipAfter, {
                n: (
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={AD_LIMITS.skipAfterSeconds.min}
                    max={AD_LIMITS.skipAfterSeconds.max}
                    step={1}
                    value={state.skipAfterSeconds}
                    disabled={disabled}
                    aria-label={w.skipAfterLabel}
                    aria-invalid={
                      markedAny(marked, "SKIP_AFTER_REQUIRED", "SKIP_AFTER_RANGE", "SKIP_AFTER_TOO_LONG") || undefined
                    }
                    className="w-20"
                    onChange={(e) => set("skipAfterSeconds", e.target.value)}
                  />
                ),
              })}
            </label>
            <p className="text-xs text-muted-foreground">
              {w.skipExample}
              {duration !== null && <> {w.skipShorter(formatAdDuration(duration))}</>}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
