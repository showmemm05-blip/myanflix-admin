"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/context/language-context";
import { CLIENT_PLATFORMS, type ClientPlatform } from "@/types/tracking";

/**
 * The Website / Mobile / Unknown filter, in one place because three of the
 * six Tracking screens carry the identical control and a fourth copy of the
 * same twenty lines is how the three of them start disagreeing about what
 * "all platforms" means.
 *
 * The empty string is "no filter" — `ClientPlatform` has no such member and
 * the query type takes `undefined`, so the caller converts at the edge.
 *
 * The two labels are passed in rather than read from `t.tracking.platform`
 * because each page has its own `filters.platformLabel` / `platformAll`
 * strings; the OPTION labels come from `t.tracking.platform[…]`, which is
 * indexed by the wire enum and must stay identical everywhere.
 */
export function PlatformFilter({
  value,
  onChange,
  label,
  allLabel,
  className = "w-44",
}: {
  value: ClientPlatform | "";
  onChange: (next: ClientPlatform | "") => void;
  label: string;
  allLabel: string;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <Select
      items={{
        "": allLabel,
        ...Object.fromEntries(CLIENT_PLATFORMS.map((platform) => [platform, t.tracking.platform[platform]])),
      }}
      value={value}
      onValueChange={(next) => onChange((next as ClientPlatform | "") ?? "")}
    >
      <SelectTrigger size="sm" className={className} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{allLabel}</SelectItem>
        {CLIENT_PLATFORMS.map((platform) => (
          <SelectItem key={platform} value={platform}>
            {t.tracking.platform[platform]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
