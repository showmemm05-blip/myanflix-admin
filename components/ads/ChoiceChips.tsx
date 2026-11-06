"use client";

import { cn } from "@/lib/utils";

export interface ChoiceChipOption<V extends string> {
  value: V;
  label: string;
}

interface ChoiceChipsProps<V extends string> {
  options: readonly ChoiceChipOption<V>[];
  /** null = none chosen (a stored value no chip stands for). */
  value: V | null;
  onChange: (value: V) => void;
  /** Names the group for screen readers ("Ad breaks during the movie"). */
  label: string;
  disabled?: boolean;
  className?: string;
}

/**
 * One-of-a-few choices as a row of pills ("Off · Every 15 min · … · Custom"),
 * the same treatment as the analytics PeriodChips so the ad pages read as
 * one control family. Each chip is a toggle button (`aria-pressed`).
 */
export function ChoiceChips<V extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
}: ChoiceChipsProps<V>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
              active
                ? "border-primary/25 bg-primary/15 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:border-[var(--border-stronger)] hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
