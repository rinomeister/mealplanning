"use client";

import { useRef } from "react";

/**
 * Long-press handlers for an element. `wasLongPress()` tells a click handler
 * to ignore the click that ends a long press. Moving the finger (scrolling)
 * cancels it.
 */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function cancel() {
    clearTimeout(timer.current);
    start.current = null;
  }

  return {
    handlers: {
      onPointerDown(e: React.PointerEvent) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          fired.current = true;
          navigator.vibrate?.(10);
          onLongPress();
        }, ms);
      },
      onPointerMove(e: React.PointerEvent) {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu(e: React.MouseEvent) {
        // Desktop right-click opens the same menu.
        e.preventDefault();
        if (!fired.current) {
          fired.current = true;
          onLongPress();
        }
      },
    },
    wasLongPress() {
      const f = fired.current;
      fired.current = false;
      return f;
    },
  };
}
