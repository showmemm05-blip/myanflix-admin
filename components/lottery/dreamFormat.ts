/**
 * Small helpers shared by the Dreams page, its columns and its dialogs.
 */
import type { StatusTone } from "@/components/shared/StatusBadge";
import type { TranslationShape } from "@/lib/i18n/translations";
import { ApiError } from "@/services/api/apiClient";
import type { LotteryDream } from "@/types/lottery";

/** True when customers can see the dream: it is on and has at least one name. */
function hasName(dream: Pick<LotteryDream, "nameEn" | "nameMy">): boolean {
  return !!(dream.nameEn?.trim() || dream.nameMy?.trim());
}

/** What the Status column says about a row: off, hidden for want of a name, or shown. */
export type DreamStatus = "shown" | "unnamed" | "off";

export function dreamStatus(dream: LotteryDream): DreamStatus {
  if (!dream.isActive) return "off";
  return hasName(dream) ? "shown" : "unnamed";
}

export const DREAM_STATUS_TONES: Record<DreamStatus, StatusTone> = {
  shown: "success",
  unnamed: "warning",
  off: "neutral",
};

/** The file name the browser saves an export under — the backend's own Content-Disposition name. */
export function exportFileName(book: string): string {
  return `dreams-${book}.xlsx`;
}

/** Hands a Blob to the browser as a download, then frees the object URL. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoked after the click has been handed off; revoking at once can cancel
  // the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The words for a refused request: the backend's own sentence, or the generic one. */
export function dreamErrorMessage(err: unknown, t: TranslationShape): string {
  return err instanceof ApiError ? err.message : t.common.somethingWentWrong;
}
