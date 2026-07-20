/**
 * Central HTTP client for MyanFlix admin services. Talks to the real
 * NestJS backend, attaches the stored access token, and transparently
 * retries once (via a single-flight refresh) on a 401 before giving up.
 *
 * Every endpoint responds with `{ success: true, data }` on success or
 * `{ success: false, message }` on failure — this client unwraps that
 * envelope so callers just get `data` back (or a thrown ApiError).
 */
import { tokenStore, notifyUnauthorized } from "@/lib/auth/token-store";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

/** Backend origin (no /api suffix) — used to resolve relative asset paths like /storage/... into absolute URLs. */
export const API_ORIGIN = new URL(API_BASE_URL).origin;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Any plain object of query params — accepts named DTO interfaces without an index signature. */
  params?: object;
  body?: unknown;
  /** Skip attaching the access token / triggering refresh-on-401 (auth endpoints). */
  skipAuth?: boolean;
}

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);
  if (params) {
    Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;

    const json = await response.json();
    const nextAccessToken: string | undefined = json?.data?.accessToken;
    const nextRefreshToken: string | undefined = json?.data?.refreshToken;
    if (!nextAccessToken || !nextRefreshToken) return null;

    tokenStore.updateTokens(nextAccessToken, nextRefreshToken);
    return nextAccessToken;
  } catch {
    return null;
  }
}

async function performFetch(path: string, options: RequestOptions, token: string | null) {
  const { params, body, headers, skipAuth: _skipAuth, ...rest } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  return fetch(buildUrl(path, params), {
    ...rest,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.skipAuth ? null : tokenStore.getAccessToken();
  let response = await performFetch(path, options, token);

  if (response.status === 401 && !options.skipAuth) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;

    if (newToken) {
      response = await performFetch(path, options, newToken);
    } else {
      tokenStore.clear();
      notifyUnauthorized();
      throw new ApiError("Your session has expired. Please log in again.", 401);
    }
  }

  if (response.status === 204) return undefined as T;

  const json = await response.json().catch(() => null);

  if (!response.ok || !json || json.success === false) {
    const message = json?.message ?? `Request to ${path} failed`;
    throw new ApiError(message, response.status);
  }

  return json.data as T;
}

export const apiClient = {
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
