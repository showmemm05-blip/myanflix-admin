/**
 * The pure half of the "Import pictures" dialog (2026-10-20): which file
 * goes to which number, decided from the file name alone. Kept apart from
 * the dialog so it has no React in it and can be reasoned about on its own.
 */
import { IMAGE_UPLOAD_MAX_BYTES } from "@/services/api/uploadService";
import type { LotteryDreamBook } from "@/types/lottery";

/** The picture types POST /uploads/image accepts — the same list the edit dialog's picker uses. */
export const DREAM_PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const DREAM_PICTURE_ACCEPT = DREAM_PICTURE_TYPES.join(",");

/** How many digits a number has in each book, and the largest number in it. */
const BOOK_DIGITS: Record<LotteryDreamBook, number> = { "1000": 3, "100": 2 };

/** Why a picked file is left out before anything is uploaded. */
export type DreamPictureSkipReason = "no_number" | "out_of_range" | "duplicate" | "wrong_type" | "too_large";

export interface DreamPictureMatch {
  file: File;
  /** Zero-padded to the book's digits — the row's `number`. */
  number: string;
}

export interface DreamPictureSkip {
  file: File;
  reason: DreamPictureSkipReason;
}

export interface DreamPicturePlan {
  matched: DreamPictureMatch[];
  skipped: DreamPictureSkip[];
}

/**
 * The number a file name stands for: its leading digits, read as a number
 * and zero-padded to the book's digits ("27.png" and "0027-fish.png" both
 * mean 027 in Dream 1000). Null when the name does not start with a digit
 * or the number is past the book's last one.
 */
export function pictureNumber(fileName: string, book: LotteryDreamBook): string | null {
  const digits = /^\d+/.exec(fileName)?.[0];
  if (!digits) return null;
  const value = Number(digits);
  const width = BOOK_DIGITS[book];
  if (!Number.isSafeInteger(value) || value >= 10 ** width) return null;
  return String(value).padStart(width, "0");
}

/**
 * Sorts a picked set into the files that will be uploaded (one per number,
 * in the order they were picked) and the ones left out, each with its
 * reason. A number named twice keeps its first file.
 */
export function planDreamPictures(files: readonly File[], book: LotteryDreamBook): DreamPicturePlan {
  const matched: DreamPictureMatch[] = [];
  const skipped: DreamPictureSkip[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (!/^\d/.test(file.name)) {
      skipped.push({ file, reason: "no_number" });
      continue;
    }
    const number = pictureNumber(file.name, book);
    if (!number) {
      skipped.push({ file, reason: "out_of_range" });
      continue;
    }
    if (!(DREAM_PICTURE_TYPES as readonly string[]).includes(file.type)) {
      skipped.push({ file, reason: "wrong_type" });
      continue;
    }
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
      skipped.push({ file, reason: "too_large" });
      continue;
    }
    if (seen.has(number)) {
      skipped.push({ file, reason: "duplicate" });
      continue;
    }
    seen.add(number);
    matched.push({ file, number });
  }
  return { matched, skipped };
}

/**
 * Runs `work` over every index 0..count-1 with at most `limit` in flight,
 * handing out the indexes in order. `shouldStop` is read before each new
 * index: once it says so, no new work starts, but what is in flight runs
 * to its end. Resolves when every started item has finished.
 *
 * `minIntervalMs` paces the starts: no two items begin less than that far
 * apart, whichever worker starts them, so a run never exceeds
 * 60000 / minIntervalMs items a minute. The slot is claimed before any
 * await, so two workers can never share one.
 */
export async function runLimited(
  count: number,
  limit: number,
  work: (index: number) => Promise<void>,
  shouldStop: () => boolean,
  minIntervalMs = 0,
): Promise<void> {
  let next = 0;
  let nextSlot = 0;
  const worker = async () => {
    while (next < count && !shouldStop()) {
      const index = next++;
      const slot = Math.max(Date.now(), nextSlot);
      nextSlot = slot + minIntervalMs;
      const wait = slot - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      await work(index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, count) }, worker));
}
