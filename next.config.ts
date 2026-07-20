import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "http", hostname: "localhost", port: "3001", pathname: "/storage/**" },
    ],
    // The backend genuinely runs on localhost in dev — opt back in to fetching
    // images from it despite Next's default SSRF guard against private IPs.
    dangerouslyAllowLocalIP: true,
  },
};

export default nextConfig;
