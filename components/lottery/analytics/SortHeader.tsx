"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/context/language-context";
import type { LotteryAnalyticsSortOrder } from "@/types/lottery-analytics";

interface SortHeaderProps {
  label: string;
  /** True when the table is sorted by this column. */
  active: boolean;
  order: LotteryAnalyticsSortOrder;
  onClick: () => void;
  alignRight?: boolean;
}

/**
 * A column header that sorts on the SERVER. DataTable's own sort buttons
 * reorder the rows in hand, which on a paged list would sort one page of
 * ten; these headers drive `sort`/`order` on the request instead, drawn
 * with the same arrows so the two kinds of table look alike.
 */
export function SortHeader({ label, active, order, onClick, alignRight = false }: SortHeaderProps) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t.lottery.analytics.numbers.sortBy(label)}
      className={cn(
        "flex items-center gap-1.5 transition-colors hover:text-foreground",
        active && "text-foreground",
        alignRight && "w-full justify-end",
      )}
    >
      {label}
      {active && order === "asc" && <ArrowUp className="size-3.5 text-primary" />}
      {active && order === "desc" && <ArrowDown className="size-3.5 text-primary" />}
      {!active && <ArrowUpDown className="size-3.5 opacity-40" />}
    </button>
  );
}
