"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const noop = () => () => {};

/**
 * A history.back() scheduled by a sheet that just closed. If another sheet
 * opens in the same tick (one menu replacing another, or React remounting in
 * dev), it takes over that history entry instead.
 */
let pendingBack: ReturnType<typeof setTimeout> | null = null;

/**
 * Android back / iOS swipe-back closes the sheet instead of leaving the page:
 * opening pushes a history entry, popping it closes. Closing from the UI pops
 * that entry again.
 */
function useBackToClose(onClose: () => void) {
  const pushed = useRef(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (pendingBack) {
      clearTimeout(pendingBack);
      pendingBack = null;
    } else {
      window.history.pushState({ ...window.history.state, __sheet: true }, "");
    }
    pushed.current = true;
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed from the UI: drop the entry we pushed — unless something in the
      // sheet navigated away, in which case going back would undo that.
      if (pushed.current) {
        pushed.current = false;
        pendingBack = setTimeout(() => {
          pendingBack = null;
          if (window.history.state?.__sheet) window.history.back();
        }, 0);
      }
    };
  }, []);
}

/**
 * Bottom sheet for picking only — buttons and chips, never text input. Drag
 * handle, scrim closes it, Escape closes it, focus is trapped while open and
 * returns to whatever opened it. Opens in 260 ms, closes in 200 ms.
 *
 * Render it conditionally (`{open && <Sheet …/>}`); call `onClose` to dismiss.
 */
export function Sheet({
  label,
  onClose,
  children,
  className,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  const body = useSyncExternalStore(noop, () => document.body, () => null);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  useBackToClose(onClose);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true });
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!body) return null;

  return createPortal(
    <div className="fixed inset-x-0 z-50" style={{ top: "var(--vv-top, 0px)", height: "var(--vv-h, 100dvh)" }}>
      <div
        className={cn("absolute inset-0 bg-scrim", closing ? "fade-out" : "fade-in")}
        onClick={close}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "safe-bottom absolute inset-x-0 bottom-0 mx-auto flex max-h-[88%] max-w-xl flex-col rounded-t-sheet bg-surface text-ink shadow-[0_-10px_40px_rgba(0,0,0,.2)] outline-none desk:bottom-4 desk:rounded-sheet",
          closing ? "sheet-out" : drag === 0 && "sheet-in",
          className,
        )}
        style={drag > 0 ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <div
          className="flex h-6 shrink-0 cursor-grab touch-none items-start justify-center"
          onPointerDown={(e) => {
            dragStart.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragStart.current != null) setDrag(Math.max(0, e.clientY - dragStart.current));
          }}
          onPointerUp={() => {
            const d = drag;
            dragStart.current = null;
            if (d > 80) close();
            else setDrag(0);
          }}
          aria-hidden
        >
          <span className="mt-2 h-[5px] w-10 rounded-full bg-line" />
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    body,
  );
}

/** A row in a sheet menu: icon, label, optional hint/value on the right. */
export function SheetItem({
  icon,
  label,
  hint,
  value,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[52px] w-full items-center gap-3.5 px-5 py-2 text-left transition-colors active:bg-surface-2 disabled:opacity-40 [&_svg]:size-5 [&_svg]:shrink-0",
        danger ? "text-bad" : "text-ink",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{label}</span>
        {hint && <span className="block truncate text-[13px] text-ink-3">{hint}</span>}
      </span>
      {value && <span className="shrink-0 text-sm text-ink-3">{value}</span>}
    </button>
  );
}
