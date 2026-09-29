"use client";

import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/** "12 Sep" from a YYYY-MM-DD string, parsed as a local date (no timezone shift). */
function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return format(new Date(y, m - 1, d), "d MMM");
}

/**
 * The date axis as ONE button that states the active range ("All dates",
 * "Today", "12 Sep – 15 Sep") and opens a small popover holding the From/To
 * inputs and the two presets. The inline pill it replaced showed both date
 * inputs at all times and, with the two tab rows above it, pushed the table
 * below the fold. Pure controlled component — the owning page holds the
 * range state and refetches when it changes.
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

  const summary = isAll
    ? t.dateRange.all
    : isToday
      ? t.dateRange.today
      : value.from && value.to
        ? `${shortDate(value.from)} – ${shortDate(value.to)}`
        : value.from
          ? t.dateRange.fromDate(shortDate(value.from))
          : t.dateRange.untilDate(shortDate(value.to));

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
          isAll
            ? "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
            : "border-primary/25 bg-primary/15 text-primary",
        )}
      >
        <CalendarDays className="size-3.5 shrink-0" />
        {summary}
        <ChevronDown className="size-3 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{t.dateRange.fromLabel}</span>
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="h-8 rounded-md border border-border bg-secondary/40 px-2 text-xs text-foreground outline-none [color-scheme:dark]"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{t.dateRange.toLabel}</span>
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="h-8 rounded-md border border-border bg-secondary/40 px-2 text-xs text-foreground outline-none [color-scheme:dark]"
            />
          </label>
          <div className="mt-1 flex items-center gap-1.5">
            <PresetChip label={t.dateRange.today} active={isToday} onClick={() => onChange({ from: today, to: today })} />
            <PresetChip label={t.dateRange.all} active={isAll} onClick={() => onChange({ from: "", to: "" })} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Same active treatment as the status tabs (bg-primary/15 text-primary) so
// the toolbar reads as one control family.
function PresetChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-7 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-primary/25 bg-primary/15 text-primary"
          : "border-border bg-secondary/40 text-muted-foreground hover:border-[var(--border-stronger)] hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
