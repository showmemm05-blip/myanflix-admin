/**
 * The "Review details" step's rules (components/tmdb/tmdbReview.ts): which
 * lines get a switch, how each one starts, and that Apply sends exactly the
 * fields left switched on — a detail staff changed by hand is off until they
 * switch it on, and a length measured from the video is never offered. Also
 * what a change of match takes back: a detail of the previous match that the
 * new TMDB entry has nothing for, said on its line and in the summary.
 *
 * Runs on Node's own test runner: `npm test`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type {
  TmdbField,
  TmdbFillReport,
  TmdbPreview,
  TmdbPreviewLine,
  TmdbPreviewLineState,
  TmdbPreviewValue,
} from "@/types/tmdb";

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way.
const load = createRequire(import.meta.url);
const {
  clearingFields,
  isEmptyValue,
  isLineOn,
  isMeasuredLength,
  lineClears,
  lineHasSwitch,
  lineNote,
  lineOf,
  orderedLines,
  removedFields,
  selectedFields,
} = load("./tmdbReview.ts") as typeof import("./tmdbReview");

function line(
  field: TmdbField,
  state: TmdbPreviewLineState,
  current: TmdbPreviewValue = null,
  proposed: TmdbPreviewValue = "from TMDB",
): TmdbPreviewLine {
  return { field, current, proposed, state, defaultOn: state === "empty" || state === "auto" };
}

/** The approved Review board: Parasite picked for a fresh upload whose banner staff replaced. */
function preview(fields: TmdbPreviewLine[]): TmdbPreview {
  return {
    tmdbId: 496243,
    match: { title: "Parasite", year: 2019 },
    fields,
    cast: [],
    categories: { add: [], unmatched: [] },
  };
}

const board = preview([
  line("cast", "empty", [], ["Song Kang-ho", "Lee Sun-kyun"]),
  line("duration", "same", 132, 132),
  line("cover", "hand", "http://cache.example/images/movie/own.jpg", "https://image.tmdb.org/t/p/w780/b.jpg"),
  line("title", "auto", "Parasite 2019 Korean 1080p", "Parasite"),
  line("description", "empty", "", "A poor family finds work in the home of a rich family."),
  line("categories", "empty", [], ["Thriller", "Drama"]),
  line("ageRating", "none", null, null),
  line("poster", "empty", null, "https://image.tmdb.org/t/p/w342/p.jpg"),
]);

describe("which lines can be switched", () => {
  it("empty, automatic and hand-changed details get a switch; same and nothing-on-TMDB do not", () => {
    assert.equal(lineHasSwitch(line("genre", "empty")), true);
    assert.equal(lineHasSwitch(line("genre", "auto", "Drama")), true);
    assert.equal(lineHasSwitch(line("genre", "hand", "Drama")), true);
    assert.equal(lineHasSwitch(line("genre", "same", "Drama", "Drama")), false);
    assert.equal(lineHasSwitch(line("genre", "none", "Drama", null)), false);
  });

  it("a length that is already there is never offered — it was measured from the video", () => {
    assert.equal(isMeasuredLength(line("duration", "hand", 131, 132)), true);
    assert.equal(lineHasSwitch(line("duration", "hand", 131, 132)), false);
    assert.equal(lineNote(line("duration", "hand", 131, 132)), "measured");
    assert.equal(lineNote(line("duration", "same", 132, 132)), "measured");
  });

  it("a length never measured, or one TMDB filled before, can be switched", () => {
    assert.equal(lineHasSwitch(line("duration", "empty", 0, 132)), true);
    assert.equal(lineHasSwitch(line("duration", "auto", 130, 132)), true);
    assert.equal(lineNote(line("duration", "empty", 0, 132)), null);
  });

  it("only the length is treated as measured", () => {
    assert.equal(isMeasuredLength(line("releaseYear", "hand", 2018, 2019)), false);
    assert.equal(lineHasSwitch(line("releaseYear", "hand", 2018, 2019)), true);
  });
});

describe("the note under a line", () => {
  it("hand-changed, already the same and nothing on TMDB each say so; the others need no note", () => {
    assert.equal(lineNote(line("genre", "hand", "Drama")), "hand");
    assert.equal(lineNote(line("genre", "same", "Drama", "Drama")), "same");
    assert.equal(lineNote(line("genre", "none", "Drama", null)), "none");
    assert.equal(lineNote(line("genre", "empty")), null);
    assert.equal(lineNote(line("genre", "auto", "Drama")), null);
  });
});

describe("how the switches start, and what Apply sends", () => {
  it("empty and automatic details are on, a hand-changed one is off", () => {
    assert.equal(isLineOn(line("genre", "empty"), {}), true);
    assert.equal(isLineOn(line("genre", "auto", "Drama"), {}), true);
    assert.equal(isLineOn(line("genre", "hand", "Drama"), {}), false);
  });

  it("staff's own flip wins over the default, both ways", () => {
    assert.equal(isLineOn(line("genre", "hand", "Drama"), { genre: true }), true);
    assert.equal(isLineOn(line("genre", "empty"), { genre: false }), false);
  });

  it("a line with no switch is never on, whatever was flipped", () => {
    assert.equal(isLineOn(line("genre", "same", "Drama", "Drama"), { genre: true }), false);
    assert.equal(isLineOn(line("duration", "hand", 131, 132), { duration: true }), false);
  });

  it("untouched, Apply sends exactly the defaults — in the preview's order", () => {
    assert.deepEqual(selectedFields(board, {}), ["cast", "title", "description", "categories", "poster"]);
  });

  it("switching the hand-changed banner on adds it; switching the name off removes it", () => {
    assert.deepEqual(selectedFields(board, { cover: true, title: false }), [
      "cast",
      "cover",
      "description",
      "categories",
      "poster",
    ]);
  });

  it("everything switched off sends nothing", () => {
    const off = { cast: false, title: false, description: false, categories: false, poster: false };
    assert.deepEqual(selectedFields(board, off), []);
  });
});

describe("a change of match takes back what the new entry has nothing for", () => {
  // The folder was matched to the wrong film, which filled an age rating, a
  // banner, categories and a director. The right film has none of the first
  // three on TMDB; the director was since corrected by hand.
  const changed = preview([
    line("title", "auto", "The Wrong Film", "The Right Film"),
    line("releaseYear", "none", 2019, null),
    line("ageRating", "none", "R", null),
    line("cover", "none", "http://cache.example/images/movie/tmdb-old.jpg", null),
    line("categories", "none", ["Horror"], []),
    line("director", "none", "Typed By Staff", null),
    line("genre", "none", "", null),
  ]);
  /** The title's TMDB state: what still holds its automatic value. */
  const autoFields: TmdbField[] = ["title", "releaseYear", "ageRating", "cover", "categories"];

  it("a line TMDB has nothing for, still holding the previous match's value, will be cleared", () => {
    assert.equal(lineClears(line("ageRating", "none", "R", null), autoFields), true);
    assert.equal(lineNote(line("ageRating", "none", "R", null), autoFields), "clears");
    assert.deepEqual(clearingFields(changed, autoFields), ["ageRating", "cover", "categories"]);
  });

  it("what staff typed is not automatic, so it stays and the line only says TMDB has nothing", () => {
    assert.equal(lineClears(line("director", "none", "Typed By Staff", null), autoFields), false);
    assert.equal(lineNote(line("director", "none", "Typed By Staff", null), autoFields), "none");
  });

  it("nothing there = nothing to take back", () => {
    assert.equal(lineClears(line("genre", "none", "", null), autoFields), false);
  });

  it("the name and the year are never taken back, automatic or not", () => {
    assert.equal(lineClears(line("releaseYear", "none", 2019, null), autoFields), false);
    assert.equal(lineClears(line("title", "none", "The Wrong Film", null), autoFields), false);
  });

  it("only a line TMDB has nothing for is cleared: an automatic one with a value is replaced, not removed", () => {
    assert.equal(lineClears(line("genre", "auto", "Horror", "Drama"), ["genre"]), false);
    assert.equal(lineNote(line("genre", "auto", "Horror", "Drama"), ["genre"]), null);
  });

  it("without the title's state nothing is known to be automatic: the old note stands", () => {
    assert.equal(lineNote(line("ageRating", "none", "R", null)), "none");
    assert.deepEqual(clearingFields(changed, []), []);
  });

  it("a cleared line has no switch and is never sent — the server takes it back by itself", () => {
    assert.equal(lineHasSwitch(line("ageRating", "none", "R", null)), false);
    assert.deepEqual(selectedFields(changed, {}), ["title"]);
    assert.deepEqual(selectedFields(changed, { ageRating: true, cover: true }), ["title"]);
  });

  it("with every switch off there is still something to apply", () => {
    assert.deepEqual(selectedFields(changed, { title: false }), []);
    assert.equal(clearingFields(changed, autoFields).length > 0, true);
  });
});

describe("the summary: removed, or only not filled", () => {
  const report = (skipped: TmdbFillReport["skipped"]): TmdbFillReport => ({
    filled: ["title"],
    skipped,
    actors: { reused: 0, created: 0, skipped: [] },
    categories: { added: [], unmatched: [] },
  });

  it("a detail the Apply never named and the server reports as 'no value' was taken back", () => {
    const answered = report([
      { field: "ageRating", reason: "no_value" },
      { field: "cover", reason: "no_value" },
    ]);
    assert.deepEqual(removedFields(answered, ["title"]), ["ageRating", "cover"]);
  });

  it("a detail that was named and has no value on TMDB was only not filled", () => {
    const answered = report([{ field: "cast", reason: "no_value" }]);
    assert.deepEqual(removedFields(answered, ["title", "cast"]), []);
  });

  it("an unnamed detail staff typed into meanwhile comes back as theirs: it stays", () => {
    const answered = report([
      { field: "director", reason: "hand" },
      { field: "poster", reason: "image_failed" },
    ]);
    assert.deepEqual(removedFields(answered, ["title"]), []);
  });
});

describe("the order of the lines", () => {
  it("follows the board, and keeps categories and the cast out — each has its own box", () => {
    assert.deepEqual(
      orderedLines(board).map((l) => l.field),
      ["title", "description", "ageRating", "poster", "cover", "duration"],
    );
  });

  it("a field this build does not know goes last instead of disappearing", () => {
    const withNew = preview([line("tagline" as TmdbField, "empty"), line("title", "auto", "Old", "New")]);
    assert.deepEqual(
      orderedLines(withNew).map((l) => l.field),
      ["title", "tagline"],
    );
  });

  it("lineOf finds one field, or null when the preview has none (a series has no length)", () => {
    assert.equal(lineOf(board, "cast")?.state, "empty");
    assert.equal(lineOf(board, "director"), null);
  });
});

describe("isEmptyValue", () => {
  it("null, blank text, an empty list and a runtime of 0 are all 'nothing there'", () => {
    assert.equal(isEmptyValue(null), true);
    assert.equal(isEmptyValue("  "), true);
    assert.equal(isEmptyValue([]), true);
    assert.equal(isEmptyValue(0), true);
    assert.equal(isEmptyValue("Drama"), false);
    assert.equal(isEmptyValue(2019), false);
    assert.equal(isEmptyValue(["Drama"]), false);
  });
});
