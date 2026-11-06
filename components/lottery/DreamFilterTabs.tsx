"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/context/language-context";
import { LOTTERY_DREAM_FILTERS, type LotteryDreamFilter } from "@/types/lottery";

/**
 * All / Missing name / No picture / Off as one segmented control — a SERVER
 * filter (`?filter=`), so it sees the whole book and not just the page in
 * hand.
 */
export function DreamFilterTabs({
  value,
  onValueChange,
}: {
  value: LotteryDreamFilter;
  onValueChange: (value: LotteryDreamFilter) => void;
}) {
  const { t } = useLanguage();
  return (
    <Tabs value={value} onValueChange={(v) => v && onValueChange(v as LotteryDreamFilter)}>
      <TabsList className="h-8">
        {LOTTERY_DREAM_FILTERS.map((filter) => (
          <TabsTrigger key={filter} value={filter} className="px-2 text-xs">
            {t.lottery.dreams.filters[filter]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
