/**
 * The wizard's steps (components/ads/adSteps.ts): which steps a video ad and
 * a corner picture go through when created and when edited, which step each
 * form problem belongs to, and where Next and Save look for problems.
 *
 * Runs on Node's own test runner: `npm test`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { AdIssueCode } from "./adForm";

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way.
const load = createRequire(import.meta.url);
const { AD_ISSUE_STEPS, AD_STEP_IDS, firstStepWithIssue, issuesOnStep, stepOfIssue, stepsFor } = load(
  "./adSteps.ts",
) as typeof import("./adSteps");

const issue = (code: AdIssueCode, n = 0) => ({ code, n });

/** The codes formIssues can only raise for one format (adForm.ts checks only the ad's own format's fields). */
const VIDEO_ONLY: AdIssueCode[] = [
  "VIDEO_NOT_MP4",
  "VIDEO_TOO_LARGE",
  "VIDEO_DURATION",
  "SKIP_AFTER_REQUIRED",
  "SKIP_AFTER_RANGE",
  "SKIP_AFTER_TOO_LONG",
  "SLOTS_REQUIRED",
  "VIDEO_REQUIRED",
];
const CORNER_ONLY: AdIssueCode[] = [
  "PICTURE_TYPE",
  "PICTURE_TOO_LARGE",
  "PICTURE_UNREADABLE",
  "PICTURE_SHAPE",
  "LINK_TOO_LONG",
  "LINK_INVALID",
  "CORNER_SHOW_RANGE",
  "CORNER_REPEAT_RANGE",
  "CORNER_REPEAT_TOO_SHORT",
  "PICTURE_REQUIRED",
];

describe("stepsFor", () => {
  it("creating a video ad: type, video, where, movies, when, check", () => {
    assert.deepEqual(stepsFor("VIDEO", "create"), ["type", "media", "where", "movies", "when", "check"]);
  });

  it("creating a corner picture: type, picture, how it looks, movies, when, check", () => {
    assert.deepEqual(stepsFor("CORNER", "create"), ["type", "media", "look", "movies", "when", "check"]);
  });

  it("editing: the same without the type, which never changes", () => {
    assert.deepEqual(stepsFor("VIDEO", "edit"), ["media", "where", "movies", "when", "check"]);
    assert.deepEqual(stepsFor("CORNER", "edit"), ["media", "look", "movies", "when", "check"]);
  });

  it("each list is a fresh array in wizard order", () => {
    const steps = stepsFor("VIDEO", "create");
    steps.pop();
    assert.equal(stepsFor("VIDEO", "create").length, 6);
    for (const format of ["VIDEO", "CORNER"] as const) {
      const order = stepsFor(format, "create").map((step) => AD_STEP_IDS.indexOf(step));
      assert.deepEqual(order, [...order].sort((a, b) => a - b), format);
    }
  });
});

describe("the step of each problem", () => {
  const video = new Set(stepsFor("VIDEO", "edit"));
  const corner = new Set(stepsFor("CORNER", "edit"));

  it("every problem sits on a step its ad has, and never on the type step", () => {
    for (const [code, step] of Object.entries(AD_ISSUE_STEPS) as [AdIssueCode, string][]) {
      assert.notEqual(step, "type", code);
      if (VIDEO_ONLY.includes(code)) assert.ok(video.has(stepOfIssue(code)), code);
      else if (CORNER_ONLY.includes(code)) assert.ok(corner.has(stepOfIssue(code)), code);
      else {
        assert.ok(video.has(stepOfIssue(code)), `${code} (video)`);
        assert.ok(corner.has(stepOfIssue(code)), `${code} (corner)`);
      }
    }
  });

  it("where the fields are", () => {
    assert.equal(stepOfIssue("TITLE_REQUIRED"), "media");
    assert.equal(stepOfIssue("DESCRIPTION_TOO_LONG"), "media");
    assert.equal(stepOfIssue("VIDEO_TOO_LARGE"), "media");
    assert.equal(stepOfIssue("LINK_INVALID"), "media");
    assert.equal(stepOfIssue("SLOTS_REQUIRED"), "where");
    assert.equal(stepOfIssue("SKIP_AFTER_TOO_LONG"), "where");
    assert.equal(stepOfIssue("CORNER_REPEAT_TOO_SHORT"), "look");
    assert.equal(stepOfIssue("TARGET_MOVIES_REQUIRED"), "movies");
    assert.equal(stepOfIssue("WINDOW_INVALID"), "when");
    // More options sit on the "When" step.
    for (const code of ["DAILY_WINDOW_INCOMPLETE", "DAILY_WINDOW_SAME", "PRIORITY_RANGE", "FREQUENCY_RANGE", "MAX_PER_DAY_RANGE"] as const) {
      assert.equal(stepOfIssue(code), "when", code);
    }
    // "Turn it on now?" without a video or picture: decided on the last step.
    assert.equal(stepOfIssue("VIDEO_REQUIRED"), "check");
    assert.equal(stepOfIssue("PICTURE_REQUIRED"), "check");
  });

  it("thirty codes, one per sentence of the old form", () => {
    assert.equal(Object.keys(AD_ISSUE_STEPS).length, VIDEO_ONLY.length + CORNER_ONLY.length + 12);
    assert.equal(Object.keys(AD_ISSUE_STEPS).length, 30);
  });
});

describe("issuesOnStep / firstStepWithIssue", () => {
  const issues = [issue("WINDOW_INVALID", 1), issue("TITLE_REQUIRED", 2), issue("FREQUENCY_RANGE", 3), issue("SLOTS_REQUIRED", 4)];

  it("a step's own problems, in the order they came, the same objects", () => {
    assert.deepEqual(issuesOnStep("when", issues), [issues[0], issues[2]]);
    assert.equal(issuesOnStep("when", issues)[0], issues[0]);
    assert.deepEqual(issuesOnStep("media", issues), [issues[1]]);
    assert.deepEqual(issuesOnStep("movies", issues), []);
    assert.deepEqual(issuesOnStep("check", []), []);
  });

  it("the first step in wizard order — not the first problem in the list", () => {
    assert.equal(firstStepWithIssue(stepsFor("VIDEO", "edit"), issues), "media");
    assert.equal(firstStepWithIssue(stepsFor("VIDEO", "edit"), [issue("VIDEO_REQUIRED"), issue("TARGET_DELETED")]), "movies");
  });

  it("none: null; a problem on a step that is not in the list is not counted", () => {
    assert.equal(firstStepWithIssue(stepsFor("VIDEO", "edit"), []), null);
    assert.equal(firstStepWithIssue(stepsFor("CORNER", "edit"), [issue("SLOTS_REQUIRED")]), null);
    assert.equal(firstStepWithIssue(["media", "movies"], [issue("WINDOW_INVALID")]), null);
  });
});
