import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // @serwist/next injects a webpack config; declaring an (empty) turbopack config
  // tells Next 16 the webpack config is intentional so `next dev` (Turbopack) runs.
  // The production build uses `next build --webpack` so Serwist's plugin is active.
  turbopack: {},
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Service worker is noisy/unhelpful in dev; enable only for production builds.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
