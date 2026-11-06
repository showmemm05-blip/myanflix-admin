"use client";

import { MoviePicker } from "@/components/ads/MoviePicker";
import { OptionCards } from "@/components/ads/wizard/OptionCards";
import { markedAny, type StepProps } from "@/components/ads/wizard/stepProps";
import { useLanguage } from "@/lib/context/language-context";
import { AD_TARGET_TYPES, type AdTargetType } from "@/types/ad";

/**
 * Step 4 (the `Wiz4Movies` and `WizProblem` boards): every movie and
 * episode (recommended — it covers what is added later), or only the movies
 * ticked in the picker. Chosen movies never include series episodes: the
 * staff movie list leaves them out, and the card says so.
 */
export function MoviesStep({ state, set, disabled, marked }: StepProps) {
  const { t } = useLanguage();
  const m = t.adsUi.wizard.movies;
  const pickerInvalid = markedAny(marked, "TARGET_MOVIES_REQUIRED", "TARGET_TOO_MANY", "TARGET_DELETED");

  return (
    <div className="flex flex-col gap-4">
      <OptionCards<AdTargetType>
        label={m.groupLabel}
        value={state.targetType}
        disabled={disabled}
        className="sm:grid-cols-2"
        onChange={(targetType) => set("targetType", targetType)}
        options={AD_TARGET_TYPES.map((value) => ({
          value,
          title: m.options[value].title,
          description: m.options[value].description,
          recommended: value === "ALL",
        }))}
      />
      {state.targetType === "SELECTED" && (
        <MoviePicker
          value={state.movies}
          onChange={(movies) => set("movies", movies)}
          disabled={disabled}
          invalid={pickerInvalid}
        />
      )}
    </div>
  );
}
