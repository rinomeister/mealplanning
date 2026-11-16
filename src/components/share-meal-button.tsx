"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMealShareAction, revokeMealShareAction } from "@/app/(app)/share/actions";
import { Modal } from "@/components/ui/modal";
import { formatShareCode } from "@/lib/share";

/**
 * Share a meal with someone else on the app. Opening the sheet makes (or
 * reuses) the meal's code; the recipient opens the link or types the code on
 * Food → Import, previews the meal and imports their own copy.
 */
export function ShareMealButton({
  mealId,
  mealName,
  initialCode,
  imports,
}: {
  mealId: string;
  mealName: string;
  initialCode: string | null;
  imports: number;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function openSheet() {
    setOpen(true);
    setMessage("");
    if (code) return;
    startTransition(async () => {
      const res = await createMealShareAction(mealId);
      if (res.ok) setCode(res.code);
      else setMessage(res.error);
    });
  }

  function stopSharing() {
    if (
      !confirm(
        "Stop sharing? The code will stop working. Copies people already imported stay theirs.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await revokeMealShareAction(mealId);
      if (res.ok) {
        setCode(null);
        setOpen(false);
      } else setMessage(res.error);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={openSheet}>
        <Share2 /> Share
      </Button>

      {open && (
        <Modal onClose={() => setOpen(false)} label={"Share meal"}>
            <div className="flex items-center gap-2 border-b border-border p-4">
              <p className="flex-1 truncate text-sm font-semibold">Share “{mealName}”</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-4">
              {code ? (
                <ShareDetails
                  code={code}
                  mealName={mealName}
                  imports={imports}
                  busy={isPending}
                  onStop={stopSharing}
                />
              ) : (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Creating a code…
                    </>
                  ) : (
                    "No code yet."
                  )}
                </div>
              )}
              {message && <p className="text-sm text-destructive">{message}</p>}
            </div>
          </Modal>
      )}
    </>
  );
}

/**
 * The code, the link and the send buttons. Only ever rendered after a tap
 * opened the sheet, so `window` and `navigator` are always available here and
 * the server never renders it.
 */
function ShareDetails({
  code,
  mealName,
  imports,
  busy,
  onStop,
}: {
  code: string;
  mealName: string;
  imports: number;
  busy: boolean;
  onStop: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [error, setError] = useState("");
  const link = `${window.location.origin}/share/${code}`;
  const canNativeShare = "share" in navigator;

  async function copy(what: "code" | "link") {
    try {
      await navigator.clipboard.writeText(what === "code" ? formatShareCode(code) : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Couldn't copy — select the text and copy it by hand.");
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({
        title: mealName,
        text: `Here's my recipe for ${mealName} — import it with code ${formatShareCode(code)}:`,
        url: link,
      });
    } catch {
      // Dismissed the share sheet — nothing to do.
    }
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Send the link or the code. They&apos;ll see a preview and can import their own copy —
        your changes after that won&apos;t affect theirs.
      </p>

      <button
        type="button"
        onClick={() => copy("code")}
        className="flex flex-col items-center gap-1 rounded-xl border border-border py-4 active:bg-muted"
        aria-label="Copy code"
      >
        <span className="font-mono text-3xl font-bold tracking-[0.2em]">
          {formatShareCode(code)}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {copied === "code" ? (
            <>
              <Check className="size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Tap to copy code
            </>
          )}
        </span>
      </button>

      <div className="flex gap-2">
        {canNativeShare && (
          <Button type="button" className="flex-1" onClick={nativeShare}>
            <Share2 /> Send…
          </Button>
        )}
        <Button
          type="button"
          variant={canNativeShare ? "outline" : "default"}
          className="flex-1"
          onClick={() => copy("link")}
        >
          {copied === "link" ? <Check /> : <Copy />}
          {copied === "link" ? "Link copied" : "Copy link"}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          {imports === 0 ? "Not imported yet" : `Imported ${imports} time${imports === 1 ? "" : "s"}`}
        </p>
        <button
          type="button"
          onClick={onStop}
          disabled={busy}
          className="text-xs font-medium text-destructive hover:underline"
        >
          Stop sharing
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}
