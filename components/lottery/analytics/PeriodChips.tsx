"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/context/language-context";
import { CustomRangeDialog } from "@/components/lottery/analytics/CustomRangeDialog";
import { formatRange } from "@/components/lottery/analytics/format";
import {
  type DateRange,
  type PeriodKey,
  addDays,
} from "@/components/lottery/analytics/period";

interface PeriodChipsProps<K extends PeriodKey> {
  /** The chips to draw, in order. */
  keys: readonly K[];
  value: K;
  /** The custom range in force (shown on the active Custom chip), or null. */
  custom: DateRange | null;
  /** The current MMT date — the custom dialog's upper bound. */
  today: string;
  /** Whether the dialog talks about the comparison period (dashboard) or not (reports). */
  compared: boolean;
  /** A preset chip, or the custom chip once its dialog was applied. */
  onChange: (key: K, custom?: DateRange) => void;
  /** Another page's own words for the custom chip and its dialog (Ad results); the lottery's otherwise. */
  words?: {
    custom: string;
    customChip: (range: string) => string;
    dialogTitle: string;
    dialogDescription: string;
  };
}

/**
 * Today · Yesterday · Last 7 days · … · Custom… as a row of chips, the same
 * pill treatment DateRangeFilter's presets use so the toolbar reads as one
 * control family. "Custom…" opens the dialog; while a custom range is in
 * force the chip states it ("Custom · Thu 16–Wed 22 Oct 2026").
 */
export function PeriodChips<K extends PeriodKey>({
  keys,
  value,
  custom,
  today,
  compared,
  onChange,
  words,
}: PeriodChipsProps<K>) {
  const { t } = useLanguage();
  const f = t.lottery.analytics.filters;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const openDialog = () => {
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const initial: DateRange = custom ?? { from: addDays(today, -7), to: addDays(today, -1) };

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={f.period}>
      {keys.map((key) => {
        const active = value === key;
        const isCustom = key === "custom";
        const customChip = words?.customChip ?? f.customChip;
        const label =
          isCustom && active && custom
            ? customChip(formatRange(t, custom))
            : isCustom && words
              ? words.custom
              : f.periods[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => (isCustom ? openDialog() : onChange(key))}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
              active
                ? "border-primary/25 bg-primary/15 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:border-[var(--border-stronger)] hover:text-foreground",
            )}
          >
            {isCustom && <CalendarRange className="size-3.5" />}
            {label}
          </button>
        );
      })}

      {dialogOpen && (
        <CustomRangeDialog
          key={dialogKey}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={initial}
          today={today}
          compared={compared}
          title={words?.dialogTitle}
          description={words?.dialogDescription}
          onApply={(range) => onChange("custom" as K, range)}
        />
      )}
    </div>
  );
}
