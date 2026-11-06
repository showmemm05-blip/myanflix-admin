"use client";

import { Search } from "lucide-react";
import { ChoiceChips } from "@/components/ads/ChoiceChips";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/context/language-context";
import { AD_FORMATS, AD_LIVE_STATES, type AdFormat, type AdLiveState } from "@/types/ad";

/** The Type filter: every ad, video ads, or corner pictures — the server's `format`. */
export const AD_TYPE_FILTERS = ["ALL", ...AD_FORMATS] as const;
export type AdTypeFilter = "ALL" | AdFormat;

/**
 * The Status filter: every ad, or one of the backend's live states (the
 * server's `status` — LIVE / SCHEDULED / ENDED / OFF / NO_VIDEO, shown as
 * Active / Starts later / Finished / Turned off / Needs video or picture).
 */
export const AD_STATUS_FILTERS = ["ALL", ...AD_LIVE_STATES] as const;
export type AdStatusFilter = "ALL" | AdLiveState;

/** The backend's AdminAdQueryDto caps `search` at this (a 400 past it), so the box never holds more. */
export const AD_SEARCH_MAX_LENGTH = 100;

interface AdListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  type: AdTypeFilter;
  onTypeChange: (type: AdTypeFilter) => void;
  status: AdStatusFilter;
  onStatusChange: (status: AdStatusFilter) => void;
}

/**
 * The one toolbar over the ads (2026-11-04, the `Main` board): find by name,
 * then Type and Status as rows of chips with their names written beside
 * them. Every filter runs on the SERVER — the list is paged, so filtering
 * the loaded page would hide every match past the first page; the page
 * debounces the search and resets to page 1 on any change.
 */
export function AdListToolbar({ search, onSearchChange, type, onTypeChange, status, onStatusChange }: AdListToolbarProps) {
  const { t } = useLanguage();
  const l = t.adsUi.list;
  const typeOptions = AD_TYPE_FILTERS.map((value) => ({
    value,
    label: value === "ALL" ? l.all : t.adsUi.shared.formatsPlural[value],
  }));
  const statusOptions = AD_STATUS_FILTERS.map((value) => ({
    value,
    label: value === "ALL" ? l.all : l.statusFilters[value],
  }));
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          maxLength={AD_SEARCH_MAX_LENGTH}
          placeholder={l.search}
          aria-label={l.searchLabel}
          onChange={(e) => onSearchChange(e.target.value.slice(0, AD_SEARCH_MAX_LENGTH))}
          className="bg-secondary/50 pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground" aria-hidden>
          {l.typeLabel}
        </span>
        <ChoiceChips options={typeOptions} value={type} label={l.typeLabel} onChange={onTypeChange} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground" aria-hidden>
          {l.statusLabel}
        </span>
        <ChoiceChips options={statusOptions} value={status} label={l.statusLabel} onChange={onStatusChange} />
      </div>
    </div>
  );
}
