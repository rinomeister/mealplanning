"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  DARK_BG,
  LIGHT_BG,
  THEME_KEY as KEY,
  type ThemePref,
} from "@/lib/theme";

function readPref(): ThemePref {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyPref(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);

  // The browser chrome / status bar colour follows the resolved theme.
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute("media");
    if (pref === "system" && media) {
      m.setAttribute("content", media.includes("dark") ? DARK_BG : LIGHT_BG);
    } else {
      m.setAttribute("content", dark ? DARK_BG : LIGHT_BG);
    }
  });
}

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const CHANGE = "themechange";
function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Per-device theme switch (System / Light / Dark). */
export function ThemeSetting() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as const);

  function choose(next: ThemePref) {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Private mode etc.: still applies for this visit.
    }
    applyPref(next);
    window.dispatchEvent(new Event(CHANGE));
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="seg">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          className={cn(pref === o.value && "on")}
          onClick={() => choose(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
