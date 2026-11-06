/**
 * The Advertisements pages' copy (2026-11-04, docs/ads-admin-ux-2026-11-04),
 * kept out of the big translations.ts: one module per part of the pages,
 * each owned by one builder, assembled here and wired into translations.ts
 * as `adsUi` — components read `t.adsUi.<part>.<key>`.
 *
 * Imported through the `@/` alias, not "./shared": the Node tests that load
 * translations.ts resolve `@/` paths to their .ts files, and a relative
 * import without its extension would not load there.
 */
import { howEn, howMm } from "@/lib/i18n/ads/how";
import { listEn, listMm } from "@/lib/i18n/ads/list";
import { resultsEn, resultsMm } from "@/lib/i18n/ads/results";
import { settingsEn, settingsMm } from "@/lib/i18n/ads/settings";
import { sharedEn, sharedMm } from "@/lib/i18n/ads/shared";
import { statusEn, statusMm } from "@/lib/i18n/ads/status";
import { whyEn, whyMm } from "@/lib/i18n/ads/why";
import { wizardEn, wizardMm } from "@/lib/i18n/ads/wizard";

export const adsUiEn = {
  shared: sharedEn,
  how: howEn,
  status: statusEn,
  why: whyEn,
  settings: settingsEn,
  list: listEn,
  wizard: wizardEn,
  results: resultsEn,
};

export const adsUiMm = {
  shared: sharedMm,
  how: howMm,
  status: statusMm,
  why: whyMm,
  settings: settingsMm,
  list: listMm,
  wizard: wizardMm,
  results: resultsMm,
} satisfies typeof adsUiEn;
