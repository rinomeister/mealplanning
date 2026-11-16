"use client";

import { useSyncExternalStore } from "react";

/**
 * Which barcode engine the camera uses. Stored per device (localStorage), not
 * per account: whether a scanner works depends on the phone, not the person.
 *
 * - "zxing": the original @zxing/browser decoder (works well on iPhone).
 * - "native": the browser's BarcodeDetector (ML Kit on Android Chrome), with a
 *   WebAssembly fallback where the browser doesn't provide one.
 */
export type ScannerEngine = "zxing" | "native";

export const SCANNER_ENGINES: { value: ScannerEngine; label: string; hint: string }[] = [
  {
    value: "zxing",
    label: "Classic",
    hint: "The original scanner. Works well on iPhone.",
  },
  {
    value: "native",
    label: "Enhanced",
    hint: "Uses the phone's built-in barcode reader with high-res video. Try this on Android.",
  },
];

const KEY = "scanner-engine";
const EVENT = "scanner-engine-change";

function read(): ScannerEngine {
  try {
    return localStorage.getItem(KEY) === "native" ? "native" : "zxing";
  } catch {
    return "zxing";
  }
}

export function setScannerEngine(engine: ScannerEngine) {
  try {
    localStorage.setItem(KEY, engine);
  } catch {
    // Storage blocked (private mode) — the choice just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useScannerEngine(): ScannerEngine {
  return useSyncExternalStore(subscribe, read, () => "zxing");
}
