"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaymentAccount } from "@/types/payment-account";
import type { PaymentAccountTransactionType } from "@/types/payment-account-transaction";
import type { TranslationShape } from "@/lib/i18n/translations";

const ALL_TRANSACTION_TYPES: PaymentAccountTransactionType[] = [
  "OPENING_BALANCE",
  "MANUAL_CREDIT",
  "MANUAL_DEBIT",
  "DEPOSIT_IN",
  "WITHDRAWAL_OUT",
  "ADJUSTMENT_CREDIT",
  "ADJUSTMENT_DEBIT",
];

export interface TransactionFilterValues {
  paymentAccountId: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilterValues = {
  paymentAccountId: "",
  type: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

export function TransactionFilters({
  accounts,
  value,
  onChange,
  t,
}: {
  accounts: PaymentAccount[];
  value: TransactionFilterValues;
  onChange: (next: TransactionFilterValues) => void;
  t: TranslationShape;
}) {
  const hasFilters = Object.values(value).some((v) => v.length > 0);
  const set = (patch: Partial<TransactionFilterValues>) => onChange({ ...value, ...patch });

  const accountItems: Record<string, string> = {
    "": t.paymentAccountLedger.central.filters.allAccounts,
    ...Object.fromEntries(
      accounts.map((a) => [a.id, a.subname ? `${a.accountName} — ${a.subname}` : a.accountName]),
    ),
  };
  const typeItems: Record<string, string> = {
    "": t.paymentAccountLedger.central.filters.allTypes,
    ...Object.fromEntries(ALL_TRANSACTION_TYPES.map((v) => [v, t.paymentAccountLedger.types[v]])),
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label className="text-[11px] font-normal text-muted-foreground">
          {t.paymentAccountLedger.central.filters.accountLabel}
        </Label>
        <Select
          items={accountItems}
          value={value.paymentAccountId}
          onValueChange={(v) => set({ paymentAccountId: (v as string) ?? "" })}
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t.paymentAccountLedger.central.filters.allAccounts}</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.subname ? `${a.accountName} — ${a.subname}` : a.accountName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[11px] font-normal text-muted-foreground">
          {t.paymentAccountLedger.central.filters.typeLabel}
        </Label>
        <Select items={typeItems} value={value.type} onValueChange={(v) => set({ type: (v as string) ?? "" })}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t.paymentAccountLedger.central.filters.allTypes}</SelectItem>
            {ALL_TRANSACTION_TYPES.map((v) => (
              <SelectItem key={v} value={v}>
                {t.paymentAccountLedger.types[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[11px] font-normal text-muted-foreground">
          {t.paymentAccountLedger.central.filters.dateFromLabel}
        </Label>
        <Input
          type="date"
          value={value.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
          className="h-7 w-36 text-xs [color-scheme:dark]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[11px] font-normal text-muted-foreground">
          {t.paymentAccountLedger.central.filters.dateToLabel}
        </Label>
        <Input
          type="date"
          value={value.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
          className="h-7 w-36 text-xs [color-scheme:dark]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[11px] font-normal text-muted-foreground">
          {t.paymentAccountLedger.central.filters.amountMinLabel}
        </Label>
        <Input
          type="number"
          min="0"
          value={value.amountMin}
          onChange={(e) => set({ amountMin: e.target.value })}
          className="h-7 w-24 text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[11px] font-normal text-muted-foreground">
          {t.paymentAccountLedger.central.filters.amountMaxLabel}
        </Label>
        <Input
          type="number"
          min="0"
          value={value.amountMax}
          onChange={(e) => set({ amountMax: e.target.value })}
          className="h-7 w-24 text-xs"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-7" onClick={() => onChange(EMPTY_TRANSACTION_FILTERS)}>
          <X className="size-3.5" />
          {t.paymentAccountLedger.central.filters.clear}
        </Button>
      )}
    </div>
  );
}
