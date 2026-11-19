"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const DURATION = 4000;

type ToastAction = { label: string; onClick: () => void };

export type ToastInput = {
  message: string;
  tone?: "default" | "error";
  action?: ToastAction;
};

type Shown = ToastInput & { id: number };

type ToastApi = {
  /** Show a toast (one at a time; a new one replaces the old). */
  show: (t: ToastInput) => void;
  /**
   * Optimistic change with Undo. `commit` runs when the toast times out (or is
   * replaced, or the app goes to the background); `undo` runs instead if the
   * user taps Undo.
   */
  undoable: (t: { message: string; commit: () => void; undo: () => void }) => void;
  /** Announce a change to screen readers without showing a toast. */
  announce: (text: string) => void;
};

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useToast outside ToastProvider");
  return api;
}

/**
 * Toasts sit above the tab bar, stay 4 s, one at a time, with an optional Undo
 * or Retry. Also hosts the polite live region for totals that change.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Shown | null>(null);
  const [live, setLive] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingCommit = useRef<(() => void) | null>(null);
  const seq = useRef(0);

  const flush = useCallback(() => {
    const c = pendingCommit.current;
    pendingCommit.current = null;
    c?.();
  }, []);

  const present = useCallback(
    (t: ToastInput) => {
      clearTimeout(timer.current);
      const id = ++seq.current;
      setToast({ ...t, id });
      timer.current = setTimeout(() => {
        flush();
        setToast((cur) => (cur?.id === id ? null : cur));
      }, DURATION);
    },
    [flush],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show(t) {
        flush();
        present(t);
      },
      undoable({ message, commit, undo }) {
        flush();
        pendingCommit.current = commit;
        present({
          message,
          action: {
            label: "Undo",
            onClick: () => {
              pendingCommit.current = null;
              undo();
            },
          },
        });
      },
      announce(text) {
        setLive(text);
      },
    }),
    [flush, present],
  );

  // Don't lose a pending delete when the app is backgrounded or closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">
        {toast?.message ?? live}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            className={cn(
              "toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-btn py-2.5 pl-4 pr-2.5 text-[15px] font-medium shadow-[0_8px_24px_rgba(0,0,0,.25)]",
              toast.tone === "error" ? "bg-bad text-white" : "bg-ink text-inv",
            )}
          >
            {toast.tone === "error" ? (
              <AlertCircle className="size-5 shrink-0" />
            ) : (
              <Check className="size-5 shrink-0" />
            )}
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="relative h-10 shrink-0 rounded-xl px-3 font-semibold after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-['']"
                onClick={() => {
                  clearTimeout(timer.current);
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
