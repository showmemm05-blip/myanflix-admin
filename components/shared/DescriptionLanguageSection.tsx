"use client";

import { TmdbFromTag } from "@/components/tmdb/TmdbFromTag";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api/apiClient";

/** The backend's limit for either description (`@MaxLength(4000)` on `description` and `descriptionMm`). */
export const DESCRIPTION_MAX_LENGTH = 4000;

/**
 * The backend's coded refusal (400) of a save that would leave a title with
 * no description in either language — backend/src/movies/description-languages.ts,
 * the same code for movies and series.
 */
export const DESCRIPTION_REQUIRED_CODE = "DESCRIPTION_REQUIRED";

/**
 * True when a save was refused by that rule. Every form checks it before
 * sending (`descriptionProblem`, and the Edit movie dialog's own check), so
 * this is only the case the form could not see: the title changed on the
 * server while it was open. The form then says what is missing instead of
 * the generic "save failed".
 */
export function isDescriptionRequiredError(err: unknown): boolean {
  return err instanceof ApiError && err.code === DESCRIPTION_REQUIRED_CODE;
}

/** Characters the way the backend's check counts them: whole code points, so one emoji is one. */
export function descriptionLength(text: string): number {
  return Array.from(text).length;
}

/** Why a form may not save its descriptions: neither language has a text, or one is over the limit. */
export type DescriptionProblem = "missing" | "too_long";

/**
 * The two series forms insist on a description in at least one language
 * (`required`); the Edit movie dialog does not, because a freshly uploaded
 * title has none yet. Over the limit stops every form. Null = fine to save.
 */
export function descriptionProblem(
  english: string,
  burmese: string,
  options: { required?: boolean } = {},
): DescriptionProblem | null {
  if (descriptionLength(english) > DESCRIPTION_MAX_LENGTH || descriptionLength(burmese) > DESCRIPTION_MAX_LENGTH) {
    return "too_long";
  }
  if (options.required && !english.trim() && !burmese.trim()) return "missing";
  return null;
}

interface DescriptionLanguageSectionProps {
  /** Makes the two boxes' ids unique where a page shows more than one form ("edit-movie", "series-info"). */
  idPrefix: string;
  english: string;
  burmese: string;
  onEnglishChange: (value: string) => void;
  onBurmeseChange: (value: string) => void;
  /**
   * The English text is still exactly what TMDB put there: "From TMDB"
   * shows under it. The form passes true only while the box holds the
   * loaded text of a title whose description is still the automatic one.
   */
  englishFromTmdb?: boolean;
  /** `stacked`: one box under the other (the Edit movie dialog). `columns`: side by side from `sm` up (the wide series card). */
  layout?: "stacked" | "columns";
  rows?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * "Description in each language" (2026-11-06, the `EditMovie` and
 * `SeriesInfo` boards) — the section that replaces the single description
 * box on the Edit movie dialog (movies and episodes), the Create / Edit
 * Series dialog and the series manage page. Named that way so it is not
 * read as the film's spoken Language.
 *
 * Two boxes, "English" and "မြန်မာ", each with its own 4000 counter. The
 * English one is what TMDB fills; the Burmese one is always typed by hand
 * and can be added at any time. Viewers get the text of their app language,
 * or the other one when theirs is empty — the hint under an empty box says
 * so. A box over the limit turns red and says how long it may be; the form
 * around it decides whether it may save (`descriptionProblem`).
 */
export function DescriptionLanguageSection({
  idPrefix,
  english,
  burmese,
  onEnglishChange,
  onBurmeseChange,
  englishFromTmdb = false,
  layout = "stacked",
  rows = 3,
  disabled = false,
  className,
}: DescriptionLanguageSectionProps) {
  const { t } = useLanguage();
  const d = t.tmdb.description;
  const titleId = `${idPrefix}-description-title`;

  const boxes = [
    {
      key: "en",
      id: `${idPrefix}-description-en`,
      label: d.english,
      lang: "en",
      value: english,
      onChange: onEnglishChange,
      placeholder: d.englishPlaceholder,
      // Says the Burmese text stands in — only when there is one to stand in.
      emptyHint: burmese.trim() ? d.englishEmpty : null,
      fromTmdb: englishFromTmdb,
    },
    {
      key: "mm",
      id: `${idPrefix}-description-mm`,
      label: d.burmese,
      lang: "my",
      value: burmese,
      onChange: onBurmeseChange,
      placeholder: d.burmesePlaceholder,
      emptyHint: english.trim() ? d.burmeseEmpty : null,
      fromTmdb: false,
    },
  ];

  return (
    <section
      aria-labelledby={titleId}
      className={cn("flex flex-col gap-3 rounded-lg border border-border bg-secondary/20 p-3", className)}
    >
      <div className="flex flex-col gap-0.5">
        <p id={titleId} className="text-sm font-medium">
          {d.title}
        </p>
        <p className="text-xs text-muted-foreground">{d.hint}</p>
      </div>

      <div className={cn("grid gap-3", layout === "columns" && "sm:grid-cols-2")}>
        {boxes.map((box) => {
          const used = descriptionLength(box.value);
          const tooLong = used > DESCRIPTION_MAX_LENGTH;
          const empty = box.value.trim() === "";
          const hintId = `${box.id}-hint`;
          const hint = tooLong ? (
            <span className="text-destructive">{d.tooLong(DESCRIPTION_MAX_LENGTH)}</span>
          ) : box.fromTmdb && !empty ? (
            <TmdbFromTag variant="inline" />
          ) : empty && box.emptyHint ? (
            box.emptyHint
          ) : null;
          return (
            <div key={box.key} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={box.id} lang={box.lang}>
                  {box.label}
                </Label>
                <span className={cn("text-xs tabular-nums", tooLong ? "text-destructive" : "text-muted-foreground")}>
                  {d.counter(used, DESCRIPTION_MAX_LENGTH)}
                </span>
              </div>
              <Textarea
                id={box.id}
                lang={box.lang}
                rows={rows}
                value={box.value}
                placeholder={box.placeholder}
                disabled={disabled}
                aria-invalid={tooLong || undefined}
                aria-describedby={hint ? hintId : undefined}
                onChange={(event) => box.onChange(event.target.value)}
              />
              {hint && (
                <p id={hintId} className="text-xs text-muted-foreground">
                  {hint}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
