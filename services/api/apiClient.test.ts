/**
 * The admin HTTP client's session and timeout contract (audit FE-001 /
 * FE-022, 2026-10-09): only the server REFUSING a refresh (400/401/403) ends
 * the session; a refresh that cannot reach a verdict (5xx, 429, offline, a
 * timeout, a body with no tokens) keeps the tokens and fails the request
 * with a status-0 ApiError; GETs and the refresh carry a timeout (writes
 * only when they ask for one) that covers the body read as well; a caller's
 * own abort stays recognisable as one; the two messages the client composes
 * itself read in the staff member's language.
 *
 * Runs on Node's own test runner: `npm test`. apiClient.ts imports through
 * the `@/` alias, which Node does not know, so a resolve hook maps it to the
 * admin root before the module is loaded, and `window.localStorage` is a Map
 * so the real token store runs unchanged.
 */
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import nodeModule, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// The value `ApiError` below comes out of `load()`; this is the type for casts.
import type { ApiError as ApiErrorType } from "./apiClient";

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

// The real token store reads window.localStorage; give it one.
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  },
};

// Node loads a relative TypeScript file only when the path carries its full
// extension, which tsc does not allow in an `import` — so load it this way,
// after the hook and the storage shim above are in place.
const load = createRequire(import.meta.url);
const {
  ApiError,
  SERVER_UNREACHABLE_CODE,
  SESSION_EXPIRED_CODE,
  apiClient,
  classifyRefreshFailure,
  isUnreachable,
  refreshSession,
} = load("./apiClient.ts") as typeof import("./apiClient");
const { onUnauthorized, tokenStore } = load("@/lib/auth/token-store") as typeof import("@/lib/auth/token-store");
const { LANGUAGE_STORAGE_KEY, translations } = load("@/lib/i18n/translations") as typeof import("@/lib/i18n/translations");

interface FetchCall {
  url: string;
  init: RequestInit;
}
type Responder = (call: FetchCall) => Response | Promise<Response>;

const calls: FetchCall[] = [];
let responder: Responder = () => {
  throw new Error("no fetch responder set");
};
const realFetch = globalThis.fetch;
let unauthorizedCount = 0;
let unsubscribe = () => {};

beforeEach(() => {
  calls.length = 0;
  storage.clear();
  unauthorizedCount = 0;
  unsubscribe = onUnauthorized(() => {
    unauthorizedCount += 1;
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return responder(call);
  }) as typeof fetch;
});

afterEach(() => {
  unsubscribe();
  globalThis.fetch = realFetch;
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ok = (data: unknown) => json(200, { success: true, data });
const bearer = (call: FetchCall) => (call.init.headers as Record<string, string>).Authorization;
const isRefresh = (call: FetchCall) => call.url.endsWith("/auth/refresh");
const refreshCalls = () => calls.filter(isRefresh).length;

function signIn() {
  tokenStore.setSession("access-old", "refresh-old", { id: "u1", username: "staff", role: "ADMIN" });
}

/** The API after the access token expired: 401 to the old token, 200 to the new one. */
function expiredThenRefreshed(refresh: Responder): Responder {
  return (call) => {
    if (isRefresh(call)) return refresh(call);
    if (bearer(call) === "Bearer access-new") return ok({ path: new URL(call.url).pathname });
    return json(401, { success: false, message: "Unauthorized" });
  };
}

/** A fetch that never answers — except by honouring its abort signal like the real one. */
function neverAnswers(call: FetchCall): Promise<Response> {
  return new Promise((_, reject) => {
    const signal = call.init.signal;
    if (!signal) return;
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

/** Headers arrive at once; the body sends `head` and then stalls — until the request's signal aborts it, as a real fetch's body does. */
function stalledBody(call: FetchCall, head: string): Response {
  const signal = call.init.signal;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(head));
      if (!signal) return;
      if (signal.aborted) controller.error(signal.reason);
      else signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "application/json" } });
}

/** Lets every pending microtask run (a fetch answered, a body read begun). */
const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

const isAbortError = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

const rejectsWithStatus = (status: number) => (err: unknown) => {
  assert.ok(err instanceof ApiError, `expected an ApiError, got ${String(err)}`);
  assert.equal(err.status, status);
  return true;
};

describe("classifyRefreshFailure — the H-20 rule", () => {
  it("only 400, 401 and 403 are a refusal", () => {
    for (const status of [400, 401, 403]) {
      assert.deepEqual(classifyRefreshFailure(status), { kind: "rejected" }, `status ${status}`);
    }
  });

  it("a 5xx, 429, 404, 408 or no response at all is no verdict", () => {
    for (const status of [500, 502, 503, 504, 429, 404, 408, null]) {
      assert.deepEqual(classifyRefreshFailure(status), { kind: "unreachable" }, `status ${status}`);
    }
  });
});

describe("refresh on 401", () => {
  it("two requests hitting an expired token share one refresh and both retry with the new pair", async () => {
    signIn();
    responder = expiredThenRefreshed(() => ok({ accessToken: "access-new", refreshToken: "refresh-new" }));

    const [a, b] = await Promise.all([
      apiClient.get<{ path: string }>("/a"),
      apiClient.get<{ path: string }>("/b"),
    ]);

    assert.equal(a.path, "/api/a");
    assert.equal(b.path, "/api/b");
    assert.equal(refreshCalls(), 1);
    assert.equal(tokenStore.getAccessToken(), "access-new");
    assert.equal(tokenStore.getRefreshToken(), "refresh-new");
    assert.equal(unauthorizedCount, 0);
  });

  it("the server refusing the refresh (401) ends the session: tokens cleared, listeners told", async () => {
    signIn();
    responder = expiredThenRefreshed(() => json(401, { success: false, message: "Invalid refresh token" }));

    await assert.rejects(apiClient.get("/a"), rejectsWithStatus(401));

    assert.equal(tokenStore.getAccessToken(), null);
    assert.equal(tokenStore.getRefreshToken(), null);
    assert.equal(unauthorizedCount, 1);
  });

  it("a 502 from the refresh keeps the tokens and fails the request with status 0", async () => {
    signIn();
    responder = expiredThenRefreshed(() => json(502, {}));

    await assert.rejects(apiClient.get("/a"), (err: unknown) => {
      rejectsWithStatus(0)(err);
      assert.equal((err as ApiErrorType).code, SERVER_UNREACHABLE_CODE);
      assert.equal((err as Error).message, translations.en.shared.serverUnreachable);
      return true;
    });

    assert.equal(tokenStore.getAccessToken(), "access-old");
    assert.equal(tokenStore.getRefreshToken(), "refresh-old");
    assert.equal(unauthorizedCount, 0);
  });

  it("a refresh that throws (offline, DNS, its own timeout) keeps the tokens and fails with status 0", async () => {
    for (const reason of [
      new TypeError("Failed to fetch"),
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    ]) {
      signIn();
      responder = expiredThenRefreshed(() => Promise.reject(reason));

      await assert.rejects(apiClient.get("/a"), rejectsWithStatus(0));

      assert.equal(tokenStore.getRefreshToken(), "refresh-old", String(reason));
      assert.equal(unauthorizedCount, 0);
    }
  });

  it("a 2xx refresh without a token pair is no verdict either", async () => {
    signIn();
    responder = expiredThenRefreshed(() => new Response("<html>captive portal</html>", { status: 200 }));

    await assert.rejects(apiClient.get("/a"), rejectsWithStatus(0));

    assert.equal(tokenStore.getRefreshToken(), "refresh-old");
    assert.equal(unauthorizedCount, 0);
  });

  it("the refresh call itself carries a timeout signal", async () => {
    signIn();
    responder = expiredThenRefreshed(() => ok({ accessToken: "access-new", refreshToken: "refresh-new" }));

    await apiClient.get("/a");

    const refresh = calls.find(isRefresh);
    assert.ok(refresh);
    assert.ok(refresh.init.signal instanceof AbortSignal);
    assert.equal(refresh.init.signal.aborted, false);
  });

  it("a pair another tab stored meanwhile wins over a refused refresh", async () => {
    signIn();
    responder = expiredThenRefreshed((call) => {
      // The other tab rotated the pair while this refresh was in flight.
      tokenStore.updateTokens("access-new", "refresh-from-other-tab");
      void call;
      return json(401, { success: false, message: "Token already used" });
    });

    const result = await apiClient.get<{ path: string }>("/a");

    assert.equal(result.path, "/api/a");
    assert.equal(tokenStore.getRefreshToken(), "refresh-from-other-tab");
    assert.equal(unauthorizedCount, 0);
  });
});

describe("timeouts and aborts", () => {
  it("a GET that never answers fails with status 0 once its timeout fires", async () => {
    signIn();
    responder = neverAnswers;
    const started = Date.now();

    await assert.rejects(apiClient.get("/slow", { timeoutMs: 50 }), rejectsWithStatus(0));

    assert.ok(Date.now() - started >= 40, "the timeout, not something earlier, ended the wait");
    assert.equal(tokenStore.getAccessToken(), "access-old");
  });

  it("a GET carries a timeout signal; a write carries none", async () => {
    signIn();
    responder = () => ok({});

    await apiClient.get("/read");
    await apiClient.post("/write", { value: 1 });

    assert.ok(calls[0].init.signal instanceof AbortSignal);
    assert.equal(calls[1].init.signal, undefined);
  });

  it("a caller's own abort is rethrown untouched, not dressed up as an ApiError", async () => {
    signIn();
    responder = neverAnswers;
    const controller = new AbortController();

    const pending = apiClient.get("/x", { signal: controller.signal });
    controller.abort();

    await assert.rejects(pending, (err: unknown) => {
      assert.ok(!(err instanceof ApiError));
      assert.ok(err instanceof DOMException && err.name === "AbortError");
      return true;
    });
  });

  it("a write passes the caller's own signal straight through", async () => {
    signIn();
    responder = () => ok({});
    const controller = new AbortController();

    await apiClient.post("/write", {}, { signal: controller.signal });

    assert.equal(calls[0].init.signal, controller.signal);
  });

  it("a plain request that cannot reach the server fails with status 0", async () => {
    signIn();
    responder = () => Promise.reject(new TypeError("Failed to fetch"));

    await assert.rejects(apiClient.get("/a"), rejectsWithStatus(0));
    await assert.rejects(apiClient.post("/a", {}), rejectsWithStatus(0));
  });

  it("without AbortSignal.any (older browsers) the caller's abort and the timeout still both work", async () => {
    const native = Object.getOwnPropertyDescriptor(AbortSignal, "any");
    assert.ok(native, "Node has AbortSignal.any");
    Object.defineProperty(AbortSignal, "any", { ...native, value: undefined });
    try {
      signIn();
      responder = neverAnswers;

      // The caller aborts: their own error, through the hand-made signal.
      const controller = new AbortController();
      const pending = apiClient.get("/x", { signal: controller.signal });
      controller.abort();
      await assert.rejects(pending, isAbortError);
      assert.notEqual(calls[0].init.signal, controller.signal, "a combined signal, not the caller's own");

      // The timeout fires while the caller's signal stays quiet: unreachable.
      await assert.rejects(
        apiClient.get("/slow", { signal: new AbortController().signal, timeoutMs: 50 }),
        rejectsWithStatus(0),
      );
      assert.equal(calls[1].init.signal?.aborted, true, "the combined signal fired on the timeout");

      // A signal already aborted before the call is honoured at once.
      await assert.rejects(apiClient.get("/y", { signal: AbortSignal.abort() }), isAbortError);
      assert.equal(calls.length, 3);
    } finally {
      Object.defineProperty(AbortSignal, "any", native);
    }
  });

  it("an explicit timeoutMs times a write too; timeoutMs: 0 switches a GET's off", async () => {
    signIn();
    responder = neverAnswers;

    await assert.rejects(apiClient.post("/write", {}, { timeoutMs: 50 }), rejectsWithStatus(0));
    assert.ok(calls[0].init.signal instanceof AbortSignal);

    responder = () => ok({});
    await apiClient.get("/read", { timeoutMs: 0 });
    assert.equal(calls[1].init.signal, undefined);
  });

  it("a timeout that fires while the body is still streaming is 'unreachable', not a status-200 failure", async () => {
    signIn();
    responder = (call) => stalledBody(call, '{"success":true,"data":');

    await assert.rejects(apiClient.get("/slow-body", { timeoutMs: 50 }), (err: unknown) => {
      rejectsWithStatus(0)(err);
      assert.equal((err as ApiErrorType).code, SERVER_UNREACHABLE_CODE);
      return true;
    });
    assert.equal(tokenStore.getAccessToken(), "access-old");
  });

  it("getBlob: a timeout mid-body is 'unreachable' too, not a raw DOMException", async () => {
    signIn();
    responder = (call) => stalledBody(call, "PNG");

    await assert.rejects(apiClient.getBlob("/img", { timeoutMs: 50 }), (err: unknown) => {
      rejectsWithStatus(0)(err);
      assert.equal((err as ApiErrorType).code, SERVER_UNREACHABLE_CODE);
      return true;
    });
  });

  it("the caller's own abort during the body read is still theirs", async () => {
    signIn();
    responder = (call) => stalledBody(call, "{");
    const controller = new AbortController();

    const pending = apiClient.get("/x", { signal: controller.signal });
    await settled();
    controller.abort();

    await assert.rejects(pending, isAbortError);
    assert.equal(calls.length, 1);
  });

  it("a body that is simply not JSON still fails with the response's own status", async () => {
    signIn();
    responder = () => new Response("<html>not json</html>", { status: 200 });

    await assert.rejects(apiClient.get("/html"), rejectsWithStatus(200));
  });
});

describe("the client's own messages — bilingual at the source", () => {
  it("'unreachable' carries its code and reads in the staff member's language", async () => {
    signIn();
    responder = () => Promise.reject(new TypeError("Failed to fetch"));

    await assert.rejects(apiClient.get("/a"), (err: unknown) => {
      rejectsWithStatus(0)(err);
      assert.equal((err as ApiErrorType).code, SERVER_UNREACHABLE_CODE);
      assert.equal((err as Error).message, translations.en.shared.serverUnreachable);
      return true;
    });

    storage.set(LANGUAGE_STORAGE_KEY, "mm");
    await assert.rejects(apiClient.get("/a"), (err: unknown) => {
      rejectsWithStatus(0)(err);
      assert.equal((err as Error).message, translations.mm.shared.serverUnreachable);
      return true;
    });
    assert.notEqual(translations.mm.shared.serverUnreachable, translations.en.shared.serverUnreachable);
  });

  it("'session expired' is bilingual too and carries its code", async () => {
    signIn();
    storage.set(LANGUAGE_STORAGE_KEY, "mm");
    responder = expiredThenRefreshed(() => json(401, { success: false, message: "Invalid refresh token" }));

    await assert.rejects(apiClient.get("/a"), (err: unknown) => {
      rejectsWithStatus(401)(err);
      assert.equal((err as ApiErrorType).code, SESSION_EXPIRED_CODE);
      assert.equal((err as Error).message, translations.mm.shared.sessionExpired);
      return true;
    });
    assert.notEqual(translations.mm.shared.sessionExpired, translations.en.shared.sessionExpired);
  });

  it("isUnreachable is exactly the status-0 ApiError", () => {
    assert.equal(isUnreachable(new ApiError("x", 0)), true);
    assert.equal(isUnreachable(new ApiError("x", 401)), false);
    assert.equal(isUnreachable(new ApiError("x", 503)), false);
    assert.equal(isUnreachable(new TypeError("Failed to fetch")), false);
  });
});

describe("refreshSession — the socket's path", () => {
  it("hands back the fresh token, the stored one when the server is unreachable, null when refused", async () => {
    signIn();
    responder = () => ok({ accessToken: "access-new", refreshToken: "refresh-new" });
    assert.equal(await refreshSession(), "access-new");

    responder = () => json(503, {});
    assert.equal(await refreshSession(), "access-new");
    assert.equal(tokenStore.getRefreshToken(), "refresh-new");

    responder = () => json(401, { success: false, message: "Invalid refresh token" });
    assert.equal(await refreshSession(), null);
  });
});
