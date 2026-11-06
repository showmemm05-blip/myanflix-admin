/**
 * The upload pipeline's retry rule (audit FE-001 fix round, 2026-10-09):
 * what `isTransient` lets `withTransientRetry` try again — in particular
 * that the status-0 "unreachable" ApiError apiClient now throws for a
 * network failure counts as transient, the way fetch's bare TypeError
 * always did, so a blip is retried with back-off and, if it keeps failing,
 * the bulk queue parks the job as "offline" (auto-resume) instead of
 * "failed".
 *
 * Runs on Node's own test runner: `npm test`. bundle-upload.ts has a class
 * with a parameter property, which Node's strip-only TypeScript refuses, so
 * a load hook transpiles the admin's own .ts files with its own TypeScript,
 * and a resolve hook maps the `@/` alias (and uploadService's extension-less
 * `./apiClient`) to real files — one copy of apiClient, so one ApiError
 * class for `instanceof`.
 */
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
interface LoadResult {
  format?: string;
  source?: string;
  shortCircuit?: boolean;
}
type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (specifier: string, context: object) => ResolveResult,
) => ResolveResult;
type LoadHook = (url: string, context: object, nextLoad: (url: string, context: object) => LoadResult) => LoadResult;
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook; load: LoadHook }) => void;
};

const load = createRequire(import.meta.url);
const ts = load("typescript") as typeof import("typescript");

const tsFile = (base: string) =>
  [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((candidate) => existsSync(candidate));

registerHooks({
  resolve(specifier, context, nextResolve) {
    // tsconfig's `@/*` → `./*`: `@/lib/x` becomes <admin>/lib/x.ts.
    if (specifier.startsWith("@/")) {
      const base = path.join(ADMIN_ROOT, specifier.slice(2));
      return { url: pathToFileURL(tsFile(base) ?? base).href, shortCircuit: true };
    }
    // `./apiClient` without its extension (uploadService.ts): fine for tsc,
    // not for Node.
    const parent = context.parentURL;
    if (/^\.\.?\//.test(specifier) && !path.extname(specifier) && parent?.startsWith("file:")) {
      const file = tsFile(path.resolve(path.dirname(fileURLToPath(parent)), specifier));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.startsWith("file:") || !/\.tsx?$/.test(url) || url.includes("/node_modules/")) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
      fileName: fileURLToPath(url),
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    });
    return { format: "commonjs", source: outputText, shortCircuit: true };
  },
});

// The real token store reads window.localStorage; give it one.
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  },
};

// Loaded after the hooks and the storage shim are in place (see
// apiClient.test.ts for why `load` rather than `import`).
const { isTransient, withTransientRetry } = load("./bundle-upload.ts") as typeof import("./bundle-upload");
const { ApiError, SERVER_UNREACHABLE_CODE } = load("@/services/api/apiClient") as typeof import("@/services/api/apiClient");
const { uploadService } = load("@/services/api/uploadService") as typeof import("@/services/api/uploadService");
const { tokenStore } = load("@/lib/auth/token-store") as typeof import("@/lib/auth/token-store");

// bundle-upload.ts's own CHUNK_RETRY_ATTEMPTS and CHUNK_RETRY_MAX_MS, which
// it does not export; one tick of the larger covers every back-off step.
const RETRY_ATTEMPTS = 5;
const RETRY_MAX_MS = 8000;

let fetchCalls = 0;
let responder: () => Response | Promise<Response> = () => {
  throw new Error("no fetch responder set");
};
const realFetch = globalThis.fetch;

beforeEach(() => {
  fetchCalls = 0;
  storage.clear();
  tokenStore.setSession("access", "refresh", { id: "u1", username: "staff", role: "ADMIN" });
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return responder();
  }) as typeof fetch;
});

afterEach(() => {
  mock.timers.reset();
  globalThis.fetch = realFetch;
});

/** Lets every pending microtask run: an attempt failed and `sleep` armed its (mocked) timer. */
const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

const multipartInit = (signal: AbortSignal) =>
  uploadService.multipartInit("movie", "m1", "original.mp4", 1, "original.mp4", signal);

describe("isTransient — what the upload pipeline retries", () => {
  it("the status-0 'unreachable' ApiError counts, as fetch's bare TypeError always did", () => {
    assert.equal(isTransient(new ApiError("x", 0, SERVER_UNREACHABLE_CODE)), true);
    assert.equal(isTransient(new TypeError("Failed to fetch")), true);
  });

  it("the backend hiccuping (5xx, 408, 429) is transient; any other 4xx is a real rejection", () => {
    for (const status of [500, 502, 503, 504, 408, 429]) {
      assert.equal(isTransient(new ApiError("x", status)), true, `status ${status}`);
    }
    for (const status of [400, 401, 403, 404, 409, 413, 422]) {
      assert.equal(isTransient(new ApiError("x", status)), false, `status ${status}`);
    }
  });

  it("the user's own Pause/Cancel and anything unknown are never retried", () => {
    assert.equal(isTransient(new DOMException("The user aborted a request.", "AbortError")), false);
    assert.equal(isTransient(new Error("Video processing failed")), false);
    assert.equal(isTransient("nope"), false);
  });
});

describe("withTransientRetry over apiClient — a network blip keeps retrying", () => {
  it("the real multipartInit under a network failure is retried with back-off, then fails as 'unreachable'", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    responder = () => Promise.reject(new TypeError("Failed to fetch"));
    const signal = new AbortController().signal;

    const pending = withTransientRetry(() => multipartInit(signal), signal);
    pending.catch(() => {}); // asserted below; handled meanwhile

    for (let attempt = 1; attempt < RETRY_ATTEMPTS; attempt++) {
      await settled();
      assert.equal(fetchCalls, attempt, "the next attempt waits for the back-off");
      mock.timers.tick(RETRY_MAX_MS);
    }

    await assert.rejects(pending, (err: unknown) => {
      assert.ok(err instanceof ApiError, `expected an ApiError, got ${String(err)}`);
      assert.equal(err.status, 0);
      assert.equal(err.code, SERVER_UNREACHABLE_CODE);
      assert.equal(isTransient(err), true, "so the bulk queue parks the job as offline, not failed");
      return true;
    });
    assert.equal(fetchCalls, RETRY_ATTEMPTS);
  });

  it("a real rejection (4xx) is thrown at once, without a retry", async () => {
    responder = () =>
      new Response(JSON.stringify({ success: false, message: "Validation failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    const signal = new AbortController().signal;

    await assert.rejects(withTransientRetry(() => multipartInit(signal), signal), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 400);
      assert.equal(err.message, "Validation failed");
      return true;
    });
    assert.equal(fetchCalls, 1);
  });

  it("the user's own abort during the back-off ends the retry with their AbortError", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    responder = () => Promise.reject(new TypeError("Failed to fetch"));
    const controller = new AbortController();

    const pending = withTransientRetry(() => multipartInit(controller.signal), controller.signal);
    pending.catch(() => {});
    await settled();
    assert.equal(fetchCalls, 1);
    controller.abort();

    await assert.rejects(pending, (err: unknown) => err instanceof DOMException && err.name === "AbortError");
    assert.equal(fetchCalls, 1);
  });
});
