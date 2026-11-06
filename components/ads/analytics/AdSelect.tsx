"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/context/language-context";
import type { Ad } from "@/types/ad";

/** The select's "every ad" option — an empty id, which the queries drop. */
export const ALL_ADS = "";

interface AdSelectProps {
  /** The ads to offer (newest first, as getAds sends them); null while loading or refused. */
  ads: Ad[] | null;
  /** An ad id, or ALL_ADS. */
  value: string;
  onChange: (adId: string) => void;
  className?: string;
}

/**
 * "All ads / <title> / …" — the Ad results page's "Which ad" filter. An ad that is no
 * longer in the list (refused load, more than a page of ads) still shows as
 * its id rather than as "All ads", so the filter in force is never misstated.
 */
export function AdSelect({ ads, value, onChange, className = "w-64" }: AdSelectProps) {
  const { t } = useLanguage();
  const f = t.adsUi.results.filters;
  const items: Record<string, string> = { [ALL_ADS]: f.allAds };
  for (const ad of ads ?? []) items[ad.id] = ad.title;
  if (value && !(value in items)) items[value] = value;

  return (
    <Select items={items} value={value} onValueChange={(next) => onChange((next as string | null) ?? ALL_ADS)}>
      <SelectTrigger size="sm" className={className} aria-label={f.ad}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_ADS}>{f.allAds}</SelectItem>
        {(ads ?? []).map((ad) => (
          <SelectItem key={ad.id} value={ad.id}>
            {ad.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
