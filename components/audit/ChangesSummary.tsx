"use client";

import { formatChangeValue, truncate } from "@/components/audit/auditFormat";
import type { TranslationShape } from "@/lib/i18n/translations";
import type { AuditLogEntry } from "@/types/audit";

/** Lines a cell shows before folding the rest into "+N more". */
const VISIBLE_LINES = 2;
const VALUE_MAX = 40;
const EVENT_LINE_MAX = 90;

/**
 * The "Changes" cell: the first two `field: from → to` lines of an update,
 * or — for creates, deletes and pure events, which carry no diff — a
 * one-liner built from `metadata` so the row still says something about
 * what happened (a wallet adjustment's amount, a bulk reorder's count).
 */
export function ChangesSummary({ entry, t }: { entry: AuditLogEntry; t: TranslationShape }) {
  const none = t.audit.details.none;
  const changes = entry.changes ?? [];

  if (changes.length > 0) {
    const hidden = changes.length - VISIBLE_LINES;
    return (
      <div className="flex max-w-72 flex-col gap-0.5 text-xs">
        {changes.slice(0, VISIBLE_LINES).map((change) => (
          <div key={change.field} className="flex min-w-0 items-baseline gap-1">
            <span className="shrink-0 font-medium">{change.field}:</span>
            <span
              className="truncate text-muted-foreground"
              title={`${formatChangeValue(change.from, none)} → ${formatChangeValue(change.to, none)}`}
            >
              {truncate(formatChangeValue(change.from, none), VALUE_MAX)}
              <span className="mx-1">→</span>
              {truncate(formatChangeValue(change.to, none), VALUE_MAX)}
            </span>
          </div>
        ))}
        {hidden > 0 && (
          <span className="text-muted-foreground">{t.audit.changesSummary.more(hidden)}</span>
        )}
      </div>
    );
  }

  const metadata = entry.metadata ?? {};
  // Scalars only: id lists and nested objects say nothing at a glance, and
  // the dialog pretty-prints the full metadata anyway.
  const line = Object.entries(metadata)
    .filter(([, value]) => value === null || typeof value !== "object" || Array.isArray(value))
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${key}: ${value.length}`
        : `${key}: ${formatChangeValue(value, none)}`,
    )
    .join(" · ");

  if (!line) {
    return (
      <span className="text-xs text-muted-foreground">{t.audit.changesSummary.noChanges}</span>
    );
  }
  return (
    <span className="block max-w-72 truncate text-xs text-muted-foreground" title={line}>
      {truncate(line, EVENT_LINE_MAX)}
    </span>
  );
}
