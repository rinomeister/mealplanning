import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Next.js 16 renamed the "middleware" convention to "proxy".
export default auth;

export const config = {
  // Run on all routes except API, Next internals, and static/PWA assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
