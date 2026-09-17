"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { actionLabel, targetTypeLabel } from "@/components/audit/auditFormat";
import type { TranslationShape } from "@/lib/i18n/translations";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_TARGET_TYPES,
  type AuditCatalogue,
  type AuditCatalogueAction,
} from "@/types/audit";

export interface AuditFilterValues {
  range: DateRangeValue;
  /** "" = no filter, for each of the three selects. */
  category: string;
  action: string;
  targetType: string;
  /** The raw, un-debounced search text — the page applies it after 300 ms. */
  search: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilterValues = {
  range: { from: "", to: "" },
  category: "",
  action: "",
  targetType: "",
  search: "",
};

/**
 * Until `GET /audit/catalogue` answers, the dropdowns are built from the
 * local transcription of the same catalogue; category is inferred from the
 * key's noun so the action list can still narrow by category.
 */
function localCatalogue(): AuditCatalogue {
  const nounCategory = (key: string): AuditCatalogueAction["category"] => {
    const noun = key.split(".")[0];
    if (noun === "user") return "USERS";
    if (["staff", "role", "level"].includes(noun)) return "STAFF";
    if (
      [
        "deposit",
        "withdrawal",
        "payment_account",
        "payment_method_type",
        "finance_settings",
        "subscription_plan",
      ].includes(noun)
    )
      return "FINANCE";
    if (["peak_users", "comment", "feedback"].includes(noun)) return "SYSTEM";
    return "CONTENT";
  };
  return {
    categories: [...AUDIT_CATEGORIES],
    actions: AUDIT_ACTIONS.map((key) => ({
      key,
      category: nounCategory(key),
      targetType: key.split(".")[0],
    })),
    targetTypes: [...AUDIT_TARGET_TYPES],
  };
}

export function AuditFilters({
  value,
  onChange,
  catalogue,
  t,
}: {
  value: AuditFilterValues;
  onChange: (next: AuditFilterValues) => void;
  catalogue: AuditCatalogue | null;
  t: TranslationShape;
}) {
  const f = t.audit.filters;
  const source = catalogue ?? localCatalogue();
  const set = (patch: Partial<AuditFilterValues>) => onChange({ ...value, ...patch });

  const hasFilters =
    !!value.range.from ||
    !!value.range.to ||
    !!value.category ||
    !!value.action ||
    !!value.targetType ||
    !!value.search;

  // The action list narrows to the chosen category; picking a category that
  // no longer contains the chosen action drops the action rather than
  // sending a contradictory pair to the server.
  const actions = value.category
    ? source.actions.filter((action) => action.category === value.category)
    : source.actions;

  const categoryItems: Record<string, string> = {
    "": f.all,
    ...Object.fromEntries(
      source.categories.map((category) => [category, t.audit.categories[category] ?? category]),
    ),
  };
  const actionItems: Record<string, string> = {
    "": f.all,
    ...Object.fromEntries(actions.map((action) => [action.key, actionLabel(t, action.key)])),
  };
  const targetTypeItems: Record<string, string> = {
    "": f.all,
    ...Object.fromEntries(source.targetTypes.map((type) => [type, targetTypeLabel(t, type)])),
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder={f.searchPlaceholder}
          aria-label={f.search}
          maxLength={200}
          className="h-8 bg-secondary/50 pl-9"
        />
      </div>

      <Select
        items={categoryItems}
        value={value.category}
        onValueChange={(next) => {
          const category = (next as string | null) ?? "";
          const actionStillValid =
            !category ||
            source.actions.some((a) => a.key === value.action && a.category === category);
          set({ category, action: actionStillValid ? value.action : "" });
        }}
      >
        <SelectTrigger size="sm" className="w-36" aria-label={f.category}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{f.all}</SelectItem>
          {source.categories.map((category) => (
            <SelectItem key={category} value={category}>
              {t.audit.categories[category] ?? category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={actionItems}
        value={value.action}
        onValueChange={(next) => set({ action: (next as string | null) ?? "" })}
      >
        <SelectTrigger size="sm" className="w-56" aria-label={f.action}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{f.all}</SelectItem>
          {actions.map((action) => (
            <SelectItem key={action.key} value={action.key}>
              {actionLabel(t, action.key)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={targetTypeItems}
        value={value.targetType}
        onValueChange={(next) => set({ targetType: (next as string | null) ?? "" })}
      >
        <SelectTrigger size="sm" className="w-44" aria-label={f.targetType}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{f.all}</SelectItem>
          {source.targetTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {targetTypeLabel(t, type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DateRangeFilter value={value.range} onChange={(range) => set({ range })} />

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => onChange(EMPTY_AUDIT_FILTERS)}
        >
          <X className="size-3.5" />
          {f.clear}
        </Button>
      )}
    </div>
  );
}
