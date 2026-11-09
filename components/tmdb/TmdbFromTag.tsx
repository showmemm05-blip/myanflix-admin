"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";

interface TmdbFromTagProps {
  /**
   * `overlay` sits in the top-left corner of a picture (its parent must be
   * `relative`); `inline` is a line of text, as under the English
   * description.
   */
  variant?: "overlay" | "inline";
  className?: string;
}

/**
 * The small "From TMDB" mark (2026-11-06, the `EditMovie` and `SeriesInfo`
 * boards): on a poster or banner that was saved from TMDB, and under a
 * description that is still TMDB's own. It only says where the value came
 * from — uploading another picture, or typing in the box, makes it go.
 */
export function TmdbFromTag({ variant = "overlay", className }: TmdbFromTagProps) {
  const { t } = useLanguage();
  if (variant === "inline") {
    return <span className={cn("text-xs text-info", className)}>{t.tmdb.fromTmdb}</span>;
  }
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-info",
        className,
      )}
    >
      {t.tmdb.fromTmdb}
    </span>
  );
}

/**
 * How far down a FileUploadField's picture starts: its label (one line of
 * `text-sm leading-none`, 14 px) and the 6 px gap under it.
 */
const FIELD_LABEL_OFFSET = "top-[26px]";

/**
 * Wraps one picture field (components/movies/FileUploadField.tsx) and lays
 * the "From TMDB" tag over its picture while `fromTmdb` — the stored picture
 * came from TMDB and no new file has been picked. The field itself is not
 * changed: the tag is placed over it from outside, below the field's label.
 */
export function TmdbTaggedField({ fromTmdb, children }: { fromTmdb: boolean; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      {fromTmdb && <TmdbFromTag className={FIELD_LABEL_OFFSET} />}
    </div>
  );
}
