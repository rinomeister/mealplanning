"use client";

import { useEffect, useState, useTransition } from "react";
import { Home, Loader2, MoreVertical, ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AISLES, AISLE_LABELS, type Aisle } from "@/lib/aisles";
import { Modal } from "@/components/ui/modal";
import {
  setAtHomeAction,
  setItemAisleAction,
  toggleShoppingCheckAction,
} from "@/app/(app)/plan/list/actions";

/**
 * One line of the shopping list: tick it off as you shop, or open its menu to
 * say you already have it at home or to file it under another aisle.
 */
export function ShoppingItemRow({
  itemKey,
  name,
  amount,
  aisle,
  initialChecked,
}: {
  itemKey: string;
  name: string;
  amount: string;
  aisle: Aisle;
  initialChecked: boolean;
}) {
  const [checked, setChecked] = useState(initialChecked);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startTransition] = useTransition();

  function toggle(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      await toggleShoppingCheckAction(itemKey, next);
    });
  }

  return (
    <div
      className={cn(
        "flex items-center rounded-lg border border-border transition-colors",
        checked && "bg-muted/50",
      )}
    >
      <label className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => toggle(e.target.checked)}
          className="size-5 shrink-0 accent-[var(--primary)]"
        />
        <span
          className={cn(
            "min-w-0 flex-1 text-sm",
            checked && "text-muted-foreground line-through",
          )}
        >
          {name}
        </span>
        {amount && (
          <span
            className={cn(
              "shrink-0 text-sm font-medium tabular-nums",
              checked ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {amount}
          </span>
        )}
      </label>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
        aria-label={`More for ${name}`}
      >
        <MoreVertical className="size-4" />
      </button>
      {menuOpen && (
        <ItemSheet
          itemKey={itemKey}
          name={name}
          amount={amount}
          aisle={aisle}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

/** An item already at home: muted, with a one-tap way back onto the list. */
export function AtHomeItemRow({
  itemKey,
  name,
  amount,
}: {
  itemKey: string;
  name: string;
  amount: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-lg border border-dashed border-border py-1.5 pl-3 pr-1.5">
      <Home className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 text-sm text-muted-foreground">{name}</span>
      {amount && (
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {amount}
        </span>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await setAtHomeAction(itemKey, false);
          })
        }
        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-primary active:bg-muted disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ShoppingCart className="size-3.5" />
        )}
        Need it
      </button>
    </div>
  );
}

function ItemSheet({
  itemKey,
  name,
  amount,
  aisle,
  onClose,
}: {
  itemKey: string;
  name: string;
  amount: string;
  aisle: Aisle;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingAisle, setPendingAisle] = useState<Aisle | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function markHome() {
    startTransition(async () => {
      await setAtHomeAction(itemKey, true);
      onClose();
    });
  }

  function moveTo(next: Aisle) {
    if (next === aisle) {
      onClose();
      return;
    }
    setPendingAisle(next);
    startTransition(async () => {
      await setItemAisleAction(name, next);
      onClose();
    });
  }

  return (
    <Modal onClose={onClose} label={name}>
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            {amount && (
              <p className="text-xs tabular-nums text-muted-foreground">{amount}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <button
            type="button"
            disabled={isPending}
            onClick={markHome}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-left active:bg-muted disabled:opacity-60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
              {isPending && !pendingAisle ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Home className="size-5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">I have this at home</span>
              <span className="block text-xs text-muted-foreground">
                Moves it off the list until you say you need it again
              </span>
            </span>
          </button>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Aisle</p>
            <div className="flex flex-wrap gap-2">
              {AISLES.map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={isPending}
                  onClick={() => moveTo(a)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-60",
                    a === aisle
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground active:bg-muted",
                  )}
                >
                  {pendingAisle === a && <Loader2 className="size-3.5 animate-spin" />}
                  {AISLE_LABELS[a]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
  );
}
