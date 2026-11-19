"use client";

import { cn } from "@/lib/utils";

/**
 * Full-screen form/flow layer. Pinned to the visual viewport (like the app
 * shell), so the bottom bar — its last flex child, never position: fixed —
 * sits right on top of the keyboard. Top bar honours the status bar and the
 * landscape notch.
 */
export function FlowScreen({
  top,
  bottom,
  children,
  dark = false,
  className,
}: {
  top?: React.ReactNode;
  bottom?: React.ReactNode;
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 flex flex-col",
        dark ? "bg-[#111214] text-white" : "bg-bg text-ink",
        className,
      )}
      style={{ top: "var(--vv-top, 0px)", height: "var(--vv-h, 100dvh)" }}
    >
      {top && (
        <div className="shrink-0 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))]">
          <div className="mx-auto max-w-2xl">{top}</div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="mx-auto max-w-2xl">{children}</div>
      </div>
      {bottom && (
        <div
          className={cn(
            "safe-bottom shrink-0 border-t pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
            dark ? "border-white/10" : "border-line bg-bg",
          )}
        >
          <div className="mx-auto max-w-2xl py-2.5">{bottom}</div>
        </div>
      )}
    </div>
  );
}
