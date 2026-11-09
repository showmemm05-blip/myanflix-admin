/**
 * The rules of the "Review details" step (2026-11-06,
 * docs/movie-details-tmdb-2026-11-06/PLAN.md §3 and §6.4): which lines get a
 * switch, how each starts, what Apply sends.
 *
 * The backend's preview says how every detail stands (`empty`, `auto`,
 * `hand`, `same`, `none`) and which would be written without asking
 * (`defaultOn`). Staff apply writes exactly the fields left switched on —
 * that is the whole "human over automatic" rule, so the admin never decides
 * a default of its own: it only refuses a switch where there is nothing to
 * write.
 *
 * One thing an Apply does without being asked: a detail the previous match
 * filled in, that staff never changed and that this TMDB entry has nothing
 * for, is taken back — it belonged to the other film. Such a line has no
 * switch and is never sent (the server takes it back by itself, and leaves
 * it alone if staff typed something meanwhile); the review says so on the
 * line (`lineClears`) and the summary afterwards (`removedFields`).
 *
 * Pure and with type imports only, so Node's test runner loads the file as
 * it is (tmdbReview.test.ts).
 */
import type { TmdbField, TmdbFillReport, TmdbPreview, TmdbPreviewLine, TmdbPreviewValue } from "@/types/tmdb";

/**
 * The order of the review's lines (the approved Review board): the text
 * details, the two pictures, the length last. Categories and the cast are
 * not lines: each has its own box under the list.
 */
export const TMDB_LINE_ORDER: readonly TmdbField[] = [
  "title",
  "description",
  "releaseYear",
  "genre",
  "country",
  "language",
  "director",
  "ageRating",
  "poster",
  "cover",
  "duration",
];

/** The two details shown as a box of their own rather than a line. */
export const TMDB_BOX_FIELDS: readonly TmdbField[] = ["categories", "cast"];

/** Which note, if any, stands under a line. */
export type TmdbLineNote = "hand" | "same" | "none" | "clears" | "measured";

/** How many of the cast the Actors box shows before "+ N more". */
export const TMDB_CAST_COLLAPSED_COUNT = 4;

/** True for "", null, an empty list and 0 (the runtime's "never measured"): nothing is there. */
export function isEmptyValue(value: TmdbPreviewValue): boolean {
  if (value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return value === 0;
  return value.length === 0;
}

/**
 * A title's length that is already there and is not the automatic value: it
 * was measured from the real video (or typed by staff who know it), so the
 * review never offers to replace it — the line says "Measured from your
 * video. It stays." and has no switch.
 */
export function isMeasuredLength(line: TmdbPreviewLine): boolean {
  return line.field === "duration" && (line.state === "hand" || line.state === "same") && !isEmptyValue(line.current);
}

/**
 * Whether the line can be switched at all: TMDB must have a value that is
 * not already ours. `empty`, `auto` and `hand` qualify; `same` and `none` are
 * shown greyed with no switch, and so is a measured length.
 */
export function lineHasSwitch(line: TmdbPreviewLine): boolean {
  if (isMeasuredLength(line)) return false;
  return line.state === "empty" || line.state === "auto" || line.state === "hand";
}

/**
 * Whether Apply takes this line's value back: TMDB has nothing for it
 * (`none`) and what the title holds is still the automatic value — one of
 * the state's `autoFields` — so it came from the match being replaced. The
 * name and the year are never taken back (a title always has both), and a
 * value staff typed is not in `autoFields`, so it stays.
 */
export function lineClears(line: TmdbPreviewLine, autoFields: readonly TmdbField[]): boolean {
  if (line.state !== "none" || line.field === "title" || line.field === "releaseYear") return false;
  return autoFields.includes(line.field);
}

/** The lines Apply takes back, by field — there is something to apply even with every switch off. */
export function clearingFields(preview: TmdbPreview, autoFields: readonly TmdbField[]): TmdbField[] {
  return preview.fields.filter((line) => lineClears(line, autoFields)).map((line) => line.field);
}

/**
 * The note under the line, or null for a plain one (`empty` and `auto` need
 * no explaining). `autoFields` are the fields of the title that still hold
 * their automatic value (the title's TMDB state); without them a line TMDB
 * has nothing for only says so.
 */
export function lineNote(line: TmdbPreviewLine, autoFields: readonly TmdbField[] = []): TmdbLineNote | null {
  if (isMeasuredLength(line)) return "measured";
  if (lineClears(line, autoFields)) return "clears";
  if (line.state === "hand" || line.state === "same" || line.state === "none") return line.state;
  return null;
}

/** The preview's lines in the board's order; a field this build does not know goes last, so nothing is hidden. */
export function orderedLines(preview: TmdbPreview): TmdbPreviewLine[] {
  const rank = (field: TmdbField) => {
    const index = TMDB_LINE_ORDER.indexOf(field);
    return index === -1 ? TMDB_LINE_ORDER.length : index;
  };
  return preview.fields
    .filter((line) => !TMDB_BOX_FIELDS.includes(line.field))
    .sort((a, b) => rank(a.field) - rank(b.field));
}

/** The line of one field, or null when the preview does not carry it (a series has no length, director or age rating). */
export function lineOf(preview: TmdbPreview, field: TmdbField): TmdbPreviewLine | null {
  return preview.fields.find((line) => line.field === field) ?? null;
}

/** What staff flipped by hand, by field; a field that is absent still follows the preview's own default. */
export type TmdbSwitches = Partial<Record<TmdbField, boolean>>;

/** Whether the line is on: staff's own choice when they made one, else the backend's default. Never on without a switch. */
export function isLineOn(line: TmdbPreviewLine, switches: TmdbSwitches): boolean {
  if (!lineHasSwitch(line)) return false;
  return switches[line.field] ?? line.defaultOn;
}

/** Exactly the fields Apply sends, in the preview's own order. */
export function selectedFields(preview: TmdbPreview, switches: TmdbSwitches): TmdbField[] {
  return preview.fields.filter((line) => isLineOn(line, switches)).map((line) => line.field);
}

/**
 * The details an Apply took back, read off its report: the server reports a
 * field that was not sent only when it emptied it — TMDB has no value and
 * the old one was the previous match's. (Had staff typed something
 * meanwhile, the row says `hand`: it stays.) A field that was sent and
 * came back `no_value` is reported as before: TMDB has no value for it.
 */
export function removedFields(report: TmdbFillReport, sent: readonly TmdbField[]): TmdbField[] {
  return report.skipped
    .filter((entry) => entry.reason === "no_value" && !sent.includes(entry.field))
    .map((entry) => entry.field);
}
