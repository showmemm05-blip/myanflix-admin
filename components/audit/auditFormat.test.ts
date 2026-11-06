/**
 * The name an Ad settings row shows in the audit log, and the search that has
 * to find it (components/audit/auditFormat.ts): the server searches only what a
 * row stores, so the shown name, typed whole, asks for those rows by their type.
 * Everything else reaches the server as typed.
 *
 * Runs on Node's own test runner: `npm test`. auditFormat.ts imports through
 * the `@/` alias, which Node does not know, so a resolve hook maps it to the
 * admin root before the module is loaded.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import nodeModule, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ADMIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// The installed @types/node predates `module.registerHooks` (Node ≥ 22.15),
// so the little of its shape this file uses is typed here.
interface ResolveResult {
  url: string;
  shortCircuit?: boolean;
}
type ResolveHook = (
  specifier: string,
  context: object,
  nextResolve: (specifier: string, context: object) => ResolveResult,
) => ResolveResult;
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

// tsconfig's `@/*` → `./*`, for Node: `@/lib/x` becomes <admin>/lib/x.ts.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const base = path.join(ADMIN_ROOT, specifier.slice(2));
    const file =
      [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((candidate) => existsSync(candidate)) ?? base;
    return { url: pathToFileURL(file).href, shortCircuit: true };
  },
});

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way,
// after the hook above is in place.
const load = createRequire(import.meta.url);
const { auditSearchParams, targetName } = load("./auditFormat.ts") as typeof import("./auditFormat");
const { translations } = load("@/lib/i18n/translations") as typeof import("@/lib/i18n/translations");

const AD_SETTINGS = "advertisement_settings";
const EN_NAME = translations.en.audit.targetTypes.advertisement_settings;
const MM_NAME = translations.mm.audit.targetTypes.advertisement_settings;

const byType = { search: undefined, targetType: AD_SETTINGS };

describe("targetName — what a row's target is called", () => {
  it("shows the page's name for Ad settings rows, in the admin's language, even on old rows", () => {
    const entry = { targetType: AD_SETTINGS, targetLabel: "Advertisement playback rules" };
    assert.equal(targetName(translations.en, entry), EN_NAME);
    assert.equal(targetName(translations.mm, entry), MM_NAME);
  });

  it("keeps the stored label on every other row", () => {
    assert.equal(targetName(translations.en, { targetType: "advertisement", targetLabel: "Summer" }), "Summer");
    assert.equal(targetName(translations.en, { targetType: "advertisement", targetLabel: null }), null);
  });
});

describe("auditSearchParams — the search box as the server's query", () => {
  it("asks for the rows by type when the name they show is typed, in either language", () => {
    assert.deepEqual(auditSearchParams(EN_NAME, ""), byType);
    assert.deepEqual(auditSearchParams(MM_NAME, ""), byType);
  });

  it("does not mind the case or the spaces", () => {
    assert.deepEqual(auditSearchParams("ad settings", ""), byType);
    assert.deepEqual(auditSearchParams("AD  SETTINGS", ""), byType);
    assert.deepEqual(auditSearchParams(MM_NAME.replace(/\s/g, ""), ""), byType);
  });

  it("keeps part of the name a plain search, so other rows with those letters stay", () => {
    for (const part of ["Ad", "settings", "Ad settings changed"]) {
      assert.deepEqual(auditSearchParams(part, ""), { search: part, targetType: undefined });
    }
  });

  it("passes everything else through as typed, and leaves empty values out", () => {
    assert.deepEqual(auditSearchParams("Summer sale", "advertisement"), {
      search: "Summer sale",
      targetType: "advertisement",
    });
    assert.deepEqual(auditSearchParams("", ""), { search: undefined, targetType: undefined });
    assert.deepEqual(auditSearchParams("", AD_SETTINGS), { search: undefined, targetType: AD_SETTINGS });
  });

  it("leaves a different chosen type alone: these rows aren't in it", () => {
    assert.deepEqual(auditSearchParams(EN_NAME, "advertisement"), {
      search: EN_NAME,
      targetType: "advertisement",
    });
  });

  it("finds the rows when Ad settings is already the chosen type", () => {
    assert.deepEqual(auditSearchParams(EN_NAME, AD_SETTINGS), byType);
  });
});
