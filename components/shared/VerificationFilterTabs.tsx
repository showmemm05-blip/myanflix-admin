"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/context/language-context";
import { VERIFICATION_FILTERS, type VerificationFilter } from "@/types/bank-verification";

/**
 * The bank-verification axis of the deposits/withdrawals list — a SERVER
 * filter (`?verification=`), like StatusFilterTabs. The two stack: money
 * status × bank match.
 *
 * One dropdown rather than a second row of tabs: five options with counts
 * took a whole row, and this axis is consulted far less often than status.
 * The name is kept so both pages stay untouched.
 *
 * Counts are the server's totals for every option (GET …/stats, H-24), not
 * a tally of the loaded page; an option with no count yet shows no number
 * rather than a misleading zero.
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
    <Select value={value} onValueChange={(v) => v && onValueChange(v as VerificationFilter)}>
      <SelectTrigger className="h-8 w-auto gap-1.5 text-xs" aria-label={t.verification.columns.bankMatch}>
        <span className="text-muted-foreground">{t.verification.filters.bankLabel}:</span>
        <SelectValue>{labels[value]}</SelectValue>
        {counts[value] !== undefined && (
          <span className={`text-[11px] tabular-nums ${countClass[value]}`}>{counts[value]}</span>
        )}
      </SelectTrigger>
      <SelectContent>
        {VERIFICATION_FILTERS.map((filter) => (
          <SelectItem key={filter} value={filter}>
            <span className="flex items-center gap-2">
              {labels[filter]}
              {counts[filter] !== undefined && (
                <span className={`text-[11px] tabular-nums ${countClass[filter]}`}>{counts[filter]}</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
