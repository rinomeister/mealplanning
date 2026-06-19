"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred || hidden) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg md:bottom-4">
      <Download className="size-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Install MealPlan</p>
        <p className="text-xs text-muted-foreground">Add it to your home screen.</p>
      </div>
      <button
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
      >
        Install
      </button>
      <button
        onClick={() => setHidden(true)}
        aria-label="Dismiss"
        className="rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
