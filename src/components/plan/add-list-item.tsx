"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { guessAisle } from "@/lib/aisles";
import type { AisleDef } from "@/lib/shopping-list";
import { Button } from "@/components/ui/button";
import { FlowScreen } from "@/components/add/flow-screen";
import { useToast } from "@/components/toast";
import { addExtraAction } from "@/app/(app)/plan/list/actions";

const field =
  "h-[52px] w-full min-w-0 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] font-medium outline-none focus:border-2 focus:border-ink";

/** Plan → List → +: something that isn't in any plan (dish soap). */
export function AddListItem({ aisles, productNames }: { aisles: AisleDef[]; productNames: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [aisle, setAisle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const term = name.trim().toLowerCase();
  const suggestions =
    term.length >= 2 ? productNames.filter((n) => n.toLowerCase().includes(term) && n.toLowerCase() !== term).slice(0, 3) : [];
  const guessed = term ? guessAisle(term) : "other";
  const shownAisle = aisle ?? (aisles.some((a) => a.key === guessed) ? guessed : "other");

  async function add() {
    if (!name.trim()) {
      setError("Type what you need.");
      return;
    }
    setBusy(true);
    const res = await addExtraAction({ name, amount, aisle: shownAisle });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.show({ message: `Added ${name.trim()} to the list` });
    router.push("/plan/list");
  }

  return (
    <FlowScreen
      top={
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3">
          <button type="button" onClick={() => router.back()} className="-ml-1 h-11 px-1 font-semibold">
            Cancel
          </button>
          <h1 className="text-center font-semibold">Add to list</h1>
          <span className="w-14" />
        </div>
      }
      bottom={
        <Button type="button" size="lg" className="w-full" disabled={busy} onPointerDown={(e) => e.preventDefault()} onClick={() => void add()}>
          {busy && <Loader2 className="animate-spin" />}
          {name.trim() ? `Add “${name.trim()}”` : "Add"}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4 pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Item</span>
          <input autoFocus autoComplete="off" enterKeyHint="next" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dish soap" className={field} />
        </label>
        {suggestions.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" className="chip sm" onPointerDown={(e) => e.preventDefault()} onClick={() => setName(s)}>
                {s} · product
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Amount (optional)</span>
            <input autoComplete="off" enterKeyHint="done" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 2 or 500 g" className={field} />
          </label>
          <label className="relative flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Aisle</span>
            <select value={shownAisle} onChange={(e) => setAisle(e.target.value)} className={`${field} appearance-none pr-9`}>
              {aisles.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute bottom-4 right-3.5 size-5 text-ink-3" />
          </label>
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
      </form>
    </FlowScreen>
  );
}
