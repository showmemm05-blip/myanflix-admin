"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEDIA_TYPES, type MediaType } from "@/lib/constants/movie-options";
import { useLanguage } from "@/lib/context/language-context";
import type { TranslationShape } from "@/lib/i18n/translations";

/** The Select value that stands for "no type" — the form then sends "", which the backend stores as null. */
const NOT_SET = "__none__";

/** A stored type word in the admin's language; a word outside MEDIA_TYPES shows as itself. */
export function mediaTypeName(t: TranslationShape, value: string): string {
  return t.movies.mediaType.names[value as MediaType] ?? value;
}

/**
 * The movie / series TYPE picker (owner, 2026-10-27: "English movies, Korean
 * movies…"): Not set or one of MEDIA_TYPES. The value is the plain word the
 * backend keeps in `country`; viewers see it as "Korean movie" / "Korean
 * series". `items` lets the closed trigger show the word, not the raw value.
 */
export function MediaTypeSelect({
  kind,
  value,
  onChange,
  disabled,
}: {
  kind: "movie" | "series";
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const words: string[] = [...MEDIA_TYPES];
  if (value && !words.includes(value)) words.push(value);
  const items: Record<string, string> = { [NOT_SET]: t.movies.mediaType.notSet };
  for (const word of words) items[word] = mediaTypeName(t, word);

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{kind === "series" ? t.movies.mediaType.seriesLabel : t.movies.mediaType.movieLabel}</Label>
      <Select
        items={items}
        value={value ?? NOT_SET}
        onValueChange={(v) => v && onChange(v === NOT_SET ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([v, label]) => (
            <SelectItem key={v} value={v}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
