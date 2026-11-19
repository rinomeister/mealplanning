"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createMealFromSlotAction } from "@/app/(app)/today/actions";
import { formatHuman } from "@/lib/dates";
import type { SlotKey } from "@/lib/schemas";

/**
 * Name and save everything logged in a day+slot as a reusable meal. Used from
 * the section's ⋮ menu, the "Save as meal" link under a section, and the meal
 * picker.
 */
export function SaveSlotMealForm({
  date,
  slot,
  slotLabel,
  onDone,
  onSaved,
}: {
  date: string;
  slot: SlotKey;
  slotLabel: string;
  onDone: () => void;
  onSaved?: (id: string) => void;
}) {
  const [name, setName] = useState(`${slotLabel} · ${formatHuman(date)}`);
  const [message, setMessage] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setMessage("Give the meal a name.");
      return;
    }
    setMessage("");
    startTransition(async () => {
      const res = await createMealFromSlotAction({ date, slot, name: trimmed });
      if (res.ok) {
        setSavedId(res.id);
        onSaved?.(res.id);
      } else setMessage(res.error);
    });
  }

  if (savedId) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <Check className="size-4 shrink-0" /> Saved “{name.trim()}” as a meal.
        </p>
        <div className="flex gap-2">
          <Link
            href={`/meals/${savedId}`}
            className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
          >
            View meal
          </Link>
          <Button type="button" className="flex-1" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`save-meal-name-${slot}`}>Meal name</Label>
        <Input
          id={`save-meal-name-${slot}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          {`Saves what's logged in ${slotLabel} with its current totals, so next time it's one tap.`}
        </p>
      </div>
      {message && <p className="text-sm text-destructive">{message}</p>}
      <Button type="button" disabled={isPending} onClick={save}>
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Save as meal
      </Button>
    </div>
  );
}

