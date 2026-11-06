"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/context/language-context";
import { LOTTERY_ANALYTICS_MAX_RANGE_DAYS } from "@/types/lottery-analytics";
import { formatRange } from "@/components/lottery/analytics/format";
import {
  type DateRange,
  customRangeProblem,
  daySpan,
} from "@/components/lottery/analytics/period";

interface CustomRangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the inputs start from — the range in force, or the last 7 days. */
  initial: DateRange;
  /** The current MMT date: the end date may not pass it. */
  today: string;
  /** The dashboard compares with the period before; the reports page does not. */
  compared: boolean;
  /** Another page's own words (Ad results); the lottery's otherwise. */
  title?: string;
  description?: string;
  onApply: (range: DateRange) => void;
}

/**
 * The "Custom…" chip's dialog: two MMT calendar dates, checked before Apply
 * is enabled (both present, in order, not after today, at most 366 days —
 * the backend's own limit). The parent mounts it with a `key` per opening so
 * the inputs restart from `initial`.
 */
export function CustomRangeDialog({
  open,
  onOpenChange,
  initial,
  today,
  compared,
  title,
  description,
  onApply,
}: CustomRangeDialogProps) {
  const { t } = useLanguage();
  const c = t.lottery.analytics.customRange;
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const problem = customRangeProblem(from, to, today);
  const days = problem ? 0 : daySpan({ from, to });
  const help =
    problem === "enterBoth"
      ? c.enterBoth
      : problem === "endBeforeStart"
        ? c.endBeforeStart
        : problem === "endAfterToday"
          ? c.endAfterToday
          : problem === "tooLong"
            ? c.tooLong(LOTTERY_ANALYTICS_MAX_RANGE_DAYS)
            : compared
              ? c.helpCompared(days, formatRange(t, { from, to }))
              : c.help(days, formatRange(t, { from, to }));
  // "Enter both dates" is guidance, not a mistake: only a filled-in pair can be wrong.
  const invalid = problem !== null && problem !== "enterBoth";

  const apply = () => {
    if (problem) return;
    onApply({ from, to });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? c.title}</DialogTitle>
          <DialogDescription>{description ?? (compared ? c.descriptionDashboard : c.descriptionReports)}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analytics-range-from">{c.from}</Label>
            <Input
              id="analytics-range-from"
              type="date"
              value={from}
              max={today}
              aria-invalid={invalid}
              className="[color-scheme:dark]"
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analytics-range-to">{c.to}</Label>
            <Input
              id="analytics-range-to"
              type="date"
              value={to}
              min={from || undefined}
              max={today}
              aria-invalid={invalid}
              className="[color-scheme:dark]"
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <p
          role={invalid ? "alert" : undefined}
          className={invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
        >
          {help}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {c.cancel}
          </Button>
          <Button onClick={apply} disabled={problem !== null}>
            {c.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
