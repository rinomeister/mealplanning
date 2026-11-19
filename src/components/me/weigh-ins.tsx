"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import { useToast } from "@/components/toast";
import { deleteBodyweightAction } from "@/app/(app)/me/actions";

export type WeighInRow = { id: string; date: string; kg: number };

/** Recent weigh-ins, newest first. Remove waits for the Undo toast to run out. */
export function WeighIns({ rows, units }: { rows: WeighInRow[]; units: UnitSystem }) {
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const visible = rows.filter((r) => !hidden.has(r.id));
  const shown = all ? visible : visible.slice(0, 5);

  function remove(r: WeighInRow) {
    setHidden((h) => new Set([...h, r.id]));
    toast.undoable({
      message: `Removed ${kgToDisplay(r.kg, units)} ${weightLabel(units)} on ${format(parseISO(r.date), "EEE d MMM")}`,
      commit: () => void deleteBodyweightAction(r.id).then(() => router.refresh()),
      undo: () => setHidden((h) => new Set([...h].filter((x) => x !== r.id))),
    });
  }

  if (visible.length === 0) return null;
  return (
    <section aria-labelledby="weighins-heading">
      <h2 id="weighins-heading" className="t-cap mb-2">
        Weigh-ins
      </h2>
      <ul className="card divide-y divide-line px-4">
        {shown.map((r) => (
          <li key={r.id} className="flex min-h-14 items-center gap-3">
            <span className="flex-1 text-ink-2">{format(parseISO(r.date), r.date.slice(0, 4) === new Date().getFullYear().toString() ? "EEE d MMM" : "EEE d MMM yyyy")}</span>
            <span className="num font-semibold">
              {kgToDisplay(r.kg, units).toFixed(1)} <span className="text-sm font-normal text-ink-3">{weightLabel(units)}</span>
            </span>
            <button
              type="button"
              onClick={() => remove(r)}
              aria-label={`Remove weigh-in on ${format(parseISO(r.date), "EEEE d MMMM")}`}
              className="-mr-2 grid size-11 place-items-center text-ink-3"
            >
              <Trash2 className="size-[18px]" />
            </button>
          </li>
        ))}
      </ul>
      {visible.length > 5 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-1 h-11 text-sm font-semibold text-ink-2">
          {all ? "Show fewer" : `Show all ${visible.length}`}
        </button>
      )}
    </section>
  );
}
