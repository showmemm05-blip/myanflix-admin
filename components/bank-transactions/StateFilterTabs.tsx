"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/context/language-context";
import { BANK_TRANSACTION_STATE_FILTERS, type BankTransactionStateFilter } from "@/types/bank-transaction";

/**
 * The state axis of the Bank transactions list — a SERVER filter
 * (`?state=`), the same idea as VerificationFilterTabs on the deposits page.
 *
 * Counts come from the loaded page: on "All" every tab can be counted from
 * the rows in hand; on any other tab only that tab's rows are loaded, so the
 * others show no number rather than a misleading zero.
 */
export function BankTransactionStateTabs({
  value,
  onValueChange,
  counts,
}: {
  value: BankTransactionStateFilter;
  onValueChange: (value: BankTransactionStateFilter) => void;
  counts: Partial<Record<BankTransactionStateFilter, number>>;
}) {
  const { t } = useLanguage();
  const s = t.bankTransactions.filters.state;
  const labels: Record<BankTransactionStateFilter, string> = {
    all: s.all,
    unmatched: s.waiting,
    matched: s.matched,
    ambiguous: s.ambiguous,
    unclaimed: s.unclaimed,
  };
  // Same colour language as the badge tones (BANK_TRANSACTION_TONE).
  const countClass: Record<BankTransactionStateFilter, string> = {
    all: "text-muted-foreground",
    unmatched: "text-warning",
    matched: "text-success",
    ambiguous: "text-warning",
    unclaimed: "text-muted-foreground",
  };

  return (
    <Tabs value={value} onValueChange={(v) => v && onValueChange(v as BankTransactionStateFilter)}>
      <TabsList>
        {BANK_TRANSACTION_STATE_FILTERS.map((filter) => (
          <TabsTrigger key={filter} value={filter}>
            {labels[filter]}
            {counts[filter] !== undefined && <span className={countClass[filter]}>({counts[filter]})</span>}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
