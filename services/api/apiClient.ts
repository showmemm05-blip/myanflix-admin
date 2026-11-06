/**
 * Central HTTP client for MyanFlix admin services. Talks to the real
 * NestJS backend, attaches the stored access token, and transparently
 * retries once (via a single-flight refresh) on a 401 before giving up.
 *
 * Every endpoint responds with `{ success: true, data }` on success or
 * `{ success: false, message }` on failure — this client unwraps that
 * envelope so callers just get `data` back (or a thrown ApiError).
 *
 * Only the server REFUSING the session ends it (audit FE-001, the H-20 rule
 * the website and the phone app already follow): a refresh that fails for a
 * passing reason — offline, DNS, a timeout, a 5xx or 429 while the API
 * restarts — keeps the tokens and surfaces as a status-0 ApiError, so the
 * page offers Retry instead of the login screen. GETs and the refresh call
 * also give up after REQUEST_TIMEOUT_MS (FE-022) rather than leaving a
 * skeleton up until the browser gives up; writes stay untimed unless the
 * call asks for a timeout of its own.
 */
import { tokenStore, notifyUnauthorized } from "@/lib/auth/token-store";
import { LANGUAGE_STORAGE_KEY, translations } from "@/lib/i18n/translations";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

/** Backend origin (no /api suffix) — used to resolve relative asset paths like /storage/... into absolute URLs. */
export const API_ORIGIN = new URL(API_BASE_URL).origin;

/**
 * How long a GET (and the refresh call) may wait for an answer. Writes are
 * not timed by default: an upload or a long report is not a stalled
 * connection. The website's client uses the same 20 s.
 */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * `ApiError.code` of the two errors this client raises on its own (the
 * backend never sends either): no answer arrived at all — offline, DNS, the
 * timeout, a 5xx mid-deploy — and the server refusing the session.
 */
export const SERVER_UNREACHABLE_CODE = "SERVER_UNREACHABLE";
export const SESSION_EXPIRED_CODE = "SESSION_EXPIRED";

export class ApiError extends Error {
  status: number;
  /** The backend's machine-readable `code`, when the error envelope carries one (e.g. "HOME_PROMO_NOT_FOUND"), or one of the client's own above. */
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** True for the status-0 ApiError: the server could not be reached, so nothing is known about the session. */
export function isUnreachable(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 0;
}

/**
 * The two messages above in the staff member's own language. Pages show
 * `err.message` as it comes, so it has to be bilingual at the source: the
 * language is read from the key LanguageProvider stores (English until
 * Burmese is chosen — the provider's own default).
 */
function clientMessage(key: "serverUnreachable" | "sessionExpired"): string {
  let stored: string | null = null;
  try {
    stored = typeof window === "undefined" ? null : window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Storage refused (a locked-down private window): English.
  }
  return translations[stored === "mm" ? "mm" : "en"].shared[key];
}

function serverUnreachableError(): ApiError {
  return new ApiError(clientMessage("serverUnreachable"), 0, SERVER_UNREACHABLE_CODE);
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Any plain object of query params — accepts named DTO interfaces without an index signature. */
  params?: object;
  body?: unknown;
  /** Skip attaching the access token / triggering refresh-on-401 (auth endpoints). */
  skipAuth?: boolean;
  /**
   * Per-call timeout in ms, for any method: on a GET it replaces the 20 s
   * default (0 switches it off); a write, untimed by default, is timed only
   * when it passes one.
   */
  timeoutMs?: number;
}

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);
  if (params) {
    Object.entries(params as Record<string, unknown>).forEach(
      ([key, value]) => {
        if (value !== undefined && value !== null)
          url.searchParams.set(key, String(value));
      },
    );
  }
  return url.toString();
}

/**
 * What one POST /auth/refresh said about the session:
 * - refreshed   — a new pair is stored; retry the request with it.
 * - rejected    — the server answered 400, 401 or 403: the refresh token is
 *                 really dead (invalid, expired, reused, revoked, or the
 *                 account is no longer active). Only this ends the session.
 * - unreachable — anything else: no response at all, a timeout, a 5xx, a
 *                 429, a body that is not our envelope (a captive portal's
 *                 page). No verdict: the tokens stay exactly as they were.
 */
export type RefreshOutcome =
  | { kind: "refreshed"; accessToken: string }
  | { kind: "rejected" }
  | { kind: "unreachable" };

/**
 * Did the server really refuse the refresh token? `status` is the HTTP
 * status of the response, or null when there was no response at all.
 * 400 counts too: the backend's DTO check refused the stored token's very
 * shape, so the same token will never be accepted.
 */
export function classifyRefreshFailure(status: number | null): RefreshOutcome {
  if (status === 400 || status === 401 || status === 403) return { kind: "rejected" };
  return { kind: "unreachable" };
}

let refreshPromise: Promise<RefreshOutcome> | null = null;

/** Single-flight: every 401 arriving while a refresh runs waits for that one. */
function refreshOnce(): Promise<RefreshOutcome> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * The same single-flight refresh the 401 retry below uses, for a caller that
 * is not inside a request — the socket, when the server refuses its
 * reconnect with a token that expired while it was offline. Resolves to
 * the fresh access token; to the token already stored when the server could
 * not be reached (not a dead session — the socket's own growing pause tries
 * again); or null when the session is really gone.
 */
export async function refreshSession(): Promise<string | null> {
  const outcome = await refreshOnce();
  if (outcome.kind === "refreshed") return outcome.accessToken;
  return outcome.kind === "unreachable" ? tokenStore.getAccessToken() : null;
}

/**
 * Cross-tab guard. The token store is shared localStorage, and the backend
 * accepts each refresh token exactly once — so when two tabs refresh at the
 * same moment, the loser's 401 is not a dead session: the winner has (or is
 * about to have) written a fresh pair. If the stored refresh token is no
 * longer the one we sent, hand back the access token the winner stored
 * instead of null, so the loser retries instead of clearing the store.
 */
function tokenRotatedByAnotherTab(sent: string): string | null {
  const stored = tokenStore.getRefreshToken();
  return stored && stored !== sent ? tokenStore.getAccessToken() : null;
}

async function refreshAccessToken(): Promise<RefreshOutcome> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return { kind: "rejected" };

  // Whatever goes wrong below, a pair another tab stored meanwhile is the
  // answer — it is newer than the token this request sent.
  const rotatedOr = (fallback: RefreshOutcome): RefreshOutcome => {
    const rotated = tokenRotatedByAnotherTab(refreshToken);
    return rotated ? { kind: "refreshed", accessToken: rotated } : fallback;
  };

  let response: Response;
  try {
    response = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      // A stalled refresh would hold every waiting request with it. No
      // answer is not a refusal, so it lands on "unreachable" below.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return rotatedOr({ kind: "unreachable" });
  }
  if (!response.ok) return rotatedOr(classifyRefreshFailure(response.status));

  const json = await response.json().catch(() => null);
  if (json?.success === false) return rotatedOr({ kind: "rejected" });
  const nextAccessToken: string | undefined = json?.data?.accessToken;
  const nextRefreshToken: string | undefined = json?.data?.refreshToken;
  if (!nextAccessToken || !nextRefreshToken) {
    // A 2xx with no token pair is not the backend refusing anything (it
    // answers a refusal with 401) — typically a captive portal's page.
    return rotatedOr({ kind: "unreachable" });
  }

  tokenStore.updateTokens(nextAccessToken, nextRefreshToken);
  return { kind: "refreshed", accessToken: nextAccessToken };
}

/**
 * `AbortSignal.any()`, with the same thing by hand for a browser without it
 * (Chrome < 116, Safari < 17.4, Firefox < 124): one signal that aborts, with
 * the same reason, as soon as either input does.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

/**
 * The abort signal for one request: the caller's own, the timeout, or
 * both. Only a GET gets a timeout by default (see REQUEST_TIMEOUT_MS); an
 * explicit `timeoutMs` applies to any method.
 */
function requestSignal(options: RequestOptions): AbortSignal | undefined {
  const isRead = (options.method ?? "GET").toUpperCase() === "GET";
  const timeoutMs = options.timeoutMs ?? (isRead ? REQUEST_TIMEOUT_MS : 0);
  if (timeoutMs <= 0) return options.signal ?? undefined;
  const timeout = AbortSignal.timeout(timeoutMs);
  return options.signal ? anySignal([options.signal, timeout]) : timeout;
}

/** One answered attempt: the response, and the signal it ran under — its body is still read under that same signal. */
interface FetchAttempt {
  response: Response;
  signal: AbortSignal | undefined;
}

async function performFetch(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<FetchAttempt> {
  const { params, body, headers, skipAuth: _skipAuth, timeoutMs: _timeoutMs, ...rest } = options;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  // Both built outside the try: a throw while composing the URL or the
  // signal would be a bug here, not the server being unreachable.
  const url = buildUrl(path, params);
  const signal = requestSignal(options);

  try {
    const response = await fetch(url, {
      ...rest,
      signal,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: isFormData
        ? (body as FormData)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });
    return { response, signal };
  } catch (err) {
    // The caller's own abort (a cancelled upload, a page that moved on)
    // stays recognisable as one — bundle-upload.ts and the chapters page
    // check its name. Anything else that threw before an answer arrived
    // (offline, DNS, the timeout above) is "unreachable": status 0, so
    // ErrorState offers Retry.
    if (options.signal?.aborted) throw err;
    throw serverUnreachableError();
  }
}

/**
 * A body read that failed. The body streams under the request's own signal,
 * so a timeout (or the caller's abort) that fires between the headers and
 * the last byte rejects the read, not fetch() — the same two verdicts as
 * performFetch, or a stalled GET would surface as a body-less "failed"
 * carrying the response's own status. Returns for any other failure (a body
 * that is not JSON), which the caller handles as before.
 */
function throwIfAborted(err: unknown, attempt: FetchAttempt, options: RequestOptions): void {
  if (options.signal?.aborted) throw err;
  if (attempt.signal?.aborted) throw serverUnreachableError();
}

/**
 * The authenticated fetch with the refresh-on-401 retry, before any envelope
 * handling — shared by the JSON path below and by `getBlob`, which needs the
 * raw response body (a streamed PNG) rather than `{ success, data }`.
 */
async function authenticatedFetch(
  path: string,
  options: RequestOptions,
): Promise<FetchAttempt> {
  const token = options.skipAuth ? null : tokenStore.getAccessToken();
  let attempt = await performFetch(path, options, token);

  if (attempt.response.status === 401 && !options.skipAuth) {
    const outcome = await refreshOnce();

    if (outcome.kind === "refreshed") {
      attempt = await performFetch(path, options, outcome.accessToken);
    } else if (outcome.kind === "rejected") {
      tokenStore.clear();
      notifyUnauthorized();
      throw new ApiError(clientMessage("sessionExpired"), 401, SESSION_EXPIRED_CODE);
    } else {
      // No verdict on the session: the tokens stay, the page offers Retry.
      throw serverUnreachableError();
    }
  }

  return attempt;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const attempt = await authenticatedFetch(path, options);
  const { response } = attempt;

  if (response.status === 204) return undefined as T;

  const json = await response.json().catch((err: unknown) => {
    throwIfAborted(err, attempt, options);
    return null;
  });

  if (!response.ok || !json || json.success === false) {
    const message = json?.message ?? `Request to ${path} failed`;
    const code = typeof json?.code === "string" ? json.code : undefined;
    throw new ApiError(message, response.status, code);
  }

  return json.data as T;
}

/**
 * Binary GET — for routes that stream a file (the bank screenshot) instead of
 * the JSON envelope. Same token/refresh handling as `request`; on failure the
 * body IS the envelope (AllExceptionsFilter), so the message is still read
 * from it. The caller owns the Blob (object URL + revoke).
 */
async function getBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const attempt = await authenticatedFetch(path, {
    ...options,
    method: "GET",
    // No JSON content-type on a body-less GET for an image.
    headers: { Accept: "image/png,*/*", ...options.headers },
  });
  const { response } = attempt;
  if (!response.ok) {
    const json = await response.json().catch((err: unknown) => {
      throwIfAborted(err, attempt, options);
      return null;
    });
    throw new ApiError(json?.message ?? `Request to ${path} failed`, response.status);
  }
  return response.blob().catch((err: unknown) => {
    throwIfAborted(err, attempt, options);
    throw err;
  });
}

export const apiClient = {
  getBlob,
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
