"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export const KEYBOARD_BAR_SLOT = "kbd-bar-slot";

const noop = () => () => {};

/**
 * A bottom bar that rides on top of the on-screen keyboard. It renders into a
 * slot that is the last child of the app shell's column (the tab bar hides
 * while a field has focus), so it is never `position: fixed`.
 */
export function KeyboardBar({ children }: { children: React.ReactNode }) {
  const slot = useSyncExternalStore(
    noop,
    () => document.getElementById(KEYBOARD_BAR_SLOT),
    () => null,
  );
  if (!slot) return null;
  return createPortal(
    <div className="flex gap-2 border-t border-line bg-bg px-4 py-2.5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      {children}
    </div>,
    slot,
  );
}
