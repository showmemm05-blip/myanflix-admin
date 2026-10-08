// Security-header contract for the admin (audit M-31, 2026-10-06).
// Run with `npm test` (Node's built-in runner; Node strips the TS types in
// next.config.ts on import, no extra tooling needed).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import nextConfig, {
  OPEN_CONNECT_SRC_WARNING,
  buildSecurityHeaders,
  extraConnectOrigins,
} from "./next.config.ts";

const API = "http://10.0.0.5:3001/api";
// The origin the browser PUTs uploads to (backend MINIO_PUBLIC_ENDPOINT),
// which is NOT the API origin — a different port at the very least.
const MINIO = "http://10.0.0.5:8443";

function headerMap(headers) {
  return Object.fromEntries(headers.map((h) => [h.key.toLowerCase(), h.value]));
}

function cspDirectives(csp) {
  return Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  );
}

/** Browser-side check: does this connect-src list allow a request to `origin`? */
function connectSrcAllows(connectSrc, origin) {
  const url = new URL(origin);
  return connectSrc.some(
    (v) => v === "*" || v === url.protocol || v === url.origin,
  );
}

describe("admin next.config security headers", () => {
  it("does not advertise the framework", () => {
    assert.equal(nextConfig.poweredByHeader, false);
  });

  it("applies the header set to every route", async () => {
    assert.equal(typeof nextConfig.headers, "function");
    const routes = await nextConfig.headers();
    assert.equal(routes.length, 1);
    assert.equal(routes[0].source, "/:path*");
    const h = headerMap(routes[0].headers);
    assert.ok(h["content-security-policy"]);
    assert.equal(h["x-frame-options"], "DENY");
    assert.equal(h["x-content-type-options"], "nosniff");
    assert.equal(h["referrer-policy"], "strict-origin-when-cross-origin");
    assert.match(h["permissions-policy"], /camera=\(\)/);
    assert.match(h["permissions-policy"], /microphone=\(\)/);
    assert.match(h["permissions-policy"], /geolocation=\(\)/);
  });

  it("CSP forbids framing, plugins and foreign form posts", () => {
    const h = headerMap(
      buildSecurityHeaders({ apiBaseUrl: API, isDev: false }),
    );
    const csp = cspDirectives(h["content-security-policy"]);
    assert.deepEqual(csp["frame-ancestors"], ["'none'"]);
    assert.deepEqual(csp["object-src"], ["'none'"]);
    assert.deepEqual(csp["base-uri"], ["'self'"]);
    assert.deepEqual(csp["form-action"], ["'self'"]);
    assert.deepEqual(csp["default-src"], ["'self'"]);
  });

  it("with the MinIO origin configured, CSP only lets the page talk to itself, the API and MinIO", () => {
    const h = headerMap(
      buildSecurityHeaders({
        apiBaseUrl: API,
        isDev: false,
        extraConnectSrc: MINIO,
      }),
    );
    const csp = cspDirectives(h["content-security-policy"]);
    assert.deepEqual(csp["connect-src"], [
      "'self'",
      "http://10.0.0.5:3001",
      "ws://10.0.0.5:3001",
      MINIO,
    ]);
    // The exfiltration channel from the audit: a script must not be able to
    // POST a stolen token to an attacker's host.
    assert.ok(
      !csp["connect-src"].some(
        (v) => v === "*" || v === "http:" || v === "https:",
      ),
    );
  });

  it("without the MinIO origin configured, connect-src stays OPEN: uploads work but so does token exfiltration", () => {
    // Book PDF upload, Edit Movie > Replace video and (flagged) bulk upload all
    // PUT straight to the backend's MINIO_PUBLIC_ENDPOINT, an origin this
    // build cannot know. An operator who has not set CSP_CONNECT_SRC_EXTRA
    // must not get a silently broken admin, so connect-src stays open — which
    // also means the audit's exfiltration channel is NOT closed in that build.
    // This test documents that gap on purpose; the build-time warning and
    // .env.example (tests below) are what steer the operator to close it.
    const ATTACKER = "https://evil.example";
    for (const extraConnectSrc of [undefined, "", "   ", "not a url"]) {
      const h = headerMap(
        buildSecurityHeaders({
          apiBaseUrl: API,
          isDev: false,
          extraConnectSrc,
        }),
      );
      const csp = cspDirectives(h["content-security-policy"]);
      assert.deepEqual(csp["connect-src"], [
        "'self'",
        "http://10.0.0.5:3001",
        "ws://10.0.0.5:3001",
        "http:",
        "https:",
      ]);
      assert.ok(
        connectSrcAllows(csp["connect-src"], MINIO),
        `PUT to ${MINIO} must be allowed`,
      );
      assert.ok(
        connectSrcAllows(csp["connect-src"], ATTACKER),
        "open default: a foreign host is still reachable (M-31 hardened, not closed)",
      );
    }
    // ...and the moment the operator sets it, that same host is refused.
    const locked = cspDirectives(
      headerMap(
        buildSecurityHeaders({
          apiBaseUrl: API,
          isDev: false,
          extraConnectSrc: MINIO,
        }),
      )["content-security-policy"],
    );
    assert.ok(connectSrcAllows(locked["connect-src"], MINIO));
    assert.ok(!connectSrcAllows(locked["connect-src"], ATTACKER));
  });

  it("the build warning tells the operator exactly what to set and where", () => {
    assert.match(OPEN_CONNECT_SRC_WARNING, /SECURITY/);
    assert.match(OPEN_CONNECT_SRC_WARNING, /CSP_CONNECT_SRC_EXTRA=http:\/\//);
    assert.match(OPEN_CONNECT_SRC_WARNING, /MINIO_PUBLIC_ENDPOINT/);
    assert.match(OPEN_CONNECT_SRC_WARNING, /admin\/\.env\b/);
    assert.match(OPEN_CONNECT_SRC_WARNING, /rebuild/);
    assert.match(OPEN_CONNECT_SRC_WARNING, /hardened, not closed/);
  });

  it("CSP maps an https API to wss and keeps the API path out of the origin", () => {
    const h = buildSecurityHeaders({
      apiBaseUrl: "https://api.example.com/api",
      isDev: false,
      extraConnectSrc: "https://files.example.com",
    });
    const csp = cspDirectives(headerMap(h)["content-security-policy"]);
    assert.deepEqual(csp["connect-src"], [
      "'self'",
      "https://api.example.com",
      "wss://api.example.com",
      "https://files.example.com",
    ]);
  });

  it("CSP honours several extra connect origins (direct-to-MinIO uploads) and ignores junk", () => {
    const h = buildSecurityHeaders({
      apiBaseUrl: API,
      isDev: false,
      extraConnectSrc:
        " http://10.0.0.5:9000  not a url https://files.example.com/ ",
    });
    const csp = cspDirectives(headerMap(h)["content-security-policy"]);
    assert.deepEqual(csp["connect-src"], [
      "'self'",
      "http://10.0.0.5:3001",
      "ws://10.0.0.5:3001",
      "http://10.0.0.5:9000",
      "https://files.example.com",
    ]);
    assert.deepEqual(extraConnectOrigins(" http://10.0.0.5:9000  not a url "), [
      "http://10.0.0.5:9000",
    ]);
    assert.deepEqual(extraConnectOrigins(undefined), []);
  });

  it("CSP keeps what the admin needs to render: scripts, inline styles, fonts, posters, blobs", () => {
    const h = headerMap(
      buildSecurityHeaders({ apiBaseUrl: API, isDev: false }),
    );
    const csp = cspDirectives(h["content-security-policy"]);
    // Next's hydration payload and next-themes are inline scripts.
    assert.deepEqual(csp["script-src"], ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(csp["style-src"], ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(csp["font-src"], ["'self'", "data:"]);
    // Posters/covers come from the cache server on whatever host the API
    // answered with, so images stay open; blob: is for screenshot previews.
    assert.deepEqual(csp["img-src"], [
      "'self'",
      "data:",
      "blob:",
      "http:",
      "https:",
    ]);
    assert.deepEqual(csp["media-src"], ["'self'", "blob:"]);
    assert.deepEqual(csp["worker-src"], ["'self'", "blob:"]);
  });

  it("production CSP never allows eval; dev adds it for Next's tooling only", () => {
    const prod = cspDirectives(
      headerMap(buildSecurityHeaders({ apiBaseUrl: API, isDev: false }))[
        "content-security-policy"
      ],
    );
    const dev = cspDirectives(
      headerMap(buildSecurityHeaders({ apiBaseUrl: API, isDev: true }))[
        "content-security-policy"
      ],
    );
    assert.ok(!prod["script-src"].includes("'unsafe-eval'"));
    assert.ok(dev["script-src"].includes("'unsafe-eval'"));
    assert.ok(dev["connect-src"].includes("ws:"));
    assert.ok(!prod["connect-src"].includes("ws:"));
  });

  it("falls back to the localhost API when the env is missing or unparsable", () => {
    for (const apiBaseUrl of [undefined, "", "not-a-url"]) {
      const csp = cspDirectives(
        headerMap(
          buildSecurityHeaders({
            apiBaseUrl,
            isDev: false,
            extraConnectSrc: MINIO,
          }),
        )["content-security-policy"],
      );
      assert.deepEqual(csp["connect-src"], [
        "'self'",
        "http://localhost:3001",
        "ws://localhost:3001",
        MINIO,
      ]);
    }
  });

  it("headers() warns at build time when the MinIO origin is not configured in production", async () => {
    const saved = {
      NODE_ENV: process.env.NODE_ENV,
      EXTRA: process.env.CSP_CONNECT_SRC_EXTRA,
    };
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      process.env.NODE_ENV = "production";
      delete process.env.CSP_CONNECT_SRC_EXTRA;
      let csp = cspDirectives(
        headerMap((await nextConfig.headers())[0].headers)[
          "content-security-policy"
        ],
      );
      assert.equal(warnings.length, 1);
      assert.equal(warnings[0], OPEN_CONNECT_SRC_WARNING);
      assert.ok(csp["connect-src"].includes("https:"));

      process.env.CSP_CONNECT_SRC_EXTRA = MINIO;
      csp = cspDirectives(
        headerMap((await nextConfig.headers())[0].headers)[
          "content-security-policy"
        ],
      );
      assert.equal(
        warnings.length,
        1,
        "no warning once the origin is configured",
      );
      assert.ok(csp["connect-src"].includes(MINIO));
      assert.ok(!csp["connect-src"].includes("https:"));
    } finally {
      console.warn = originalWarn;
      if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = saved.NODE_ENV;
      if (saved.EXTRA === undefined) delete process.env.CSP_CONNECT_SRC_EXTRA;
      else process.env.CSP_CONNECT_SRC_EXTRA = saved.EXTRA;
    }
  });
});

describe("CSP_CONNECT_SRC_EXTRA reaches the Docker build", () => {
  // headers() runs during `next build`, so the variable is only useful if the
  // image build actually receives it. Setting it in admin/.env must work.
  const here = new URL(".", import.meta.url);
  const dockerfile = readFileSync(new URL("Dockerfile", here), "utf8");
  const compose = readFileSync(new URL("docker-compose.yml", here), "utf8");

  it("Dockerfile declares it as a build ARG and exports it before `npm run build`", () => {
    const arg = dockerfile.indexOf("ARG CSP_CONNECT_SRC_EXTRA");
    const env = dockerfile.indexOf(
      "ENV CSP_CONNECT_SRC_EXTRA=$CSP_CONNECT_SRC_EXTRA",
    );
    const build = dockerfile.indexOf("RUN npm run build");
    assert.ok(arg >= 0, "ARG CSP_CONNECT_SRC_EXTRA missing");
    assert.ok(env > arg, "ENV CSP_CONNECT_SRC_EXTRA missing or before its ARG");
    assert.ok(build > env, "must be exported before the build step");
  });

  it("docker-compose.yml passes it from .env as a build arg", () => {
    assert.match(
      compose,
      /CSP_CONNECT_SRC_EXTRA:\s*\$\{CSP_CONNECT_SRC_EXTRA(:-)?\}/,
    );
  });

  it(".env.example sets it (uncommented) to the backend example's MINIO_PUBLIC_ENDPOINT origin", () => {
    // `cp .env.example .env` (DOCKER.md) must produce a LOCKED build, not an
    // open one, and the two example files must agree so uploads still work.
    const envValue = (file, key) => {
      const line = readFileSync(file, "utf8")
        .split(/\r?\n/)
        .find((l) => l.startsWith(`${key}=`));
      assert.ok(line, `${key} is not set (uncommented) in ${file.pathname}`);
      return line.slice(key.length + 1).trim();
    };
    const adminValue = envValue(
      new URL(".env.example", here),
      "CSP_CONNECT_SRC_EXTRA",
    );
    const backendValue = envValue(
      new URL("../backend/.env.example", here),
      "MINIO_PUBLIC_ENDPOINT",
    );
    const origins = extraConnectOrigins(adminValue);
    assert.equal(origins.length, 1, "exactly one valid origin");
    assert.equal(origins[0], new URL(backendValue).origin);
  });
});
