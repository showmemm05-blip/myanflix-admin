"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/context/language-context";
import { VERIFICATION_FILTERS, type VerificationFilter } from "@/types/bank-verification";

/**
 * The bank-verification axis of the deposits/withdrawals list — a SERVER
 * filter (`?verification=`), unlike StatusFilterTabs which narrows the loaded
 * page client-side. The two stack: money status × bank match.
 *
 * Counts come from the loaded page: on "All" every tab can be counted from
 * the rows in hand; on any other tab only that tab's rows are loaded, so the
 * others show no number rather than a misleading zero.
 */
export function VerificationFilterTabs({
  value,
  onValueChange,
  counts,
}: {
  value: VerificationFilter;
  onValueChange: (value: VerificationFilter) => void;
  counts: Partial<Record<VerificationFilter, number>>;
}) {
  const { t } = useLanguage();
  const labels: Record<VerificationFilter, string> = {
    all: t.verification.filters.all,
    awaiting_bank: t.verification.filters.awaitingBank,
    verified: t.verification.filters.verified,
    needs_review: t.verification.filters.needsReview,
    no_bank_transaction: t.verification.filters.noBankTransaction,
  };
  // Same colour language as the StatusFilterTabs counts: neutral for the
  // catch-all, the badge tone for each specific state.
  const countClass: Record<VerificationFilter, string> = {
    all: "text-muted-foreground",
    awaiting_bank: "text-muted-foreground",
    verified: "text-success",
    needs_review: "text-warning",
    no_bank_transaction: "text-destructive",
  };

  return (
    <Tabs value={value} onValueChange={(v) => v && onValueChange(v as VerificationFilter)}>
      <TabsList>
        {VERIFICATION_FILTERS.map((filter) => (
          <TabsTrigger key={filter} value={filter}>
            {labels[filter]}
            {counts[filter] !== undefined && (
              <span className={countClass[filter]}>({counts[filter]})</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
