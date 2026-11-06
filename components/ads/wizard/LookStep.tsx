"use client";

import { ChoiceChips } from "@/components/ads/ChoiceChips";
import { CornerPreview } from "@/components/ads/CornerPreview";
import { AD_LINK_PATTERN, cornerTimingOf } from "@/components/ads/adForm";
import { fill, fillBold } from "@/components/ads/wizard/fill";
import { markedAny, type StepProps } from "@/components/ads/wizard/stepProps";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/context/language-context";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { AD_LIMITS, CORNER_FIRST_SHOW_AFTER_SECONDS } from "@/types/ad";

/**
 * Step 3 of a corner picture (the `Corner3` board): how long it stays (a
 * few seconds, or until the viewer closes it), whether it comes back (every
 * N minutes of watching, or only once), and the ✕ — beside a live preview
 * of the player, with the timing in one sentence and the two rules a
 * viewer's movie can still stop it with. Until-closed means no coming back
 * and always closable (the backend's rule), so those two choices step
 * aside rather than being sent as last typed.
 */
export function LookStep({ state, set, existing, disabled, marked }: StepProps) {
  const { t } = useLanguage();
  const l = t.adsUi.wizard.look;
  const untilClosed = state.cornerUntilClosed;
  const timing = cornerTimingOf(state);

  // The preview's inputs, all primitives so CornerPreview's memo holds.
  const objectUrl = useObjectUrl(state.imageFile);
  const pictureSrc = objectUrl ?? existing?.imageUrl ?? null;
  const measured = state.imageFile && typeof state.imageFileSize === "object" ? state.imageFileSize : null;
  const pictureWidth = state.imageFile ? (measured?.width ?? null) : (existing?.imageWidth ?? null);
  const pictureHeight = state.imageFile ? (measured?.height ?? null) : (existing?.imageHeight ?? null);
  const typedLink = state.linkUrl.trim();
  const previewLink = AD_LINK_PATTERN.test(typedLink) ? typedLink : null;

  const number = (value: number) => (Number.isFinite(value) ? value : null);
  const stay = timing.showSeconds === null ? null : number(timing.showSeconds);
  const every = timing.repeatMinutes === null ? null : number(timing.repeatMinutes);
  const first = l.minutes(CORNER_FIRST_SHOW_AFTER_SECONDS / 60);
  const timeline =
    timing.showSeconds === null
      ? fillBold(l.timeline.untilClosed, { first })
      : timing.repeatMinutes === null
        ? fillBold(l.timeline.once, { first, stay: stay === null ? "…" : l.seconds(stay) })
        : fillBold(l.timeline.repeat, {
            first,
            stay: stay === null ? "…" : l.seconds(stay),
            every: every === null ? "…" : l.minutes(every),
          });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <b className="text-sm font-semibold">{l.stayLabel}</b>
            <ChoiceChips
              label={l.stayLabel}
              disabled={disabled}
              value={untilClosed ? "UNTIL_CLOSED" : "FOR"}
              options={[
                { value: "FOR" as const, label: l.stayFor },
                { value: "UNTIL_CLOSED" as const, label: l.stayUntilClosed },
              ]}
              onChange={(choice) => set("cornerUntilClosed", choice === "UNTIL_CLOSED")}
            />
            {!untilClosed && (
              <label className="flex flex-wrap items-center gap-2 text-sm">
                {fill(l.staySeconds, {
                  n: (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={AD_LIMITS.cornerShowSeconds.min}
                      max={AD_LIMITS.cornerShowSeconds.max}
                      step={1}
                      value={state.cornerShowSeconds}
                      disabled={disabled}
                      aria-label={l.staySecondsLabel}
                      aria-invalid={markedAny(marked, "CORNER_SHOW_RANGE", "CORNER_REPEAT_TOO_SHORT") || undefined}
                      className="w-20"
                      onChange={(e) => set("cornerShowSeconds", e.target.value)}
                    />
                  ),
                })}
              </label>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <b className="text-sm font-semibold">{l.repeatLabel}</b>
            {untilClosed ? (
              // Closing it is final, so a picture that stays until closed
              // never comes back (the backend's rule).
              <p className="text-[13px] text-muted-foreground">{l.repeatUntilClosed}</p>
            ) : (
              <>
                <ChoiceChips
                  label={l.repeatLabel}
                  disabled={disabled}
                  value={state.cornerOnce ? "ONCE" : "EVERY"}
                  options={[
                    { value: "EVERY" as const, label: l.repeatEvery },
                    { value: "ONCE" as const, label: l.repeatOnce },
                  ]}
                  onChange={(choice) => set("cornerOnce", choice === "ONCE")}
                />
                {!state.cornerOnce && (
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    {fill(l.repeatMinutes, {
                      n: (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={AD_LIMITS.cornerRepeatMinutes.min}
                          max={AD_LIMITS.cornerRepeatMinutes.max}
                          step={1}
                          value={state.cornerRepeatMinutes}
                          disabled={disabled}
                          aria-label={l.repeatMinutesLabel}
                          aria-invalid={
                            markedAny(marked, "CORNER_REPEAT_RANGE", "CORNER_REPEAT_TOO_SHORT") || undefined
                          }
                          className="w-20"
                          onChange={(e) => set("cornerRepeatMinutes", e.target.value)}
                        />
                      ),
                    })}
                  </label>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-strong)] p-3">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="ad-cornerClosable" className="text-sm font-semibold">
                {l.closableLabel}
              </label>
              <span className="text-xs text-muted-foreground">{untilClosed ? l.closableForced : l.closableHint}</span>
            </div>
            <Switch
              id="ad-cornerClosable"
              checked={untilClosed || state.cornerClosable}
              disabled={disabled || untilClosed}
              onCheckedChange={(checked) => set("cornerClosable", checked)}
            />
          </div>
        </div>

        <CornerPreview
          src={pictureSrc}
          width={pictureWidth}
          height={pictureHeight}
          closable={untilClosed || state.cornerClosable}
          linkUrl={previewLink}
          caption={t.adsUi.wizard.preview.caption}
          showHiddenNote={false}
          title={state.title.trim()}
        />
      </div>

      <p className="rounded-lg border border-[var(--border-strong)] bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
        {timeline}
      </p>
      <ul className="flex flex-col gap-1 text-[13px] text-muted-foreground">
        <li>• {l.lastMinutesNote}</li>
        <li>• {l.pausingNote}</li>
        <li>• {t.adsUi.wizard.preview.hiddenNote}</li>
      </ul>
    </div>
  );
}
