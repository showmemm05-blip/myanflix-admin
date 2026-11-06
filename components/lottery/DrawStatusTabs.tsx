"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/context/language-context";
import { LOTTERY_DRAW_FILTERS, type LotteryDrawFilter } from "@/types/lottery";

/**
 * All / Scheduled / Open / Paused / Closed / Published as one segmented
 * control — a SERVER filter (`?status=`), so it sees every draw and not just
 * the page in hand.
 */
export function DrawStatusTabs({
  value,
  onValueChange,
}: {
  value: LotteryDrawFilter;
  onValueChange: (value: LotteryDrawFilter) => void;
}) {
  const { t } = useLanguage();
  return (
    <Tabs value={value} onValueChange={(v) => v && onValueChange(v as LotteryDrawFilter)}>
      <TabsList className="h-8">
        {LOTTERY_DRAW_FILTERS.map((filter) => (
          <TabsTrigger key={filter} value={filter} className="px-2 text-xs">
            {t.lottery.draws.filters[filter]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
