"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "number",
  "tel",
  "url",
  "password",
  "date",
]);

function isTextField(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Keeps the app shell sized to the visual viewport, so bottom bars ride on top
 * of the on-screen keyboard (iOS doesn't resize the layout viewport for it).
 *
 * - `--vv-h` / `--vv-top` on <html>: the visual viewport's height and offset.
 * - `data-kbd` on <html> while a text field has focus on a touch device: the
 *   tab bar hides and bottom bars drop their home-indicator padding.
 * - The focused field is scrolled to the centre once the keyboard is up.
 */
export function ViewportSync() {
  const pathname = usePathname();

  // A page change removes whatever field had focus: re-check the keyboard flag.
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.activeElement;
      if (!isTextField(el) || !el.isConnected) document.documentElement.removeAttribute("data-kbd");
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    // The server picks "today" and the current slot from the phone's clock.
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && !document.cookie.includes(`tz=${encodeURIComponent(tz)}`)) {
        document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      }
    } catch {
      // No Intl time zone: the server's clock is used.
    }
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const h = vv ? vv.height : window.innerHeight;
        const top = vv ? vv.offsetTop : 0;
        root.style.setProperty("--vv-h", `${Math.round(h)}px`);
        root.style.setProperty("--vv-top", `${Math.round(top)}px`);
      });
    };
    sync();

    // The tab bar hides while data-kbd is set, so it must never outlive the
    // focused field. "focusout" alone is not enough: when a focused input is
    // removed (a sheet closing on save), iOS and some Android builds fire no
    // event, which left the tab bar hidden for good. So the flag is re-derived
    // from document.activeElement on every chance we get.
    const checkKbd = () => {
      if (coarse && isTextField(document.activeElement) && document.activeElement.isConnected) {
        root.setAttribute("data-kbd", "");
      } else {
        root.removeAttribute("data-kbd");
      }
    };
    let checkTimer: ReturnType<typeof setTimeout> | undefined;
    // Focus may be moving straight to the next field; check after it lands.
    const checkSoon = () => {
      clearTimeout(checkTimer);
      checkTimer = setTimeout(checkKbd, 0);
    };
    const onViewport = () => {
      sync();
      // The keyboard closing resizes the viewport, even when no blur fired.
      checkSoon();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") checkSoon();
    };

    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const onFocusIn = (e: FocusEvent) => {
      if (!coarse || !isTextField(e.target as Element)) return;
      root.setAttribute("data-kbd", "");
      clearTimeout(scrollTimer);
      // ≈250 ms lets the iOS keyboard finish animating first.
      scrollTimer = setTimeout(() => {
        const el = document.activeElement;
        if (isTextField(el)) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 250);
    };

    vv?.addEventListener("resize", onViewport);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", onViewport);
    window.addEventListener("pageshow", checkSoon);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", checkSoon);
    // Any tap re-checks, so a stuck flag clears on the next touch.
    document.addEventListener("pointerdown", checkSoon, true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(scrollTimer);
      clearTimeout(checkTimer);
      vv?.removeEventListener("resize", onViewport);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("pageshow", checkSoon);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", checkSoon);
      document.removeEventListener("pointerdown", checkSoon, true);
      document.removeEventListener("visibilitychange", onVisible);
      root.removeAttribute("data-kbd");
    };
  }, []);

  return null;
}
