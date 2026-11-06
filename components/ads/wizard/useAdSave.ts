"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { AdVideoUploadState } from "@/components/ads/AdVideoField";
import { adErrorMessage, changedFields, toFields, type AdFormState } from "@/components/ads/adForm";
import { useLanguage } from "@/lib/context/language-context";
import { AD_VIDEO_RELATIVE_PATH, uploadAdVideo } from "@/lib/upload/upload-ad-video";
import { ApiError } from "@/services/api/apiClient";
import { adService } from "@/services/api/adService";
import { uploadService } from "@/services/api/uploadService";
import type { Ad } from "@/types/ad";

interface UseAdSaveOptions {
  /** The ad being edited, or null while creating one. */
  ad: Ad | null;
  state: AdFormState;
  setState: Dispatch<SetStateAction<AdFormState>>;
  onSaved: (ad: Ad) => void;
  /** The backend says the ad is gone — the page reloads its list. */
  onStale: () => void;
  /** Closes the wizard for good (no "Close without saving?" — the save is done, or the ad is gone). */
  onClose: () => void;
}

export interface AdSave {
  /**
   * The server's latest copy of the row the wizard works on: the edited ad,
   * or the one an earlier Save created whose video or picture was then
   * refused — its type is fixed from then on, and the next Save edits it
   * instead of creating a second one.
   */
  existing: Ad | null;
  /**
   * A Save of this wizard put a new video or picture on the ad, so it stays
   * there whatever happens to the rest. Editing, the failure toast and the
   * close dialog say so: the wizard can only lose the other changes.
   */
  mediaStoredHere: boolean;
  saving: boolean;
  /** The video upload in progress (bytes, then the server's check); null when none. */
  upload: AdVideoUploadState | null;
  imageUploading: boolean;
  /** A video or picture is on its way up — the footer's Cancel becomes "Stop upload". */
  uploadingNow: boolean;
  /** Nothing to stop while the server checks the video or creates the row, so Cancel waits. */
  cancelDisabled: boolean;
  /** Runs the save. The caller has already checked the form (formIssues is empty). */
  save: () => Promise<void>;
  cancelUpload: () => void;
}

/**
 * The wizard's save, moved unchanged from the one-page form it replaces
 * (AdFormDialog, 2026-11-04) — the order matters and is the backend's:
 *
 * 1. A new ad is created switched OFF (the backend refuses `isActive: true`
 *    without a video or picture), with its `format`.
 * 2. A picked MP4 goes straight to MinIO with progress, then the backend
 *    checks and keeps it (attach) — with the skip fields in the same
 *    request, so skip-after is checked against the NEW length. A picked
 *    corner picture goes to the backend in one request.
 * 3. The fields that still differ go in one PATCH ("Turn it on now?"
 *    included; never `format`). Editing uploads first too, for the same
 *    reason.
 *
 * "Stop upload" aborts the upload, tells the backend to drop a multipart
 * session, and deletes a row that was created a moment ago; so does the
 * wizard going away mid-upload — which then ends the Save without a word, as
 * nothing is left to report on. A refusal that arrives after the wizard went
 * away is still reported, as the change really was not saved; and a new row
 * that comes back only after it went away is deleted again, before an upload
 * nobody could stop. A refused video or picture on a fresh create keeps the
 * row, and a PATCH refused after a video or picture reached the ad keeps that
 * file (the list is told either way, so neither is lost, and an edit's toast
 * says the file is saved); the wizard stays open to try again. AD_NOT_FOUND
 * reloads the list and closes the wizard.
 */
export function useAdSave({ ad, state, setState, onSaved, onStale, onClose }: UseAdSaveOptions): AdSave {
  const { t } = useLanguage();
  const w = t.adsUi.wizard;
  const [created, setCreated] = useState<Ad | null>(null);
  const [mediaStoredHere, setMediaStoredHere] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upload, setUpload] = useState<AdVideoUploadState | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  /** A row created by the running Save that the list has not been told about — deleted again if that Save is cancelled or the wizard goes away. */
  const freshRowIdRef = useRef<string | null>(null);
  /** The wizard went away while a Save ran: its cleanup already stopped the upload. */
  const goneRef = useRef(false);
  /** That cleanup deleted the row the running Save created, so there is no ad left to report on. */
  const rowRemovedRef = useRef(false);

  const existing = created ?? ad;
  const isEdit = !!ad;
  const corner = state.format === "CORNER";

  // Going away mid-upload must not leave an open multipart session (or a
  // row nobody knows about) behind: abort the browser side, tell the
  // backend to drop the session, and remove a row created a moment ago.
  useEffect(() => {
    // Set back on mount: React's development double mount runs the cleanup once for nothing.
    goneRef.current = false;
    return () => {
      goneRef.current = true;
      const controller = abortRef.current;
      if (controller && !controller.signal.aborted) {
        controller.abort();
        const sessionId = sessionIdRef.current;
        if (sessionId) uploadService.multipartAbort(sessionId).catch(() => {});
      }
      const freshRowId = freshRowIdRef.current;
      freshRowIdRef.current = null;
      if (freshRowId) {
        rowRemovedRef.current = true;
        adService.deleteAd(freshRowId).catch(() => {});
      }
    };
  }, []);

  const cancelUpload = () => {
    const controller = abortRef.current;
    if (!controller) return;
    cancelledRef.current = true;
    controller.abort();
    const sessionId = sessionIdRef.current;
    if (sessionId) uploadService.multipartAbort(sessionId).catch(() => {});
  };

  const save = async () => {
    setSaving(true);
    cancelledRef.current = false;
    const fields = toFields(state);
    // Only the ad's own type's file is sent: a file picked before switching
    // the type while creating stays behind.
    const file = corner ? null : state.videoFile;
    const imageFile = corner ? state.imageFile : null;
    let row: Ad | null = existing;
    // Which step a failure belongs to: only a refused video or picture
    // should be reported as one — a PATCH refused after a successful
    // upload must not send the admin back to upload it again.
    let step: "create" | "video" | "image" | "patch" = "create";
    let createdNow = false;
    // A video or picture reached the ad in this attempt: the list must hear of
    // it even if the PATCH after it is refused — its row still says it has none.
    let mediaStored = false;
    try {
      if (!row) {
        row = await adService.createAd({ ...fields, isActive: false, format: state.format });
        createdNow = true;
        // The wizard went away while the row was being made, so its cleanup
        // could not see it: take it back, before an upload nobody can stop.
        if (goneRef.current) {
          adService.deleteAd(row.id).catch(() => {});
          return;
        }
        // Created in THIS attempt and not yet shown to the list — the one
        // row a cancelled upload may delete again.
        freshRowIdRef.current = row.id;
        setCreated(row);
      }

      if (file) {
        step = "video";
        const controller = new AbortController();
        abortRef.current = controller;
        sessionIdRef.current = null;
        setUpload({ percent: 0, phase: "uploading" });
        try {
          await uploadAdVideo({
            adId: row.id,
            file,
            signal: controller.signal,
            onProgress: (percent) => setUpload({ percent, phase: "uploading" }),
            onSession: (sessionId) => {
              sessionIdRef.current = sessionId;
            },
          });
          setUpload({ percent: 100, phase: "attaching" });
          row = await adService.attachVideo(row.id, {
            relativePath: AD_VIDEO_RELATIVE_PATH,
            isSkippable: fields.isSkippable,
            skipAfterSeconds: fields.skipAfterSeconds,
          });
        } finally {
          abortRef.current = null;
          sessionIdRef.current = null;
          setUpload(null);
        }
        // The file is on the ad now: nothing left that a cancel should throw
        // away, and if the PATCH below is refused, the next Save must not
        // upload the same video again.
        freshRowIdRef.current = null;
        mediaStored = true;
        setMediaStoredHere(true);
        setState((prev) =>
          prev.videoFile === file ? { ...prev, videoFile: null, videoFileDurationSeconds: null } : prev,
        );
        setCreated(row);
      }

      if (imageFile) {
        step = "image";
        const controller = new AbortController();
        abortRef.current = controller;
        sessionIdRef.current = null;
        setImageUploading(true);
        try {
          row = await adService.uploadImage(row.id, imageFile, controller.signal);
        } finally {
          abortRef.current = null;
          setImageUploading(false);
        }
        // As with the video: the picture is on the ad now, so a cancel has
        // nothing to throw away and a refused PATCH must not upload it again.
        freshRowIdRef.current = null;
        mediaStored = true;
        setMediaStoredHere(true);
        setState((prev) =>
          prev.imageFile === imageFile ? { ...prev, imageFile: null, imageFileSize: null } : prev,
        );
        setCreated(row);
      }

      step = "patch";
      const changed = changedFields(row, fields);
      if (file) {
        // Went with the attach, checked there against the new length — the
        // row came back carrying them, but never let them ride twice.
        delete changed.isSkippable;
        delete changed.skipAfterSeconds;
      }
      if (Object.keys(changed).length > 0) row = await adService.updateAd(row.id, changed);
      freshRowIdRef.current = null;
      // The attach can't be aborted, so it can finish after the wizard went
      // away and its cleanup removed this new row: no "Ad created" for that.
      if (rowRemovedRef.current) return;
      toast.success(isEdit ? w.toasts.updated : w.toasts.created);
      onSaved(row);
      onClose();
    } catch (err) {
      // Gone mid-Save: the abort lands here, on the next page, and so does
      // whatever a row the cleanup deleted answers next — nothing to tell
      // anyone. Any other failure is real news: the change was not saved.
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (goneRef.current && (aborted || rowRemovedRef.current)) return;
      const freshRowId = freshRowIdRef.current;
      if (cancelledRef.current) {
        // The admin stopped the upload: the wizard stays, with the file
        // still picked, so Save can try again. A row created a moment ago
        // has nothing on it worth keeping; if it cannot be removed, the list
        // is reloaded so it is at least seen.
        if (freshRowId) {
          freshRowIdRef.current = null;
          setCreated(null);
          adService.deleteAd(freshRowId).catch(() => onStale());
        }
        toast.info(w.toasts.stopped);
        return;
      }
      if ((createdNow || mediaStored) && row) {
        // The row exists (with or without its video), or now holds its new
        // video or picture: show it in the list so neither is lost, and keep
        // the wizard open to try again.
        freshRowIdRef.current = null;
        onSaved(row);
      }
      const adGone = err instanceof ApiError && err.code === "AD_NOT_FOUND";
      // Editing, a refused PATCH leaves the new file on the live ad: "Could
      // not save" alone would read as if the old one were still there.
      const fileKept = isEdit && step === "patch" && !adGone && (mediaStored || mediaStoredHere);
      const refused =
        createdNow && step === "video"
          ? w.toasts.videoRefused
          : createdNow && step === "image"
            ? w.toasts.pictureRefused
            : fileKept
              ? corner
                ? w.toasts.pictureKept
                : w.toasts.videoKept
              : w.toasts.saveFailed;
      toast.error(refused, { description: adErrorMessage(err, t) });
      if (adGone) {
        onStale();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const uploadingNow = upload !== null || imageUploading;
  // During an upload the footer's Cancel stops it; while the server checks
  // the video (or creates the row) there is nothing to stop, so it waits.
  const cancelDisabled = saving && !(upload?.phase === "uploading" || imageUploading);

  return {
    existing,
    mediaStoredHere,
    saving,
    upload,
    imageUploading,
    uploadingNow,
    cancelDisabled,
    save,
    cancelUpload,
  };
}
