/**
 * Helpers for the results, prizes and payouts side of a draw (phase 3):
 * the results status tones, the sheet checks the "Enter by hand" dialog
 * runs live, the Baht → kyat sum and the words for the settings test.
 */
import type { StatusTone } from "@/components/shared/StatusBadge";
import { formatKyat } from "@/lib/currency";
import type { TranslationShape } from "@/lib/i18n/translations";
import {
  LOTTERY_LIMITS,
  LOTTERY_PRIZE_GROUP_KEYS,
  LOTTERY_PRIZE_GROUP_SHAPE,
  type LotteryDrawResults,
  type LotteryPrizeGroupKey,
  type LotteryResultGroup,
  type LotteryResultStatus,
  type LotteryResultsSourceTest,
} from "@/types/lottery";

export const RESULT_STATUS_TONES: Record<LotteryResultStatus, StatusTone> = {
  pending: "neutral",
  fetched: "info",
  published: "success",
  failed: "danger",
};

/** A rate as typed: digits, with at most the backend's four decimals, above zero. */
const RATE_PATTERN = new RegExp(`^\\d+(?:\\.\\d{1,${LOTTERY_LIMITS.exchangeRateDecimals}})?$`);

export function isExchangeRate(text: string): boolean {
  const trimmed = text.trim();
  return RATE_PATTERN.test(trimmed) && Number(trimmed) > 0;
}

/**
 * The results record as the pages read it. The backend sends the status
 * and the source in lowercase (its RESULT_STATUS_WIRE / RESULT_SOURCE_WIRE);
 * they are lowercased here as well so a record never renders as "no
 * status" over a casing difference, and `groups` is always an array.
 */
export function normalizeResults(record: LotteryDrawResults): LotteryDrawResults {
  const status = String(record.status).toLowerCase() as LotteryResultStatus;
  const source = record.source ? (String(record.source).toLowerCase() as LotteryDrawResults["source"]) : null;
  return { ...record, status, source, groups: Array.isArray(record.groups) ? record.groups : [] };
}

/** Prize per ticket in kyat: Baht × rate, to the backend's two decimals. */
export function prizeKs(baht: number, rate: number): number {
  return Math.round(baht * rate * 100) / 100;
}

/** "6,000,000" — a Baht amount, no unit (the copy adds it). */
export function formatBaht(baht: number): string {
  return baht.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** The group's label in the staff member's language. */
export function prizeGroupName(key: LotteryPrizeGroupKey, t: TranslationShape): string {
  return t.lottery.prizeGroups[key];
}

/** The nine groups in sheet order, each the stored one or an empty placeholder — a sheet is always complete on screen. */
export function sheetGroups(groups: readonly LotteryResultGroup[]): LotteryResultGroup[] {
  const byKey = new Map(groups.map((g) => [g.key, g]));
  return LOTTERY_PRIZE_GROUP_KEYS.map((key) => {
    const shape = LOTTERY_PRIZE_GROUP_SHAPE[key];
    const stored = byKey.get(key);
    return stored
      ? { ...stored, numbers: Array.isArray(stored.numbers) ? stored.numbers : [] }
      : { key, name: key, baht: 0, count: shape.count, digits: shape.digits, numbers: [], ks: null };
  });
}

/**
 * The numbers typed or pasted into one group's box: every run of digits is
 * one number. Leading zeros are kept — a Thai number is a string of digits,
 * never a count.
 */
export function parseNumbersInput(text: string): string[] {
  return text.split(/[^\d]+/).filter(Boolean);
}

export interface GroupCheck {
  numbers: string[];
  /** The group holds its full count, every number has the right digits, none repeats. */
  ok: boolean;
  wrongDigits: boolean;
  duplicate: boolean;
  /** Next to 1st prize is not the 1st prize ±1 — a warning, the backend accepts it. */
  nearFirstOff: boolean;
}

/** The live check of one group's box in the "Enter by hand" dialog. */
export function checkGroup(key: LotteryPrizeGroupKey, text: string, first?: string): GroupCheck {
  const { count, digits } = LOTTERY_PRIZE_GROUP_SHAPE[key];
  const numbers = parseNumbersInput(text);
  const wrongDigits = numbers.some((n) => n.length !== digits);
  const duplicate = new Set(numbers).size !== numbers.length;
  // Warned only once the 1st prize itself is a full number — before that there is nothing to compare with.
  const nearFirstOff = key === "nearFirst" && !!first && /^\d{6}$/.test(first) && !isNearFirst(numbers, first);
  return {
    numbers,
    ok: numbers.length === count && !wrongDigits && !duplicate,
    wrongDigits,
    duplicate,
    nearFirstOff,
  };
}

/** Next to 1st prize: the two six-digit numbers either side of the first prize (000000 and 999999 wrap to each other's neighbour). */
function isNearFirst(numbers: readonly string[], first: string): boolean {
  if (!/^\d{6}$/.test(first) || numbers.length !== 2) return false;
  const value = Number(first);
  const below = value === 0 ? 999999 : value - 1;
  const above = value === 999999 ? 0 : value + 1;
  const expected = new Set([String(below).padStart(6, "0"), String(above).padStart(6, "0")]);
  return numbers.every((n) => expected.has(n)) && new Set(numbers).size === 2;
}

/**
 * An absolute http or https address with a host and no whitespace inside —
 * what the backend's DTO accepts (`^https?://\S+$`), checked here first so
 * a stray space is refused before the request instead of after it.
 */
export function isHttpUrl(text: string): boolean {
  const trimmed = text.trim();
  if (/\s/.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return (url.protocol === "http:" || url.protocol === "https:") && url.host !== "";
  } catch {
    return false;
  }
}

/** The settings test's group summary as one line: "1st prize 1 · Next to 1st prize 2 · …", in the staff member's language. */
export function groupsSummaryText(summary: LotteryResultsSourceTest["groupsSummary"], t: TranslationShape): string | null {
  if (!Array.isArray(summary) || summary.length === 0) return null;
  const names = t.lottery.prizeGroups as Record<string, string | undefined>;
  return summary.map((g) => `${names[g.key] ?? g.key} ${g.count}`).join(" · ");
}

/** A kyat amount as the results pages print it: whole kyat, or two decimals when the sum has cents. */
export function formatKs(ks: number): string {
  return formatKyat(ks, Number.isInteger(ks) ? 0 : 2);
}
