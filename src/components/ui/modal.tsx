"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared dialog shell. On phones it's anchored to the TOP of the screen (not a
 * bottom sheet) so the on-screen keyboard never covers inputs, and its height
 * is capped by the dynamic viewport so it shrinks when the keyboard opens
 * (with `interactiveWidget: "resizes-content"` in the root viewport). Centered
 * on larger screens. Closes on backdrop tap and Escape, and locks page scroll.
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-scrim px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={cn(
          "flex max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top))] w-full flex-col overflow-y-auto rounded-sheet bg-surface text-left shadow-[0_10px_40px_rgba(0,0,0,.2)] sm:max-h-[90dvh] sm:max-w-md",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
