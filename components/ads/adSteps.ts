/**
 * The steps of the "New ad" / "Edit ad" wizard (2026-11-04,
 * docs/ads-admin-ux-2026-11-04/SPEC.md §2) and which step each form problem
 * belongs to — so Next can check only the step on screen, a step with a
 * problem gets its red dot, and Save in edit mode jumps to the first part
 * that needs fixing.
 *
 * Pure: only type imports, so Node's test runner loads it as it is
 * (adSteps.test.ts). The problems themselves come from adForm.ts
 * `formIssues`; this file only places them.
 */
import type { AdIssueCode } from "./adForm";
import type { AdFormat } from "@/types/ad";

/**
 * Every step there is, in wizard order. "where" is a video ad's (before the
 * movie / at ad breaks, and the skip rule), "look" a corner picture's (how
 * long it stays, when it comes back, the ✕); "check" is "Check and save"
 * when creating and "Summary" when editing.
 */
export const AD_STEP_IDS = ["type", "media", "where", "look", "movies", "when", "check"] as const;
export type AdStepId = (typeof AD_STEP_IDS)[number];

/** Creating walks the steps one by one; editing opens on the summary with every part clickable. */
export type AdWizardMode = "create" | "edit";

/**
 * The steps one ad goes through. Editing has no "type" step: the backend
 * never changes an ad's format after the create.
 */
export function stepsFor(format: AdFormat, mode: AdWizardMode): AdStepId[] {
  const steps: AdStepId[] =
    format === "CORNER"
      ? ["type", "media", "look", "movies", "when", "check"]
      : ["type", "media", "where", "movies", "when", "check"];
  return mode === "edit" ? steps.filter((step) => step !== "type") : steps;
}

/**
 * The step whose fields each problem is about. The name, the private note,
 * the video or picture and the corner link sit on "media"; the hours of the
 * day, the wait, the daily limit and "which ad goes first" sit under More
 * options on "when"; a missing video or picture for an ad that is to be
 * switched on belongs to "check", where "Turn it on now?" is asked — saving
 * it turned off is always allowed.
 *
 * A Record, so a new AdIssueCode that is not placed here is a compile error.
 */
export const AD_ISSUE_STEPS: Record<AdIssueCode, AdStepId> = {
  TITLE_REQUIRED: "media",
  TITLE_TOO_LONG: "media",
  DESCRIPTION_TOO_LONG: "media",
  VIDEO_NOT_MP4: "media",
  VIDEO_TOO_LARGE: "media",
  VIDEO_DURATION: "media",
  TARGET_MOVIES_REQUIRED: "movies",
  TARGET_TOO_MANY: "movies",
  TARGET_DELETED: "movies",
  WINDOW_INVALID: "when",
  DAILY_WINDOW_INCOMPLETE: "when",
  DAILY_WINDOW_SAME: "when",
  PRIORITY_RANGE: "when",
  SKIP_AFTER_REQUIRED: "where",
  SKIP_AFTER_RANGE: "where",
  SKIP_AFTER_TOO_LONG: "where",
  FREQUENCY_RANGE: "when",
  MAX_PER_DAY_RANGE: "when",
  SLOTS_REQUIRED: "where",
  VIDEO_REQUIRED: "check",
  PICTURE_TYPE: "media",
  PICTURE_TOO_LARGE: "media",
  PICTURE_UNREADABLE: "media",
  PICTURE_SHAPE: "media",
  LINK_TOO_LONG: "media",
  LINK_INVALID: "media",
  CORNER_SHOW_RANGE: "look",
  CORNER_REPEAT_RANGE: "look",
  CORNER_REPEAT_TOO_SHORT: "look",
  PICTURE_REQUIRED: "check",
};

/** The step a problem belongs to. */
export function stepOfIssue(code: AdIssueCode): AdStepId {
  return AD_ISSUE_STEPS[code];
}

/** The problems that sit on one step, in the order they came — what Next shows in its red box. */
export function issuesOnStep<I extends { code: AdIssueCode }>(step: AdStepId, issues: readonly I[]): I[] {
  return issues.filter((issue) => AD_ISSUE_STEPS[issue.code] === step);
}

/**
 * The first of `steps` (in their order) that holds a problem — where Save
 * in edit mode jumps to. Null when none of them does; a problem whose step
 * is not in `steps` is not counted.
 */
export function firstStepWithIssue(
  steps: readonly AdStepId[],
  issues: readonly { code: AdIssueCode }[],
): AdStepId | null {
  return steps.find((step) => issues.some((issue) => AD_ISSUE_STEPS[issue.code] === step)) ?? null;
}
