"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Share } from "lucide-react";
import { createMealShareAction, revokeMealShareAction } from "@/app/(app)/import/actions";
import { Sheet } from "@/components/ui/sheet";
import { formatShareCode } from "@/lib/share";

/**
 * Share a meal with someone else on the app. Opening the sheet makes (or
 * reuses) the meal's code; the recipient opens the link or types the code on
 * Import, previews the meal and imports their own copy.
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
    if (!confirm("Stop sharing? The code will stop working. Copies people already imported stay theirs.")) return;
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
      <button type="button" onClick={openSheet} aria-label="Share meal" className="grid size-11 place-items-center rounded-full">
        <Share className="size-5" />
      </button>

      {open && (
        <Sheet label="Share meal" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div>
              <h2 className="t-h2">Share “{mealName}”</h2>
              <p className="mt-1 text-sm text-ink-2">
                They get a copy with ingredients, steps and tags. Your later edits don&apos;t change their copy.
              </p>
            </div>
            {code ? (
              <ShareDetails code={code} mealName={mealName} imports={imports} busy={isPending} onStop={stopSharing} />
            ) : (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-3">
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Creating a code…
                  </>
                ) : (
                  "No code yet."
                )}
              </div>
            )}
            {message && <p className="text-sm text-bad">{message}</p>}
          </div>
        </Sheet>
      )}
    </>
  );
}

/** Code, copy and share buttons. Only rendered after a tap, so window/navigator exist. */
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
  const link = `${window.location.origin}/import/${code}`;
  const pretty = formatShareCode(code);

  async function copy(what: "code" | "link") {
    try {
      await navigator.clipboard.writeText(what === "code" ? pretty : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Couldn't copy. Select the text and copy it by hand.");
    }
  }

  async function shareLink() {
    if (!("share" in navigator)) {
      void copy("link");
      return;
    }
    try {
      await navigator.share({ title: mealName, text: `Import my recipe for ${mealName} with code ${pretty}:`, url: link });
    } catch {
      // Dismissed the share sheet.
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1 rounded-card bg-surface-2 py-5">
        <span className="text-xs text-ink-3">Share code</span>
        <span className="num select-all text-[34px] font-semibold tracking-[0.12em]">{pretty.replace("-", "·")}</span>
        <span className="text-xs text-ink-3">
          {imports === 0 ? "Not imported yet" : `Imported ${imports} time${imports === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => copy("code")} className="press flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-surface-2 font-semibold">
          {copied === "code" ? <Check className="size-5" /> : <Copy className="size-5" />}
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
        <button type="button" onClick={shareLink} className="press flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-ink font-semibold text-inv">
          {copied === "link" ? <Check className="size-5" /> : <Share className="size-5" />}
          {copied === "link" ? "Link copied" : "Share link"}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-3">“Share link” opens your phone&apos;s share sheet, or copies the link.</p>
        <button type="button" onClick={onStop} disabled={busy} className="h-11 shrink-0 text-sm font-semibold text-bad">
          Stop sharing
        </button>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
    </>
  );
}
