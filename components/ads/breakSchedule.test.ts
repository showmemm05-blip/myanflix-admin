/**
 * The Ad settings card's break maths (components/ads/breakSchedule.ts): the
 * positions follow the players' scheduler — k × interval, at or before
 * duration − end guard, nothing under one minute — and a movie time splits
 * into the hours and minutes its words are made of ("1 h 30 min", never
 * "1:30").
 *
 * Runs on Node's own test runner: `npm test`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way.
const load = createRequire(import.meta.url);
const { BREAK_MIN_INTERVAL_SECONDS, breakPositions, movieTimeParts } = load(
  "./breakSchedule.ts",
) as typeof import("./breakSchedule");

const GUARD = 120;
const TWO_HOURS = 2 * 60 * 60;

describe("breakPositions", () => {
  it("a 2-hour movie every 30 minutes: 30 min, 1 h, 1 h 30 min (2 h is inside the last 2 minutes)", () => {
    assert.deepEqual(breakPositions(TWO_HOURS, 30 * 60, GUARD), [1800, 3600, 5400]);
  });

  it("every 15 / 45 / 60 minutes", () => {
    assert.equal(breakPositions(TWO_HOURS, 15 * 60, GUARD).length, 7);
    assert.deepEqual(breakPositions(TWO_HOURS, 45 * 60, GUARD), [2700, 5400]);
    assert.deepEqual(breakPositions(TWO_HOURS, 60 * 60, GUARD), [3600]);
  });

  it("off: 0, under one minute, negative, NaN, Infinity", () => {
    for (const interval of [0, 59, -60, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepEqual(breakPositions(TWO_HOURS, interval, GUARD), [], String(interval));
    }
    assert.equal(BREAK_MIN_INTERVAL_SECONDS, 60);
    assert.deepEqual(breakPositions(TWO_HOURS, 60, GUARD).slice(0, 2), [60, 120]);
  });

  it("no movie length, no breaks", () => {
    for (const movie of [0, -1, Number.NaN]) assert.deepEqual(breakPositions(movie, 1800, GUARD), []);
  });

  it("the end guard: a 45-minute episode every 45 minutes has none; every 30 minutes has one", () => {
    assert.deepEqual(breakPositions(45 * 60, 45 * 60, GUARD), []);
    assert.deepEqual(breakPositions(45 * 60, 30 * 60, GUARD), [1800]);
  });

  it("a break exactly at duration − guard still plays", () => {
    assert.deepEqual(breakPositions(1800 + GUARD, 1800, GUARD), [1800]);
    assert.deepEqual(breakPositions(1800 + GUARD - 1, 1800, GUARD), []);
  });

  it("a fractional interval is floored; a bad guard counts as none", () => {
    assert.deepEqual(breakPositions(TWO_HOURS, 1800.7, GUARD), [1800, 3600, 5400]);
    assert.deepEqual(breakPositions(3600, 1800, Number.NaN), [1800, 3600]);
    assert.deepEqual(breakPositions(3600, 1800, -5), [1800, 3600]);
  });

  it("the owner's 1-minute test interval: 118 breaks in 2 hours, the last at 1 h 58 min", () => {
    const positions = breakPositions(TWO_HOURS, 60, GUARD);
    assert.equal(positions.length, 118);
    assert.equal(positions[0], 60);
    assert.equal(positions.at(-1), TWO_HOURS - GUARD);
  });
});

describe("movieTimeParts", () => {
  it("the break times of a 2-hour movie: 30 min, 1 h, 1 h 30 min", () => {
    assert.deepEqual(movieTimeParts(1800), { hours: 0, minutes: 30 });
    assert.deepEqual(movieTimeParts(3600), { hours: 1, minutes: 0 });
    assert.deepEqual(movieTimeParts(5400), { hours: 1, minutes: 30 });
    assert.deepEqual(movieTimeParts(TWO_HOURS), { hours: 2, minutes: 0 });
  });

  it("whole minutes, floored", () => {
    assert.deepEqual(movieTimeParts(59), { hours: 0, minutes: 0 });
    assert.deepEqual(movieTimeParts(60), { hours: 0, minutes: 1 });
    assert.deepEqual(movieTimeParts(3659), { hours: 1, minutes: 0 });
    assert.deepEqual(movieTimeParts(12 * 3600 + 5 * 60 + 30), { hours: 12, minutes: 5 });
  });

  it("nothing readable or below zero is 0", () => {
    for (const seconds of [0, -60, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepEqual(movieTimeParts(seconds), { hours: 0, minutes: 0 }, String(seconds));
    }
  });
});
