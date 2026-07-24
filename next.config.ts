import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained server bundle (.next/standalone) with
  // only the node_modules actually used traced in — what the Dockerfile
  // copies into the final image instead of the whole node_modules tree.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      // Poster/cover images are served from the storage server via the cache
      // server, not directly from the backend.
      { protocol: "http", hostname: "localhost", port: "8080", pathname: "/movies/**" },
    ],
    // The cache server genuinely runs on localhost in dev — opt back in to
    // fetching images from it despite Next's default SSRF guard against
    // private IPs.
    dangerouslyAllowLocalIP: true,
    // Next's server-side image optimizer runs inside this container, where
    // "localhost:8080" means the container itself, not the cache server —
    // there's no single hostname that's correct for both the optimizer's
    // internal fetch and the browser's public fetch. Skipping optimization
    // means the browser fetches these URLs directly instead, which already
    // works correctly.
    unoptimized: true,
  },
};

export default nextConfig;
