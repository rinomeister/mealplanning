"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** ‹ that goes back, or to `fallback` when the page was opened directly. */
export function BackButton({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full"
    >
      <ChevronLeft className="size-6" />
    </button>
  );
}
