"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

/**
 * Inside this provider a FlowScreen renders in place (a card with its own top
 * and bottom bars) instead of covering the screen — the desktop Library shows
 * the product editor in its right-hand pane this way.
 */
const InlineFlow = createContext(false);
export function InlineFlowProvider({ children }: { children: React.ReactNode }) {
  return <InlineFlow.Provider value>{children}</InlineFlow.Provider>;
}

/**
 * Full-screen form/flow layer. Pinned to the visual viewport (like the app
 * shell), so the bottom bar — its last flex child, never position: fixed —
 * sits right on top of the keyboard. Top bar honours the status bar and the
 * landscape notch. From 900 px it covers the content area only, leaving the
 * left rail in place.
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
  const inline = useContext(InlineFlow);

  if (inline) {
    return (
      <div className={cn("card flex max-h-full min-h-0 flex-col overflow-hidden", className)}>
        {top && <div className="shrink-0 px-5 pt-3">{top}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">{children}</div>
        {bottom && <div className="shrink-0 border-t border-line px-5 py-2.5">{bottom}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 flex flex-col desk:left-60",
        dark ? "bg-[#111214] text-white" : "bg-bg text-ink",
        className,
      )}
      style={{ top: "var(--vv-top, 0px)", height: "var(--vv-h, 100dvh)" }}
    >
      {top && (
        <div className="shrink-0 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))] desk:px-8 desk:pt-6">
          <div className="mx-auto max-w-2xl">{top}</div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] desk:px-8">
        <div className="mx-auto max-w-2xl">{children}</div>
      </div>
      {bottom && (
        <div
          className={cn(
            "safe-bottom shrink-0 border-t pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] desk:px-8",
            dark ? "border-white/10" : "border-line bg-bg",
          )}
        >
          <div className="mx-auto max-w-2xl py-2.5">{bottom}</div>
        </div>
      )}
    </div>
  );
}
