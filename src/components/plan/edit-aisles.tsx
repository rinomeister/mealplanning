"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Equal, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AisleDef } from "@/lib/shopping-list";
import { FlowScreen } from "@/components/add/flow-screen";
import { useToast } from "@/components/toast";
import { setAisleOrderAction } from "@/app/(app)/plan/list/actions";

/**
 * Plan → List → ⋯ → Edit aisles. The order is your store's route: drag to
 * reorder, tap to rename or delete, add your own. Other is always last.
 */
export function EditAisles({ aisles: initial, counts }: { aisles: AisleDef[]; counts: Record<string, number> }) {
  const router = useRouter();
  const toast = useToast();
  const [aisles, setAisles] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  async function done() {
    setBusy(true);
    await setAisleOrderAction(aisles);
    setBusy(false);
    toast.show({ message: "Aisles saved" });
    router.push("/plan/list");
  }

  function onMove(e: React.PointerEvent) {
    if (!dragging || !listRef.current) return;
    const rows = Array.from(listRef.current.querySelectorAll<HTMLElement>("[data-aisle]"));
    let to = rows.length - 1;
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        to = j;
        break;
      }
    }
    setAisles((list) => {
      const from = list.findIndex((a) => a.key === dragging);
      if (from < 0 || from === to) return list;
      const next = [...list];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }

  function addAisle() {
    const key = `c${Date.now().toString(36)}`;
    setAisles((list) => [...list, { key, label: "" }]);
    setEditing(key);
  }

  return (
    <FlowScreen
      top={
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3">
          <button type="button" onClick={() => router.back()} className="-ml-1 h-11 px-1 font-semibold">
            Cancel
          </button>
          <h1 className="text-center font-semibold">Aisles</h1>
          <button type="button" onClick={() => void done()} disabled={busy} className="-mr-1 h-11 px-1 font-semibold">
            {busy ? <Loader2 className="size-5 animate-spin" /> : "Done"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-8">
        <ul ref={listRef} className="card divide-y divide-line overflow-hidden">
          {aisles.map((a) => (
            <li
              key={a.key}
              data-aisle
              className={cn("flex min-h-14 items-center gap-2 pl-4 pr-1", dragging === a.key && "bg-surface-2 shadow-lg")}
            >
              {editing === a.key ? (
                <>
                  <input
                    autoFocus
                    value={a.label}
                    placeholder="Aisle name"
                    aria-label="Aisle name"
                    enterKeyHint="done"
                    onChange={(e) => setAisles((list) => list.map((x) => (x.key === a.key ? { ...x, label: e.target.value } : x)))}
                    onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                    className="h-11 min-w-0 flex-1 rounded-[12px] border-2 border-ink bg-surface px-3 text-base outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`Delete ${a.label || "aisle"}`}
                    className="grid size-11 place-items-center text-bad"
                    onClick={() => {
                      setAisles((list) => list.filter((x) => x.key !== a.key));
                      setEditing(null);
                    }}
                  >
                    <Trash2 className="size-5" />
                  </button>
                  <button type="button" aria-label="Done renaming" className="grid size-11 place-items-center" onClick={() => setEditing(null)}>
                    <Check className="size-5" />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setEditing(a.key)} className="min-w-0 flex-1 py-3 text-left">
                    <span className="block truncate">{a.label || "Untitled aisle"}</span>
                  </button>
                  <span className="text-xs text-ink-3">{dragging === a.key ? "dragging" : counts[a.key] ? `${counts[a.key]} on list` : ""}</span>
                  <button
                    type="button"
                    aria-label={`Drag to reorder ${a.label}`}
                    className="grid size-11 touch-none place-items-center text-ink-2"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDragging(a.key);
                    }}
                    onPointerMove={onMove}
                    onPointerUp={() => setDragging(null)}
                    onPointerCancel={() => setDragging(null)}
                  >
                    <Equal className="size-5" />
                  </button>
                </>
              )}
            </li>
          ))}
          <li className="flex min-h-14 items-center justify-between px-4 text-ink-3">
            <span>Other (unsorted)</span>
            <span className="text-xs">always last</span>
          </li>
        </ul>
        <button type="button" onClick={addAisle} className="press flex h-12 items-center justify-center gap-2 rounded-[14px] bg-surface-2 font-semibold">
          <Plus className="size-4" /> Add aisle
        </button>
        <p className="text-[13px] text-ink-3">
          Tap an aisle to rename or delete it. To move an item to another aisle, long-press it in the list.
        </p>
      </div>
    </FlowScreen>
  );
}
