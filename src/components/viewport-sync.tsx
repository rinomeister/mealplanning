"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
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
    const onFocusOut = () => {
      // Focus may be moving straight to the next field; check after it lands.
      setTimeout(() => {
        if (!isTextField(document.activeElement)) root.removeAttribute("data-kbd");
      }, 0);
    };

    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(scrollTimer);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return null;
}
