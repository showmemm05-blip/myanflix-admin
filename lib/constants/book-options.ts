/**
 * The languages the dashboard offers when adding an edition.
 *
 * A curated list, not an exhaustive one: the backend validates the SHAPE of
 * a language code rather than membership of any list, so adding a language
 * here is a one-line change and never needs a deploy on the server side.
 *
 * `label` is the endonym — what speakers call their own language — because
 * that is what an admin picking a translation is looking for; `english` is
 * the secondary line that makes the list scannable for everyone else.
 */
export interface BookLanguageOption {
  code: string;
  label: string;
  english: string;
}

export const BOOK_LANGUAGES: BookLanguageOption[] = [
  { code: "my", label: "မြန်မာ", english: "Burmese" },
  { code: "en", label: "English", english: "English" },
  { code: "th", label: "ไทย", english: "Thai" },
  { code: "zh-Hans", label: "简体中文", english: "Chinese (Simplified)" },
  { code: "zh-Hant", label: "繁體中文", english: "Chinese (Traditional)" },
  { code: "ja", label: "日本語", english: "Japanese" },
  { code: "ko", label: "한국어", english: "Korean" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
  { code: "id", label: "Bahasa Indonesia", english: "Indonesian" },
  { code: "vi", label: "Tiếng Việt", english: "Vietnamese" },
  { code: "ms", label: "Bahasa Melayu", english: "Malay" },
  { code: "fr", label: "Français", english: "French" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "de", label: "Deutsch", english: "German" },
  { code: "ru", label: "Русский", english: "Russian" },
  { code: "ar", label: "العربية", english: "Arabic" },
];

const BY_CODE = new Map(BOOK_LANGUAGES.map((l) => [l.code, l]));

/** The endonym for a code, falling back to the code itself for anything unlisted. */
export function languageLabel(code: string): string {
  return BY_CODE.get(code)?.label ?? code;
}

/** "မြန်မာ (Burmese)" — for places that have room for both. */
export function languageFullLabel(code: string): string {
  const option = BY_CODE.get(code);
  if (!option) return code;
  return option.label === option.english
    ? option.label
    : `${option.label} (${option.english})`;
}

/** The languages a book does NOT yet have — what the "add language" picker offers. */
export function availableLanguages(taken: string[]): BookLanguageOption[] {
  const used = new Set(taken);
  return BOOK_LANGUAGES.filter((l) => !used.has(l.code));
}
