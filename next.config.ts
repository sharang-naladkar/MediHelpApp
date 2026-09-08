import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Isolated .next dirs keep e2e servers from colliding with the preview dev
  // server (Next locks the project dir per dev process, not per port).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        // Never let the service worker itself be served from a long-lived cache:
        // clients must always revalidate it so updates propagate quickly.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
