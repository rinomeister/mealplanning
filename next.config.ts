import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // @serwist/next injects a webpack config; declaring an (empty) turbopack config
  // tells Next 16 the webpack config is intentional so `next dev` (Turbopack) runs.
  // The production build uses `next build --webpack` so Serwist's plugin is active.
  turbopack: {},

  // Routes from before the redesign. Share links already sent to people point
  // at /share/<code>, so these have to stay for good.
  async redirects() {
    return [
      { source: "/track", destination: "/today", permanent: true },
      { source: "/calendar", destination: "/plan", permanent: true },
      { source: "/calendar/:date", destination: "/plan/day/:date", permanent: true },
      { source: "/shopping", destination: "/plan/list", permanent: true },
      { source: "/meals", destination: "/library/meals", permanent: true },
      { source: "/products", destination: "/library/products", permanent: true },
      { source: "/library", destination: "/library/products", permanent: false },
      { source: "/profile", destination: "/me", permanent: true },
      { source: "/share", destination: "/import", permanent: true },
      { source: "/share/:code", destination: "/import/:code", permanent: true },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Service worker is noisy/unhelpful in dev; enable only for production builds.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
