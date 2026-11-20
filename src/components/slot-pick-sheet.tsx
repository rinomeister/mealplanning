"use client";

import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { Sheet } from "@/components/ui/sheet";

/** "Add X to…": the user picks the slot; nothing is chosen for them. */
export function SlotPickSheet({
  title,
  onPick,
  onClose,
}: {
  title: string;
  onPick: (slot: SlotKey) => void;
  onClose: () => void;
}) {
  return (
    <Sheet label={title} onClose={onClose}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="t-h2">{title}</p>
        <div className="grid grid-cols-2 gap-2">
          {SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => {
                onClose();
                onPick(slot);
              }}
              className="press flex h-12 items-center justify-center rounded-btn bg-surface-2 font-semibold"
            >
              {SLOT_LABELS[slot]}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
