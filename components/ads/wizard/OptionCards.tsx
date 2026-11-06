"use client";

import { useId, type ReactNode } from "react";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";

export interface OptionCard<V extends string> {
  value: V;
  title: string;
  description?: ReactNode;
  /** Adds "· Recommended" after the title — the choice most ads want. */
  recommended?: boolean;
  /** A picture above the title (the type step's big cards). */
  icon?: ReactNode;
}

interface OptionCardsProps<V extends string> {
  options: readonly OptionCard<V>[];
  /** null = none chosen yet. */
  value: V | null;
  onChange: (value: V) => void;
  /** Names the group for screen readers ("Where it plays"). */
  label: string;
  disabled?: boolean;
  /** Marks the group as holding a problem (red border). */
  invalid?: boolean;
  className?: string;
}

/**
 * One-of-a-few choices as big cards with a sentence each (the wizard's
 * "Where should it play?", "Which movies…?", "Turn it on now?"). Real radio
 * buttons under the cards, so the arrow keys move between them and a screen
 * reader hears a radio group; the card itself is the label, so a tap
 * anywhere on it chooses it.
 */
export function OptionCards<V extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  invalid = false,
  className,
}: OptionCardsProps<V>) {
  const { t } = useLanguage();
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      className={cn("grid gap-3", className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "relative flex cursor-pointer flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-colors",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            "has-[:checked]:border-primary has-[:checked]:bg-primary/[0.08]",
            invalid ? "border-destructive/50" : "border-[var(--border-strong)] hover:border-[var(--border-stronger)]",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.icon}
          <span className="text-sm font-semibold">
            {option.title}
            {option.recommended && (
              <span className="text-xs font-medium text-primary"> · {t.adsUi.shared.recommended}</span>
            )}
          </span>
          {option.description && (
            <span className="text-[13px] leading-relaxed text-muted-foreground">{option.description}</span>
          )}
        </label>
      ))}
    </div>
  );
}
