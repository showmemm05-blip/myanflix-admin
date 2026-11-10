/**
 * Reading TMDB lookup states for a list (components/tmdb/tmdbPolling.ts):
 * which rows keep the 4-second poll alive, when the 3 minutes are up, how
 * a lookup the page just started stays "Finding details…" until the server
 * has claimed the row, which failed reads are asked again, what a page
 * takes from the states while TMDB is not connected (the folder names),
 * when a list row is older than the details TMDB filled in for it, and how
 * a list swaps or drops one row without losing what another answer changed.
 *
 * Runs on Node's own test runner: `npm test`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { TmdbLookupStatus, TmdbMovieState } from "@/types/tmdb";

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way.
const load = createRequire(import.meta.url);
const {
  TMDB_PENDING_GRACE_MS,
  TMDB_POLL_INTERVAL_MS,
  TMDB_POLL_LIMIT_MS,
  folderNamesOf,
  idsKeyOf,
  mergeTmdbStates,
  nextReadOf,
  pendingIdsOf,
  pendingPlaceholder,
  pollingExpired,
  rowBehindItsDetails,
  rowRemoved,
  rowReplaced,
  settledBetween,
  stateReadWorthRetrying,
  tmdbStatesUse,
} = load("./tmdbPolling.ts") as typeof import("./tmdbPolling");

const NOW = Date.UTC(2026, 10, 6, 7, 30);

function state(movieId: string, status: TmdbLookupStatus, overrides: Partial<TmdbMovieState> = {}): TmdbMovieState {
  return {
    movieId,
    status,
    error: status === "FAILED" ? "unreachable" : null,
    tmdbId: status === "MATCHED" ? 27205 : null,
    match: status === "MATCHED" ? { title: "Inception", year: 2010 } : null,
    fetchedAt: status === "MATCHED" ? "2026-11-06T07:00:00.000Z" : null,
    sourceName: "Inception.2010.1080p.BluRay",
    search: { query: "Inception", year: 2010 },
    images: { poster: "none", cover: "none" },
    autoFields: [],
    ...overrides,
  };
}

const none = new Map<string, TmdbMovieState>();
const noMarks = new Map<string, number>();

describe("the timing", () => {
  it("every 4 seconds, for 3 minutes", () => {
    assert.equal(TMDB_POLL_INTERVAL_MS, 4_000);
    assert.equal(TMDB_POLL_LIMIT_MS, 180_000);
  });

  it("pollingExpired turns true exactly at the limit", () => {
    assert.equal(pollingExpired(NOW, NOW + TMDB_POLL_LIMIT_MS - 1), false);
    assert.equal(pollingExpired(NOW, NOW + TMDB_POLL_LIMIT_MS), true);
  });
});

describe("idsKeyOf", () => {
  it("the same rows in another order, or named twice, are the same question", () => {
    assert.equal(idsKeyOf(["b", "a", "b"]), "a,b");
    assert.equal(idsKeyOf(["a", "b"]), idsKeyOf(["b", "a"]));
    assert.equal(idsKeyOf([]), "");
  });
});

describe("mergeTmdbStates — plain reads", () => {
  it("the first read: every row as the server says, and the pending ones to ask again", () => {
    const merged = mergeTmdbStates(
      none,
      [state("a", "MATCHED"), state("b", "PENDING"), state("c", "NOT_FOUND")],
      noMarks,
      ["a", "b", "c"],
      NOW,
    );
    assert.deepEqual([...merged.states.keys()], ["a", "b", "c"]);
    assert.deepEqual(merged.pendingIds, ["b"]);
    assert.deepEqual(merged.settledMarks, []);
  });

  it("a poll that asked only for the pending row keeps the others as they were", () => {
    const first = mergeTmdbStates(none, [state("a", "MATCHED"), state("b", "PENDING")], noMarks, ["a", "b"], NOW);
    const second = mergeTmdbStates(first.states, [state("b", "NEEDS_PICK")], noMarks, ["a", "b"], NOW + 4_000);
    assert.equal(second.states.get("a")?.status, "MATCHED");
    assert.equal(second.states.get("b")?.status, "NEEDS_PICK");
    assert.deepEqual(second.pendingIds, []);
  });

  it("a row that left the page is dropped, so it cannot keep the poll alive", () => {
    const first = mergeTmdbStates(none, [state("a", "PENDING"), state("b", "PENDING")], noMarks, ["a", "b"], NOW);
    const second = mergeTmdbStates(first.states, [state("b", "PENDING")], noMarks, ["b"], NOW + 4_000);
    assert.deepEqual([...second.states.keys()], ["b"]);
    assert.deepEqual(second.pendingIds, ["b"]);
  });

  it("an answer for a movie nobody asked about is ignored", () => {
    const merged = mergeTmdbStates(none, [state("z", "PENDING")], noMarks, ["a"], NOW);
    assert.equal(merged.states.size, 0);
    assert.deepEqual(merged.pendingIds, []);
  });

  it("nothing pending = nothing to ask again", () => {
    const merged = mergeTmdbStates(none, [state("a", "MATCHED"), state("b", "FAILED")], noMarks, ["a", "b"], NOW);
    assert.deepEqual(merged.pendingIds, []);
  });
});

describe("mergeTmdbStates — a lookup the page started itself", () => {
  it("stays 'Finding details…' over a server NONE inside the grace window", () => {
    const marks = new Map([["a", NOW]]);
    const merged = mergeTmdbStates(none, [state("a", "NONE")], marks, ["a"], NOW + 1_000);
    assert.equal(merged.states.get("a")?.status, "PENDING");
    assert.deepEqual(merged.pendingIds, ["a"]);
    assert.deepEqual(merged.settledMarks, []);
  });

  it("the server's own word ends the mark: PENDING, then the result", () => {
    const marks = new Map([["a", NOW]]);
    const claimed = mergeTmdbStates(none, [state("a", "PENDING")], marks, ["a"], NOW + 1_000);
    assert.equal(claimed.states.get("a")?.status, "PENDING");
    assert.deepEqual(claimed.settledMarks, ["a"]);

    const done = mergeTmdbStates(claimed.states, [state("a", "MATCHED")], noMarks, ["a"], NOW + 5_000);
    assert.equal(done.states.get("a")?.status, "MATCHED");
    assert.deepEqual(done.pendingIds, []);
  });

  it("a lookup that never started is believed after the grace window", () => {
    const marks = new Map([["a", NOW]]);
    const merged = mergeTmdbStates(none, [state("a", "NONE")], marks, ["a"], NOW + TMDB_PENDING_GRACE_MS);
    assert.equal(merged.states.get("a")?.status, "NONE");
    assert.deepEqual(merged.pendingIds, []);
    assert.deepEqual(merged.settledMarks, ["a"]);
  });

  it("a marked row the server says nothing about stops showing 'Finding details…' once its window is over", () => {
    const marks = new Map([["a", NOW]]);
    const shown = new Map([["a", pendingPlaceholder("a")]]);

    const early = mergeTmdbStates(shown, [], marks, ["a"], NOW + 4_000);
    assert.equal(early.states.get("a")?.status, "PENDING");
    assert.deepEqual(early.settledMarks, []);

    const late = mergeTmdbStates(shown, [], marks, ["a"], NOW + TMDB_PENDING_GRACE_MS);
    assert.equal(late.states.has("a"), false);
    assert.deepEqual(late.pendingIds, []);
    assert.deepEqual(late.settledMarks, ["a"]);
  });

  it("a mark for a row that left the page is forgotten", () => {
    const marks = new Map([["gone", NOW]]);
    const merged = mergeTmdbStates(none, [state("a", "MATCHED")], marks, ["a"], NOW + 1_000);
    assert.deepEqual(merged.settledMarks, ["gone"]);
  });
});

describe("pendingPlaceholder / pendingIdsOf", () => {
  it("the placeholder is a pending row with nothing else known", () => {
    const placeholder = pendingPlaceholder("a");
    assert.equal(placeholder.movieId, "a");
    assert.equal(placeholder.status, "PENDING");
    assert.equal(placeholder.match, null);
    assert.deepEqual(pendingIdsOf(new Map([["a", placeholder]])), ["a"]);
  });
});

describe("settledBetween", () => {
  it("names the rows whose lookup just ended, with their result", () => {
    const before = new Map([
      ["a", state("a", "PENDING")],
      ["b", state("b", "PENDING")],
      ["c", state("c", "NOT_FOUND")],
    ]);
    const after = new Map([
      ["a", state("a", "MATCHED")],
      ["b", state("b", "PENDING")],
      ["c", state("c", "NOT_FOUND")],
    ]);
    const settled = settledBetween(before, after);
    assert.deepEqual(
      settled.map((s) => [s.movieId, s.status]),
      [["a", "MATCHED"]],
    );
  });

  it("a row that was not being looked up never settles, whatever it turns into", () => {
    const before = new Map([["a", state("a", "NOT_FOUND")]]);
    const after = new Map([["a", state("a", "MATCHED")]]);
    assert.deepEqual(settledBetween(before, after), []);
  });

  it("a lookup that never started counts once the server's NONE is believed", () => {
    const before = new Map([["a", pendingPlaceholder("a")]]);
    const after = new Map([["a", state("a", "NONE")]]);
    assert.equal(settledBetween(before, after)[0]?.status, "NONE");
  });

  it("a pending row that left the page is not reported", () => {
    assert.deepEqual(settledBetween(new Map([["a", state("a", "PENDING")]]), new Map()), []);
  });
});

describe("settledBetween — a page that watches a title whose upload is still running", () => {
  const unstarted = new Map([["a", state("a", "NONE")]]);

  it("a lookup that started and ended between two reads is reported with its result", () => {
    const settled = settledBetween(unstarted, new Map([["a", state("a", "MATCHED")]]), true);
    assert.deepEqual(
      settled.map((s) => [s.movieId, s.status]),
      [["a", "MATCHED"]],
    );
    assert.equal(settledBetween(unstarted, new Map([["a", state("a", "NOT_FOUND")]]), true)[0]?.status, "NOT_FOUND");
  });

  it("a lookup that only just started is not an end: the row is now being looked up", () => {
    assert.deepEqual(settledBetween(unstarted, new Map([["a", state("a", "PENDING")]]), true), []);
  });

  it("still not looked up = nothing to report", () => {
    assert.deepEqual(settledBetween(unstarted, new Map([["a", state("a", "NONE")]]), true), []);
  });

  it("a page that does not watch never hears of it", () => {
    assert.deepEqual(settledBetween(unstarted, new Map([["a", state("a", "MATCHED")]])), []);
  });

  it("a lookup the page did see run is reported as before", () => {
    const before = new Map([["a", state("a", "PENDING")]]);
    assert.equal(settledBetween(before, new Map([["a", state("a", "MATCHED")]]), true).length, 1);
  });

  it("a failed or not-found row the server looked up again by itself is reported with its new result", () => {
    // The upload finished: the server's own lookup also starts from FAILED and NOT_FOUND.
    const failed = new Map([["a", state("a", "FAILED")]]);
    const notFound = new Map([["a", state("a", "NOT_FOUND")]]);
    assert.equal(settledBetween(failed, new Map([["a", state("a", "MATCHED")]]), true)[0]?.status, "MATCHED");
    assert.equal(settledBetween(failed, new Map([["a", state("a", "NOT_FOUND")]]), true)[0]?.status, "NOT_FOUND");
    assert.equal(settledBetween(notFound, new Map([["a", state("a", "NEEDS_PICK")]]), true)[0]?.status, "NEEDS_PICK");
  });

  it("the same failed or not-found status again is no news: the form must not reload every 4 seconds", () => {
    const failed = new Map([["a", state("a", "FAILED")]]);
    const notFound = new Map([["a", state("a", "NOT_FOUND")]]);
    assert.deepEqual(settledBetween(failed, new Map([["a", state("a", "FAILED")]]), true), []);
    // Failed for another reason is still "failed": nothing was filled in.
    assert.deepEqual(settledBetween(failed, new Map([["a", state("a", "FAILED", { error: "interrupted" })]]), true), []);
    assert.deepEqual(settledBetween(notFound, new Map([["a", state("a", "NOT_FOUND")]]), true), []);
    // A lookup that only just started on such a row is not an end either.
    assert.deepEqual(settledBetween(failed, new Map([["a", state("a", "PENDING")]]), true), []);
  });

  it("a row with a result of its own (several matches, matched) is not watched: nothing starts on it by itself", () => {
    const needsPick = new Map([["a", state("a", "NEEDS_PICK")]]);
    assert.deepEqual(settledBetween(needsPick, new Map([["a", state("a", "MATCHED")]]), true), []);
  });

  it("a page that does not watch never hears of a failed row that got filled", () => {
    const failed = new Map([["a", state("a", "FAILED")]]);
    assert.deepEqual(settledBetween(failed, new Map([["a", state("a", "MATCHED")]])), []);
  });
});

describe("rowBehindItsDetails — a row older than what TMDB filled in for it", () => {
  // The fill of the `state` helper: 2026-11-06T07:00:00.000Z.
  const matched = state("a", "MATCHED");

  it("a row last written before the fill is behind: it is read again", () => {
    assert.equal(rowBehindItsDetails("2026-11-06T06:59:59.999Z", matched), true);
    assert.equal(rowBehindItsDetails("2026-11-05T12:00:00.000Z", matched), true);
  });

  it("a row written by the fill itself, or after it, is not", () => {
    assert.equal(rowBehindItsDetails("2026-11-06T07:00:00.000Z", matched), false);
    assert.equal(rowBehindItsDetails("2026-11-06T07:00:00.004Z", matched), false);
    assert.equal(rowBehindItsDetails("2026-11-06T09:30:00.000Z", matched), false);
  });

  it("only a linked title has details to be behind", () => {
    for (const status of ["NONE", "PENDING", "NEEDS_PICK", "NOT_FOUND", "FAILED"] as const) {
      const other = state("a", status, { fetchedAt: "2026-11-06T07:00:00.000Z" });
      assert.equal(rowBehindItsDetails("2026-11-06T06:00:00.000Z", other), false, status);
    }
  });

  it("nothing to compare: no state yet, no fill time, no row time, or a date that cannot be read", () => {
    assert.equal(rowBehindItsDetails("2026-11-06T06:00:00.000Z", undefined), false);
    assert.equal(rowBehindItsDetails("2026-11-06T06:00:00.000Z", null), false);
    assert.equal(rowBehindItsDetails("2026-11-06T06:00:00.000Z", state("a", "MATCHED", { fetchedAt: null })), false);
    assert.equal(rowBehindItsDetails(undefined, matched), false);
    assert.equal(rowBehindItsDetails("", matched), false);
    assert.equal(rowBehindItsDetails("not a date", matched), false);
  });
});

describe("rowReplaced / rowRemoved — each change to a list is made on the list as the one before left it", () => {
  interface Row {
    id: string;
    posterUrl: string | null;
  }
  const old = (id: string): Row => ({ id, posterUrl: null });
  const fresh = (id: string): Row => ({ id, posterUrl: `http://cache.example/images/movie/${id}.jpg` });
  // The page as it was drawn, before any row was read again.
  const drawn: readonly Row[] = [old("a"), old("b"), old("c")];

  it("three rows read again at the same moment: every one keeps its fresh copy, in any order of the answers", () => {
    // What the page does: each answer is applied to the result of the one before.
    const inOrder = [fresh("a"), fresh("b"), fresh("c")].reduce<Row[]>(rowReplaced, [...drawn]);
    assert.deepEqual(inOrder, [fresh("a"), fresh("b"), fresh("c")]);

    const shuffled = [fresh("c"), fresh("a"), fresh("b")].reduce<Row[]>(rowReplaced, [...drawn]);
    assert.deepEqual(shuffled, [fresh("a"), fresh("b"), fresh("c")]);
  });

  it("only the one row changes: the others are the very same rows, in the same order, and the list given is left alone", () => {
    const next = rowReplaced(drawn, fresh("b"));
    assert.deepEqual(next, [old("a"), fresh("b"), old("c")]);
    assert.equal(next[0], drawn[0]);
    assert.equal(next[2], drawn[2]);
    assert.notEqual(next, drawn);
    assert.deepEqual(drawn, [old("a"), old("b"), old("c")]);
  });

  it("a removal made after another row's fresh copy keeps that copy and drops only its own row", () => {
    // Row b was read again while the Publish of row a was on its way.
    const afterReread = rowReplaced(drawn, fresh("b"));
    assert.deepEqual(rowRemoved(afterReread, "a"), [fresh("b"), old("c")]);
    // The other way round ends the same.
    assert.deepEqual(rowReplaced(rowRemoved(drawn, "a"), fresh("b")), [fresh("b"), old("c")]);
  });

  it("two rows leaving one after the other are both gone: the second does not bring the first back", () => {
    assert.deepEqual(rowRemoved(rowRemoved(drawn, "a"), "c"), [old("b")]);
    assert.deepEqual(rowRemoved(rowRemoved(drawn, "c"), "a"), [old("b")]);
  });

  it("a fresh copy of a row that just left the list does not put it back", () => {
    assert.deepEqual(rowReplaced(rowRemoved(drawn, "a"), fresh("a")), [old("b"), old("c")]);
  });

  it("a row that is not in the list leaves the list as it is", () => {
    assert.deepEqual(rowReplaced(drawn, fresh("z")), drawn);
    assert.deepEqual(rowRemoved(drawn, "z"), drawn);
    assert.deepEqual(rowReplaced([], fresh("a")), []);
    assert.deepEqual(rowRemoved([], "a"), []);
  });

  it("removing the last row leaves an empty list: the page then loads the next batch", () => {
    assert.deepEqual(rowRemoved([old("a")], "a"), []);
  });
});

describe("stateReadWorthRetrying — which failed reads are asked again", () => {
  it("the server not reached, or a proxy answering for it while it restarts: ask again", () => {
    for (const status of [0, 408, 429, 500, 502, 503, 504]) {
      assert.equal(stateReadWorthRetrying(status), true, String(status));
    }
  });

  it("a refusal will be the same in 4 seconds: stop", () => {
    for (const status of [400, 401, 403, 404]) {
      assert.equal(stateReadWorthRetrying(status), false, String(status));
    }
  });

  it("a server that says TMDB is not connected is a refusal too, whatever its status", () => {
    assert.equal(stateReadWorthRetrying(503, "TMDB_NOT_CONFIGURED"), false);
  });

  it("any other code leaves the status to decide", () => {
    assert.equal(stateReadWorthRetrying(503, "TMDB_RATE_LIMITED"), true);
    assert.equal(stateReadWorthRetrying(0, "SERVER_UNREACHABLE"), true);
    assert.equal(stateReadWorthRetrying(401, "SESSION_EXPIRED"), false);
    assert.equal(stateReadWorthRetrying(502, null), true);
  });
});

describe("nextReadOf — what is asked again in 4 seconds", () => {
  const known = new Map([
    ["a", state("a", "PENDING")],
    ["b", state("b", "MATCHED")],
    ["c", state("c", "NONE")],
  ]);
  const plain = { failed: false, watchUnstarted: false };

  it("after a good read: only the rows still being looked up", () => {
    assert.deepEqual(nextReadOf(known, ["a", "b", "c"], plain), { pending: ["a"], unanswered: [], unstarted: [] });
  });

  it("after a failed read the pending rows are still asked about, so they can reach Try again", () => {
    assert.deepEqual(nextReadOf(known, ["a", "b", "c"], { ...plain, failed: true }).pending, ["a"]);
  });

  it("a first read that failed asks again for every row it knows nothing about", () => {
    assert.deepEqual(nextReadOf(none, ["a", "b"], { ...plain, failed: true }), {
      pending: [],
      unanswered: ["a", "b"],
      unstarted: [],
    });
  });

  it("a row the server left out of a good answer (a deleted movie) is not asked about again", () => {
    assert.deepEqual(nextReadOf(known, ["a", "gone"], plain).unanswered, []);
  });

  it("a watching page also keeps asking about a row never looked up", () => {
    assert.deepEqual(nextReadOf(known, ["a", "b", "c"], { ...plain, watchUnstarted: true }), {
      pending: ["a"],
      unanswered: [],
      unstarted: ["c"],
    });
  });

  it("a row that is not on the page any more is never asked about", () => {
    assert.deepEqual(nextReadOf(known, ["b"], { failed: true, watchUnstarted: true }), {
      pending: [],
      unanswered: [],
      unstarted: [],
    });
  });

  // The three statuses the server's lookup after an upload starts from.
  const ended = new Map([
    ["f", state("f", "FAILED")],
    ["n", state("n", "NOT_FOUND")],
    ["p", state("p", "NEEDS_PICK")],
    ["m", state("m", "MATCHED")],
  ]);

  it("a watching page also keeps asking about a failed and a not-found row, never about one with a result", () => {
    assert.deepEqual(nextReadOf(ended, ["f", "n", "p", "m"], { ...plain, watchUnstarted: true }), {
      pending: [],
      unanswered: [],
      unstarted: ["f", "n"],
    });
  });

  it("a page that does not watch stops at a failed or not-found row, as before", () => {
    assert.deepEqual(nextReadOf(ended, ["f", "n", "p", "m"], plain), { pending: [], unanswered: [], unstarted: [] });
  });
});

describe("tmdbStatesUse — what a page takes from the states", () => {
  it("TMDB not connected: the states are still read, for the folder names only", () => {
    assert.equal(tmdbStatesUse(true, true, true), "folders");
  });

  it("connected, or not known because the status read failed: everything", () => {
    assert.equal(tmdbStatesUse(true, true, false), "all");
  });

  it("nothing before the server has answered about its key, and nothing for a member who may not read them", () => {
    assert.equal(tmdbStatesUse(true, false, false), "none");
    assert.equal(tmdbStatesUse(false, true, false), "none");
    assert.equal(tmdbStatesUse(false, true, true), "none");
  });
});

describe("folderNamesOf — the folder line under a title", () => {
  it("TMDB not connected: every row reads NONE and its folder name is still there", () => {
    const keyless = new Map([
      ["a", state("a", "NONE", { sourceName: "Wonder.Woman.1984.1080p.BluRay", search: { query: "Wonder Woman", year: 1984 } })],
      ["b", state("b", "NONE", { sourceName: "Death.Race.2000.720p" })],
    ]);
    assert.deepEqual(
      [...folderNamesOf(keyless)],
      [
        ["a", "Wonder.Woman.1984.1080p.BluRay"],
        ["b", "Death.Race.2000.720p"],
      ],
    );
  });

  it("whatever the lookup status says", () => {
    const mixed = new Map([
      ["a", state("a", "MATCHED")],
      ["b", state("b", "FAILED")],
    ]);
    assert.equal(folderNamesOf(mixed).get("a"), "Inception.2010.1080p.BluRay");
    assert.equal(folderNamesOf(mixed).get("b"), "Inception.2010.1080p.BluRay");
  });

  it("a movie with no folder name (made by hand, or from before the feature) has no line", () => {
    const handMade = new Map([["a", state("a", "NONE", { sourceName: null })]]);
    assert.equal(folderNamesOf(handMade).has("a"), false);
  });
});
