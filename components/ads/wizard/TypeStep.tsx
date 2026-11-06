"use client";

import { Lock, SquarePlay } from "lucide-react";
import { formatLabel } from "@/components/ads/adWords";
import { OptionCards } from "@/components/ads/wizard/OptionCards";
import type { StepProps } from "@/components/ads/wizard/stepProps";
import { useLanguage } from "@/lib/context/language-context";
import { AD_FORMATS, type AdFormat } from "@/types/ad";

/** A little player with a picture in its top-right corner — what "Corner picture" means, drawn. */
function CornerIcon({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="relative flex h-11 w-[4.75rem] items-center justify-center rounded-md border border-[var(--border-strong)] bg-black/60"
    >
      <span className="text-[9px] uppercase tracking-widest text-white/35">{label}</span>
      <span className="absolute top-1.5 right-1.5 h-2.5 w-5 rounded-[3px] bg-primary" />
    </span>
  );
}

/**
 * Step 1 when creating (the `Wiz1Type` board): a video ad or a corner
 * picture, as two big cards. The type decides the steps that follow and is
 * fixed for good once the row exists — creating saves it, and an edit never
 * shows this step — so an ad created by a Save whose upload then failed
 * shows its type here, locked.
 */
export function TypeStep({ state, set, existing, disabled }: StepProps) {
  const { t } = useLanguage();
  const w = t.adsUi.wizard.type;
  const locked = existing !== null;

  return (
    <div className="flex flex-col gap-4">
      <OptionCards<AdFormat>
        label={w.groupLabel}
        value={state.format}
        disabled={disabled || locked}
        onChange={(format) => set("format", format)}
        className="sm:grid-cols-2"
        options={AD_FORMATS.map((format) => ({
          value: format,
          title: formatLabel(t, format),
          description: w.descriptions[format],
          icon:
            format === "VIDEO" ? (
              <SquarePlay className="size-11 text-primary" strokeWidth={1.4} aria-hidden />
            ) : (
              <CornerIcon label={w.theMovie} />
            ),
        }))}
      />
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {locked && <Lock className="size-3.5 shrink-0" aria-hidden />}
        {locked ? w.fixedNow : w.fixedNote}
      </p>
    </div>
  );
}
