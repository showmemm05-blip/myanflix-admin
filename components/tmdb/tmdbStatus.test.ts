/**
 * The TMDB status badge (components/tmdb/tmdbStatus.ts): each of the six
 * lookup statuses gets its look, its colour, its words and the one button
 * that goes with it, and a failed lookup says why in its own words.
 *
 * Runs on Node's own test runner: `npm test`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { TmdbLookupError, TmdbLookupStatus } from "@/types/tmdb";
import type { TmdbAction } from "./tmdbStatus";

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way.
const load = createRequire(import.meta.url);
const { tmdbActionOpensDialog, tmdbBadgeOf } = load("./tmdbStatus.ts") as typeof import("./tmdbStatus");

describe("tmdbBadgeOf — the six looks", () => {
  it("PENDING: blue 'Finding details…', nothing to press", () => {
    assert.deepEqual(tmdbBadgeOf("PENDING"), { look: "finding", label: "finding", tone: "info", action: null });
  });

  it("MATCHED: green 'Details from TMDB', nothing to press", () => {
    assert.deepEqual(tmdbBadgeOf("MATCHED"), { look: "matched", label: "matched", tone: "success", action: null });
  });

  it("NEEDS_PICK: amber 'Several matches' with Pick a match", () => {
    assert.deepEqual(tmdbBadgeOf("NEEDS_PICK"), {
      look: "needsPick",
      label: "needsPick",
      tone: "warning",
      action: "pick",
    });
  });

  it("NOT_FOUND: grey 'Not found on TMDB' with Search TMDB", () => {
    assert.deepEqual(tmdbBadgeOf("NOT_FOUND"), {
      look: "notFound",
      label: "notFound",
      tone: "neutral",
      action: "search",
    });
  });

  it("FAILED: red with Try again", () => {
    const badge = tmdbBadgeOf("FAILED", "unreachable");
    assert.equal(badge.look, "failed");
    assert.equal(badge.tone, "danger");
    assert.equal(badge.action, "retry");
  });

  it("NONE: no badge, and Find details for the row menu", () => {
    assert.deepEqual(tmdbBadgeOf("NONE"), { look: "none", label: null, tone: null, action: "lookup" });
  });

  it("a status this build does not know draws nothing rather than a wrong badge", () => {
    assert.equal(tmdbBadgeOf("SOMETHING_NEW" as TmdbLookupStatus).look, "none");
  });

  it("every status has exactly one look", () => {
    const statuses: TmdbLookupStatus[] = ["NONE", "PENDING", "MATCHED", "NEEDS_PICK", "NOT_FOUND", "FAILED"];
    const looks = statuses.map((status) => tmdbBadgeOf(status).look);
    assert.equal(new Set(looks).size, statuses.length);
  });
});

describe("tmdbBadgeOf — why a lookup failed", () => {
  const cases: [TmdbLookupError | null, string][] = [
    ["unreachable", "unreachable"],
    ["rate_limited", "busy"],
    ["key_rejected", "keyRejected"],
    ["interrupted", "interrupted"],
    ["internal", "failed"],
    [null, "failed"],
  ];
  for (const [error, label] of cases) {
    it(`${error ?? "no reason"} → "${label}"`, () => {
      assert.equal(tmdbBadgeOf("FAILED", error).label, label);
    });
  }

  it("an unknown reason falls back to the plain words", () => {
    assert.equal(tmdbBadgeOf("FAILED", "quota_gone" as TmdbLookupError).label, "failed");
  });

  it("the reason only matters for a failed lookup", () => {
    assert.equal(tmdbBadgeOf("MATCHED", "unreachable").label, "matched");
  });
});

describe("tmdbActionOpensDialog", () => {
  it("pick, search, change and refill open the dialog; the others run in the background", () => {
    const opens: TmdbAction[] = ["pick", "search", "change", "refill"];
    const background: TmdbAction[] = ["lookup", "retry", "refresh"];
    for (const action of opens) assert.equal(tmdbActionOpensDialog(action), true, action);
    for (const action of background) assert.equal(tmdbActionOpensDialog(action), false, action);
  });
});
