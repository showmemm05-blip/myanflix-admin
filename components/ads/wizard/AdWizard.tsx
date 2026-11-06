"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import {
  emptyForm,
  formFromAd,
  formIsDirty,
  formIssues,
  hasMedia,
  issueText,
  type AdFormState,
  type AdImageSize,
} from "@/components/ads/adForm";
import { issuesOnStep, stepsFor, type AdStepId, type AdWizardMode } from "@/components/ads/adSteps";
import { formatLabel } from "@/components/ads/adWords";
import { IssueBox } from "@/components/ads/wizard/IssueBox";
import { LookStep } from "@/components/ads/wizard/LookStep";
import { MediaStep } from "@/components/ads/wizard/MediaStep";
import { MORE_OPTIONS_ISSUES } from "@/components/ads/wizard/MoreOptions";
import { MoviesStep } from "@/components/ads/wizard/MoviesStep";
import { ReviewStep } from "@/components/ads/wizard/ReviewStep";
import { StepNav, stepName } from "@/components/ads/wizard/StepNav";
import { TypeStep } from "@/components/ads/wizard/TypeStep";
import { useAdSave } from "@/components/ads/wizard/useAdSave";
import { WhenStep } from "@/components/ads/wizard/WhenStep";
import { WhereStep } from "@/components/ads/wizard/WhereStep";
import type { StepProps } from "@/components/ads/wizard/stepProps";
import { useLanguage } from "@/lib/context/language-context";
import { probeVideoFileDurationSeconds } from "@/lib/upload/probe-duration";
import { cn } from "@/lib/utils";
import type { Ad, AdSettings } from "@/types/ad";

/**
 * The contract between the list page and the step-by-step wizard
 * (docs/ads-admin-ux-2026-11-04/BUILD-BRIEF.md, Stage F → Stage W). Keep it
 * as it is.
 */
export interface AdWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The ad being edited, or null to create one. */
  ad: Ad | null;
  onSaved: (saved: Ad) => void;
  /** Called when the backend says the ad is gone — the page reloads its list. */
  onStale: () => void;
  /** The Ad settings (break interval, audience, live counts); null while they load. */
  settings: AdSettings | null;
  /** Edit only: open on this step instead of the Summary ("Change hours" in the checker opens "when"). */
  initialStep?: AdStepId;
  /** Edit only: "More options" starts open and in view ("Change hours": the hours sit in there). */
  initialMoreOpen?: boolean;
  /** Opens the Ad settings card, for the "change this in Ad settings" links. */
  onOpenSettings?: () => void;
}

/** The wizard's own checks, beside formIssues: "On a date" chosen with no date picked yet. */
type DateProblem = "START_DATE_MISSING" | "END_DATE_MISSING";

/**
 * "New ad" / "Edit ad", one step at a time (2026-11-04, the `Wiz*`,
 * `Corner*`, `EditMode` and `PhoneStep` boards; SPEC §2). The parent mounts
 * it with a `key` per ad, so the form is seeded once from props and never
 * synced in an effect.
 *
 * Creating walks Type → Video (or Picture) → Where (or Timing) → Movies →
 * When → Check: Next checks only the step on screen (formIssues, placed by
 * adSteps.ts) and shows a red box with what to fix; "Turn it on now?" starts
 * on Yes when the ad has its video or picture. Editing opens on the Summary
 * (or on `initialStep`, for the checker's fix buttons), every part is
 * clickable with a red dot on one that needs fixing, and Save works from any
 * part — it jumps to the first part with a problem instead of saving.
 *
 * The save itself (useAdSave.ts) is the old form's, step for step: create
 * switched off → upload and attach the video, or upload the picture → PATCH
 * what changed. Its progress sits in the footer, where Cancel becomes "Stop
 * upload". Closing with changes asks "Close without saving?" first. Full
 * screen on a phone, with "Step 3 of 6" and a progress bar instead of the
 * step names.
 */
export function AdWizard({
  open,
  onOpenChange,
  ad,
  onSaved,
  onStale,
  settings,
  initialStep,
  initialMoreOpen = false,
  onOpenSettings,
}: AdWizardProps) {
  const { t } = useLanguage();
  const w = t.adsUi.wizard;
  const shared = t.adsUi.shared;
  const mode: AdWizardMode = ad ? "edit" : "create";
  const edit = mode === "edit";

  const [initial] = useState<AdFormState>(() => (ad ? formFromAd(ad) : emptyForm()));
  const [state, setState] = useState<AdFormState>(initial);
  const [step, setStep] = useState<AdStepId>(() => {
    if (!ad) return "type";
    return initialStep && stepsFor(ad.format, "edit").includes(initialStep) ? initialStep : "check";
  });
  /** Creating: the furthest step reached (an index) — the step bar opens any step up to it. */
  const [reached, setReached] = useState(0);
  /** Creating: the steps where Next or Save was refused — their problems show from then on. */
  const [attempted, setAttempted] = useState<ReadonlySet<AdStepId>>(() => new Set());
  /** "On a date" chosen for the start / end (the value itself stays "" until a date is picked). */
  const [onDate, setOnDate] = useState(() => ({ start: initial.startsAt !== "", end: initial.endsAt !== "" }));
  /** Creating: "Turn it on now?" was answered, so arriving on the last step no longer answers it. */
  const [activeChosen, setActiveChosen] = useState(edit);
  const [probing, setProbing] = useState(false);
  /**
   * "More options" on the When step is open. Held here, not in the section:
   * the step unmounts it on every move, and it must not close behind the admin
   * — or under a box they are retyping — once it has opened.
   */
  const [moreOpen, setMoreOpen] = useState(initialMoreOpen);
  /**
   * "More options" was asked for, and goes into view once it is up (below two
   * date rows it can start off screen). The section does that itself, as it
   * mounts: an effect here runs before a dialog that opens on the When step
   * has put its content on the page.
   */
  const [revealMore, setRevealMore] = useState(initialMoreOpen);
  /** "Close without saving?" is open; `after` runs once the wizard has closed (the Ad settings link). */
  const [closing, setClosing] = useState<{ after?: () => void } | null>(null);

  const saver = useAdSave({ ad, state, setState, onSaved, onStale, onClose: () => onOpenChange(false) });
  const { existing, saving, upload, imageUploading } = saver;
  /** A new ad that a Save already put in the list (its video, picture or last changes were then refused). */
  const savedHere = ad === null && existing !== null;
  /** Editing: a Save already put a new video or picture on the ad, and what followed it was refused. */
  const fileKept = edit && saver.mediaStoredHere;

  const steps = stepsFor(state.format, mode);
  // The format only changes on the type step, so the step is always one of
  // them; the fallback only guards that.
  const current = steps.includes(step) ? step : steps[0];
  const index = steps.indexOf(current);
  const corner = state.format === "CORNER";

  const set = <K extends keyof AdFormState>(key: K, value: AdFormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // ------------------------------------------------------------- problems
  const issues = formIssues(state, existing);
  const dateProblems: DateProblem[] = [];
  if (onDate.start && state.startsAt === "") dateProblems.push("START_DATE_MISSING");
  if (onDate.end && state.endsAt === "") dateProblems.push("END_DATE_MISSING");
  const dateTexts = dateProblems.map((code) => w.issues[code]);
  const hasProblem = (s: AdStepId) => issuesOnStep(s, issues).length > 0 || (s === "when" && dateProblems.length > 0);
  const problemSteps = new Set(steps.filter(hasProblem));

  // Creating shows a step's problems once Next or Save was refused there;
  // editing shows them as they are, like the red dots.
  const showing = edit || attempted.has(current);
  const stepIssues = showing ? issuesOnStep(current, issues) : [];
  const marked = new Set(stepIssues.map((issue) => issue.code));
  // A problem in "More options" opens it, for good: `marked` follows every
  // keystroke, so a section open only while a problem lasts would shut as the
  // first valid digit lands, taking the box and the rest of the number with it.
  if (!moreOpen && MORE_OPTIONS_ISSUES.some((code) => marked.has(code))) setMoreOpen(true);
  const boxMessages = [
    ...stepIssues.map((issue) => issueText(t, issue)),
    ...(showing && current === "when" ? dateTexts : []),
  ];

  // A picked picture is measured off its thumbnail and a picked video's
  // length read by the browser; Next, Save and the step bar wait for that
  // (a moment), so the shape and length checks run before anything moves.
  const measuring = corner && state.imageFile !== null && state.imageFileSize === null;
  const busy = (!corner && probing) || measuring;

  // ----------------------------------------------------------- moving on
  /**
   * Opens a step. Creating, a step further on is reached only through the
   * ones in between, each checked as Next checks it — the first with a
   * problem is where the admin lands, with its red box. Editing, every part
   * opens as it is (Save checks them all).
   */
  const goTo = (target: AdStepId) => {
    const targetIndex = steps.indexOf(target);
    if (!edit && targetIndex > index) {
      const blocked = steps.slice(index, targetIndex).find(hasProblem);
      if (blocked) {
        setAttempted((prev) => new Set(prev).add(blocked));
        setStep(blocked);
        return;
      }
      setReached((prev) => Math.max(prev, targetIndex));
    }
    if (target === "check" && !activeChosen) {
      // "Turn it on now?" starts on Yes when there is something to show.
      setState((prev) => ({ ...prev, isActive: hasMedia(prev, existing) }));
    }
    setStep(target);
  };

  const next = () => {
    if (!busy) goTo(steps[index + 1]);
  };

  // Waits for the same reason Next does: leaving the picture step mid-measure
  // would unmount the thumbnail that reports the size, and everything waits for it.
  const back = () => {
    if (!busy && index > 0) setStep(steps[index - 1]);
  };

  /** "More options" on the last step: the When step with the section open and in view. */
  const goToMore = () => {
    setMoreOpen(true);
    setRevealMore(true);
    goTo("when");
  };

  const trySave = () => {
    if (busy || saving) return;
    const first = steps.find(hasProblem);
    if (first) {
      setAttempted((prev) => new Set(prev).add(first));
      setStep(first);
      return;
    }
    void saver.save();
  };

  // ------------------------------------------------------------- closing
  const requestClose = (after?: () => void) => {
    if (saving) return;
    // Once a Save has put a new ad in the list, or a new video or picture on
    // the ad, what would be lost is measured from that row: the form it
    // started from no longer says what the ad holds.
    if (formIsDirty((savedHere || fileKept) && existing ? formFromAd(existing) : initial, state)) {
      setClosing({ after });
      return;
    }
    onOpenChange(false);
    after?.();
  };
  const leaveForSettings = onOpenSettings ? () => requestClose(onOpenSettings) : undefined;

  // ---------------------------------------------------------- the media
  const pickVideo = async (file: File) => {
    setState((prev) => ({ ...prev, videoFile: file, videoFileDurationSeconds: null }));
    setProbing(true);
    // Read by the browser for the length checks only; the server measures
    // the real length with ffprobe when the file is attached.
    const seconds = await probeVideoFileDurationSeconds(file);
    setState((prev) => (prev.videoFile === file ? { ...prev, videoFileDurationSeconds: seconds } : prev));
    setProbing(false);
  };

  const pickImage = (file: File) => {
    setState((prev) => ({ ...prev, imageFile: file, imageFileSize: null }));
  };

  /** The thumbnail decoded the picked picture (or could not) — its size feeds the shape check and the preview. */
  const measureImage = (file: File, size: AdImageSize | null) => {
    setState((prev) => (prev.imageFile === file ? { ...prev, imageFileSize: size ?? "unreadable" } : prev));
  };

  // ------------------------------------------------- focus on a new step
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStepRef = useRef(current);
  // A new step starts at its top, and a screen reader hears its question. A
  // layout effect, so it comes before "More options" scrolls itself into view
  // (MoreOptions.tsx, in a plain effect) instead of undoing that.
  useLayoutEffect(() => {
    if (shownStepRef.current === current) return;
    shownStepRef.current = current;
    bodyRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [current]);

  // --------------------------------------------------------------- words
  const name = stepName(t, current, state.format, mode);
  const title = ad
    ? w.titles.edit(ad.title)
    : current !== "type" && corner
      ? w.titles.newCorner
      : w.titles.newAd;
  const headings = w.headings;
  const heading: Record<AdStepId, string> = {
    type: headings.type,
    media: corner ? headings.mediaCorner : headings.mediaVideo,
    where: headings.where,
    look: headings.look,
    movies: headings.movies,
    when: headings.when,
    check: edit ? headings.summary : headings.check,
  };

  const stepProps: StepProps = { state, setState, set, existing, disabled: saving, marked };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else requestClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,60rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl",
          // A phone gets the whole screen (the `PhoneStep` board).
          "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
        )}
      >
        <header className="flex flex-col gap-3 border-b border-border px-4 pt-4 pb-3 sm:gap-3.5 sm:px-6 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="truncate text-base font-semibold sm:text-lg">{title}</DialogTitle>
              {ad ? (
                <p className="text-xs text-muted-foreground">{w.titles.typeFixed(formatLabel(t, ad.format))}</p>
              ) : (
                <p className="text-xs text-muted-foreground sm:hidden">
                  {w.steps.stepOf(index + 1, steps.length, name)}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={shared.close}
              disabled={saving}
              onClick={() => requestClose()}
            >
              <X />
            </Button>
          </div>
          <StepNav
            mode={mode}
            format={state.format}
            steps={steps}
            current={current}
            reached={reached}
            problemSteps={edit ? problemSteps : new Set()}
            onGoTo={goTo}
            disabled={busy || saving}
          />
        </header>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5">
            <IssueBox title={edit ? w.problems.beforeSave : w.problems.beforeNext} messages={boxMessages} />
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none sm:text-xl">
              {heading[current]}
            </h2>

            {current === "type" && <TypeStep {...stepProps} />}
            {current === "media" && (
              <MediaStep
                {...stepProps}
                probing={probing}
                imageUploading={imageUploading}
                onPickVideo={(file) => void pickVideo(file)}
                onPickImage={pickImage}
                onMeasureImage={measureImage}
              />
            )}
            {current === "where" && (
              <WhereStep {...stepProps} settings={settings} onOpenSettings={leaveForSettings} />
            )}
            {current === "look" && <LookStep {...stepProps} />}
            {current === "movies" && <MoviesStep {...stepProps} />}
            {current === "when" && (
              <WhenStep
                {...stepProps}
                startOnDate={onDate.start}
                endOnDate={onDate.end}
                onStartOnDate={(value) => setOnDate((prev) => ({ ...prev, start: value }))}
                onEndOnDate={(value) => setOnDate((prev) => ({ ...prev, end: value }))}
                startDateMissing={showing && dateProblems.includes("START_DATE_MISSING")}
                endDateMissing={showing && dateProblems.includes("END_DATE_MISSING")}
                moreOpen={moreOpen}
                onMoreOpenChange={setMoreOpen}
                revealMore={revealMore}
                onMoreRevealed={() => setRevealMore(false)}
              />
            )}
            {current === "check" && (
              <ReviewStep
                {...stepProps}
                mode={mode}
                settings={settings}
                issues={issues}
                dateProblems={dateTexts}
                onGoTo={goTo}
                onGoToMore={goToMore}
                onOpenSettings={leaveForSettings}
                onActiveChosen={(active) => {
                  setActiveChosen(true);
                  set("isActive", active);
                }}
              />
            )}
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-border bg-muted/40 px-4 py-3 sm:px-6">
          {saving && (
            <div aria-live="polite" className="flex items-center gap-3">
              {upload ? (
                <Progress value={upload.percent} className="flex-1">
                  <ProgressLabel className="text-xs">
                    {upload.phase === "attaching" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin" />
                        {w.footer.checkingVideo}
                      </span>
                    ) : (
                      w.footer.uploadingVideo(upload.percent)
                    )}
                  </ProgressLabel>
                  {upload.phase === "uploading" && <ProgressValue className="text-xs" />}
                </Progress>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {imageUploading ? w.footer.uploadingPicture : w.footer.saving}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              // On a phone the ✕ above closes; Cancel only comes back as "Stop upload".
              className={cn(!saver.uploadingNow && "max-sm:hidden")}
              disabled={saver.cancelDisabled}
              onClick={() => (saver.uploadingNow ? saver.cancelUpload() : requestClose())}
            >
              {saver.uploadingNow ? w.footer.stopUpload : shared.cancel}
            </Button>
            <div className="ml-auto flex flex-1 gap-2 sm:flex-none">
              {!edit && index > 0 && (
                <Button type="button" variant="outline" className="max-sm:flex-1" disabled={saving || busy} onClick={back}>
                  <ArrowLeft />
                  {shared.back}
                </Button>
              )}
              {!edit && current !== "check" ? (
                <Button type="button" className="max-sm:flex-1" disabled={saving || busy} onClick={next}>
                  {shared.next}
                  <ArrowRight />
                </Button>
              ) : (
                <Button type="button" className="max-sm:flex-1" disabled={saving || busy} onClick={trySave}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {edit ? w.footer.saveChanges : w.footer.saveAd}
                </Button>
              )}
            </div>
          </div>
        </footer>

        <ConfirmDialog
          open={closing !== null}
          onOpenChange={(next) => {
            if (!next) setClosing(null);
          }}
          title={savedHere || fileKept ? w.closeConfirm.savedTitle : w.closeConfirm.title}
          description={
            savedHere
              ? w.closeConfirm.savedDescription
              : fileKept
                ? corner
                  ? w.closeConfirm.pictureKept
                  : w.closeConfirm.videoKept
                : w.closeConfirm.description
          }
          confirmLabel={w.closeConfirm.confirm}
          cancelLabel={w.closeConfirm.keepEditing}
          variant="destructive"
          onConfirm={() => {
            const after = closing?.after;
            setClosing(null);
            onOpenChange(false);
            after?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
