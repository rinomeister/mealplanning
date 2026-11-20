"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/**
 * Shared dialog shell. On phones it's anchored to the TOP of the screen (not a
 * bottom sheet) so the on-screen keyboard never covers inputs. Centered on
 * larger screens. Closes on backdrop tap and Escape, and locks page scroll.
 *
 * Like Sheet and FlowScreen it is pinned to the *visual* viewport (--vv-top /
 * --vv-h from ViewportSync), so with the keyboard open on iOS the dialog ends
 * at the keyboard and its own body scrolls; 100dvh doesn't shrink there and
 * left the bottom (the confirm button) unreachable behind the keyboard. It is
 * portalled to <body> so a parent scroller (e.g. FlowScreen's) can't capture
 * the touch-scroll on iOS.
 */
export function Modal({
  onClose,
  label,
  className,
  children,
}: {
  onClose: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const body = useSyncExternalStore(noop, () => document.body, () => null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!body) return null;

  return createPortal(
    <div
      className="fixed inset-x-0 z-50 flex items-start justify-center bg-scrim px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:p-4"
      style={{ top: "var(--vv-top, 0px)", height: "var(--vv-h, 100dvh)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={cn(
          "flex max-h-full w-full flex-col overflow-y-auto overscroll-contain rounded-sheet bg-surface text-left shadow-[0_10px_40px_rgba(0,0,0,.2)] sm:max-w-md",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    body,
  );
}
