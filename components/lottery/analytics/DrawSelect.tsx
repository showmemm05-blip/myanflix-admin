"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/context/language-context";
import { drawOptionLabel } from "@/components/lottery/analytics/format";
import type { LotteryAdminDraw } from "@/types/lottery";

/** The select's "every draw" option — an empty id, which the queries drop. */
export const ALL_DRAWS = "";

interface DrawSelectProps {
  /** The draws to offer (newest first, as listDraws sends them); null while loading or refused. */
  draws: LotteryAdminDraw[] | null;
  /** A draw id, or ALL_DRAWS. */
  value: string;
  onChange: (drawId: string) => void;
  className?: string;
}

/**
 * "All draws / Draw 3 · 31 Oct (Open) / Draw 2 · 17 Oct / …" — the one
 * select both analytics pages share. A draw that is no longer in the list
 * (refused load, more than 100 draws) still shows as its id rather than as
 * "All draws", so the filter in force is never misstated.
 */
export function DrawSelect({ draws, value, onChange, className = "w-56" }: DrawSelectProps) {
  const { t } = useLanguage();
  const f = t.lottery.analytics.filters;
  const items: Record<string, string> = { [ALL_DRAWS]: f.allDraws };
  for (const draw of draws ?? []) items[draw.id] = drawOptionLabel(t, draw);
  if (value && !(value in items)) items[value] = value;

  return (
    <Select items={items} value={value} onValueChange={(next) => onChange((next as string | null) ?? ALL_DRAWS)}>
      <SelectTrigger size="sm" className={className} aria-label={f.draw}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_DRAWS}>{f.allDraws}</SelectItem>
        {(draws ?? []).map((draw) => (
          <SelectItem key={draw.id} value={draw.id}>
            {drawOptionLabel(t, draw)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
