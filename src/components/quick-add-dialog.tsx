"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDecimal } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { quickAddAction } from "@/app/(app)/today/actions";

const FIELDS = [
  { key: "kcal", label: "kcal" },
  { key: "protein", label: "Protein g" },
  { key: "fat", label: "Fat g" },
  { key: "carbs", label: "Carbs g" },
  { key: "sugar", label: "Sugar g" },
  { key: "fiber", label: "Fiber g" },
] as const;

type Key = (typeof FIELDS)[number]["key"];

function num(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = parseDecimal(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Log numbers straight into a slot — no product, no meal. For restaurant food,
 * someone else's cooking, or a best guess. Nothing is saved to Food.
 */
export function QuickAddDialog({
  date,
  slot,
  slotLabel,
  eaten = false,
  onClose,
}: {
  date: string;
  slot: string;
  slotLabel: string;
  /** Log as eaten (from Today) rather than planned. */
  eaten?: boolean;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [values, setValues] = useState<Partial<Record<Key, string>>>({});
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = num(values.protein) ?? 0;
  const c = num(values.carbs) ?? 0;
  const f = num(values.fat) ?? 0;
  const estimate = Math.round(p * 4 + c * 4 + f * 9);
  const kcalBlank = num(values.kcal) == null;

  function save() {
    const parsed = Object.fromEntries(FIELDS.map((x) => [x.key, num(values[x.key])])) as Record<
      Key,
      number | null
    >;
    if (Object.values(parsed).every((v) => v == null)) {
      setMessage("Enter at least the calories.");
      return;
    }
    setMessage("");
    startTransition(async () => {
      const res = await quickAddAction({ date, slot, label, ...parsed }, { eaten });
      if (res.ok) onClose();
      else setMessage(res.error);
    });
  }

  return (
    <Modal onClose={onClose} label={`Quick add to ${slotLabel}`} className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <p className="text-sm font-semibold">Quick add to {slotLabel}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-label">What was it? (optional)</Label>
            <Input
              id="quick-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Burger at the diner"
              autoComplete="off"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FIELDS.map((x) => (
              <div key={x.key} className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{x.label}</Label>
                <Input
                  inputMode="decimal"
                  placeholder={x.key === "kcal" && kcalBlank && estimate > 0 ? `≈ ${estimate}` : "0"}
                  value={values[x.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [x.key]: e.target.value }))}
                  autoFocus={x.key === "kcal"}
                />
              </div>
            ))}
          </div>
          {kcalBlank && estimate > 0 && (
            <p className="text-xs text-muted-foreground">
              Calories left blank — they&apos;ll be estimated from the macros (≈ {estimate} kcal).
            </p>
          )}

          {message && <p className="text-sm text-destructive">{message}</p>}

          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Log to {slotLabel}
          </Button>
        </form>
      </Modal>
  );
}
