"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/context/language-context";

export type StatusFilterValue = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

/**
 * The money-status axis as one compact segmented control: label + a small
 * count, no parentheses. It shares one toolbar row with the bank dropdown
 * and the date button — three controls where three rows used to be.
 *
 * A SERVER filter (`?status=`) on the deposits/withdrawals queues, and the
 * counts are the server's totals (GET …/stats) — omitted while they load, so
 * a tab never shows a misleading zero.
 */
export function StatusFilterTabs({
  value,
  onValueChange,
  counts,
}: {
  value: StatusFilterValue;
  onValueChange: (value: StatusFilterValue) => void;
  counts?: { all: number; pending: number; approved: number; rejected: number };
}) {
  const { t } = useLanguage();
  const items: { value: StatusFilterValue; label: string; count?: number; tone: string }[] = [
    { value: "ALL", label: t.shared.statusAll, count: counts?.all, tone: "text-muted-foreground" },
    { value: "PENDING", label: t.shared.statusPending, count: counts?.pending, tone: "text-pending" },
    { value: "APPROVED", label: t.shared.statusApproved, count: counts?.approved, tone: "text-approved" },
    { value: "REJECTED", label: t.shared.statusRejected, count: counts?.rejected, tone: "text-rejected" },
  ];
  return (
    <Tabs value={value} onValueChange={(v) => v && onValueChange(v as StatusFilterValue)}>
      <TabsList className="h-8">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className="px-2 text-xs">
            {item.label}
            {item.count !== undefined && (
              <span className={`text-[11px] tabular-nums ${item.tone}`}>{item.count}</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
