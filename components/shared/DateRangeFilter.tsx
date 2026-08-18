"use client";

import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/context/language-context";

export interface DateRangeValue {
  /** Local calendar date as YYYY-MM-DD, or "" for unbounded. */
  from: string;
  to: string;
}

/** Today's LOCAL date as YYYY-MM-DD — toISOString() would shift the date across midnight for non-UTC offsets. */
export function todayStr(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Compact date-range picker for DataTable toolbars: one calendar pill holding
 * the From–To inputs, plus "Today" / "All dates" preset chips that light up
 * when they match the active range. Pure controlled component — the owning
 * page holds the range state and refetches when it changes.
 */
export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}) {
  const { t } = useLanguage();
  const today = todayStr();
  const isToday = value.from === today && value.to === today;
  const isAll = !value.from && !value.to;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex h-8 items-center gap-1 rounded-full border border-border bg-secondary/40 pl-2.5 pr-1.5">
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          type="date"
          aria-label={t.dateRange.fromLabel}
          title={t.dateRange.fromLabel}
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="h-full w-[6.9rem] bg-transparent text-xs text-foreground outline-none [color-scheme:dark]"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          aria-label={t.dateRange.toLabel}
          title={t.dateRange.toLabel}
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="h-full w-[6.9rem] bg-transparent text-xs text-foreground outline-none [color-scheme:dark]"
        />
      </div>
      <PresetChip
        label={t.dateRange.today}
        active={isToday}
        onClick={() => onChange({ from: today, to: today })}
      />
      <PresetChip label={t.dateRange.all} active={isAll} onClick={() => onChange({ from: "", to: "" })} />
    </div>
  );
}

// Same active treatment as the status tabs (bg-primary/15 text-primary) so
// the toolbar reads as one control family.
function PresetChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-primary/25 bg-primary/15 text-primary"
          : "border-border bg-secondary/40 text-muted-foreground hover:border-[var(--border-stronger)] hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
