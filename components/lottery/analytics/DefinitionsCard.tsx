"use client";

import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { useLanguage } from "@/lib/context/language-context";
import { AnalyticsCard } from "@/components/lottery/analytics/AnalyticsCard";
import { formatDay } from "@/components/lottery/analytics/format";

interface DefinitionsCardProps {
  /** Activity rows exist inside the range (the overview's activity.trackedInRange). */
  tracked: boolean;
  /** The comparison window lies after the first sale ever. */
  covered: boolean;
  /** The MMT date of the first purchase ever, or null. */
  firstSaleDate: string | null;
}

/**
 * "How these are counted": the contract's definitions (§2), each tagged
 * Observed, Not yet tracked (active users before the apps ping) or No
 * earlier data (share and trend without a comparison period).
 */
export function DefinitionsCard({ tracked, covered, firstSaleDate }: DefinitionsCardProps) {
  const { t } = useLanguage();
  const d = t.lottery.analytics.definitions;
  const observed = { label: d.badges.observed, tone: "success" as StatusTone };
  const items = [
    { ...d.items.activeUsers, badge: tracked ? observed : { label: d.badges.notTracked, tone: "warning" as StatusTone } },
    { ...d.items.purchasingUsers, badge: observed },
    { ...d.items.purchases, badge: observed },
    { ...d.items.ticketsSold, badge: observed },
    { ...d.items.shareTrend, badge: covered ? observed : { label: d.badges.noEarlier, tone: "neutral" as StatusTone } },
    { ...d.items.repeatBuys, badge: observed },
    {
      term: d.items.previousPeriod.term,
      text: firstSaleDate ? d.items.previousPeriodSince(formatDay(t, firstSaleDate, true)) : d.items.previousPeriod.text,
      badge: observed,
    },
  ];

  return (
    <AnalyticsCard title={d.title} description={d.description}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.term} className="flex flex-col gap-1">
            <dt className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {item.term}
              <StatusBadge label={item.badge.label} tone={item.badge.tone} className="normal-case" />
            </dt>
            <dd className="text-xs leading-relaxed text-muted-foreground">{item.text}</dd>
          </div>
        ))}
      </dl>
    </AnalyticsCard>
  );
}
