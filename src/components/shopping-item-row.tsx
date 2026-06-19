"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toggleShoppingCheckAction } from "@/app/(app)/shopping/actions";

export function ShoppingItemRow({
  itemKey,
  name,
  amount,
  initialChecked,
}: {
  itemKey: string;
  name: string;
  amount: string;
  initialChecked: boolean;
}) {
  const [checked, setChecked] = useState(initialChecked);
  const [, startTransition] = useTransition();

  function toggle(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      await toggleShoppingCheckAction(itemKey, next);
    });
  }

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors",
        checked && "bg-muted/50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => toggle(e.target.checked)}
        className="size-5 accent-[var(--primary)]"
      />
      <span
        className={cn(
          "flex-1 text-sm",
          checked && "text-muted-foreground line-through",
        )}
      >
        {name}
      </span>
      {amount && (
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            checked ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {amount}
        </span>
      )}
    </label>
  );
}
