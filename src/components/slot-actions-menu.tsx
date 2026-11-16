"use client";

import { useEffect, useState, useTransition } from "react";
import {
  BookmarkPlus,
  ChevronLeft,
  CopyPlus,
  CalendarClock,
  Loader2,
  MoreVertical,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveSlotMealForm } from "@/components/save-slot-meal";
import { copySlotFromDateAction } from "@/app/(app)/track/actions";
import { addDaysKey, formatHuman } from "@/lib/dates";
import type { SlotKey } from "@/lib/schemas";

type View = "menu" | "save" | "copy";

/**
 * The per-section `⋮` menu on the tracking page. Three shortcuts for a day+slot:
 * save what's logged there as a reusable meal, copy the previous day's same
 * section in, or copy any chosen day's same section in.
 */
export function SlotActionsMenu({
  date,
  slot,
  slotLabel,
  hasEntries,
}: {
  date: string;
  slot: SlotKey;
  slotLabel: string;
  /** Whether the section has anything counted — gates "Save as meal". */
  hasEntries: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [copyDate, setCopyDate] = useState(addDaysKey(date, -1));
  const [message, setMessage] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    // Reset after the sheet has animated away.
    setView("menu");
    setMessage("");
    setSavedId(null);
  }

  function openMenu() {
    setCopyDate(addDaysKey(date, -1));
    setMessage("");
    setSavedId(null);
    setView("menu");
    setOpen(true);
  }

  function copyFrom(fromDate: string) {
    setMessage("");
    startTransition(async () => {
      const res = await copySlotFromDateAction({ fromDate, toDate: date, slot });
      if (res.ok) close();
      else setMessage(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:bg-muted"
        aria-label={`${slotLabel} actions`}
      >
        <MoreVertical className="size-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`${slotLabel} actions`}
        >
          <div
            className="flex w-full flex-col rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)] shadow-lg sm:max-w-md sm:rounded-2xl sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border p-4">
              {view !== "menu" && !savedId && (
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setView("menu");
                  }}
                  className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  aria-label="Back"
                >
                  <ChevronLeft className="size-5" />
                </button>
              )}
              <p className="flex-1 text-sm font-semibold">{slotLabel}</p>
              <button
                type="button"
                onClick={close}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {view === "menu" && (
              <div className="flex flex-col p-2">
                <MenuItem
                  icon={<BookmarkPlus className="size-5" />}
                  label="Save as meal"
                  hint={
                    hasEntries
                      ? "Turn what's logged here into a reusable meal"
                      : "Nothing logged here yet"
                  }
                  disabled={!hasEntries}
                  onClick={() => setView("save")}
                />
                <MenuItem
                  icon={<CopyPlus className="size-5" />}
                  label={`Copy yesterday's ${slotLabel.toLowerCase()}`}
                  hint={formatHuman(addDaysKey(date, -1))}
                  disabled={isPending}
                  onClick={() => copyFrom(addDaysKey(date, -1))}
                />
                <MenuItem
                  icon={<CalendarClock className="size-5" />}
                  label="Copy from another day…"
                  hint="Pick a day to copy this section from"
                  disabled={isPending}
                  onClick={() => setView("copy")}
                />
                {message && (
                  <p className="px-3 pb-2 pt-1 text-sm text-destructive">
                    {message}
                  </p>
                )}
              </div>
            )}

            {view === "save" && (
              <div className="p-4">
                <SaveSlotMealForm
                  date={date}
                  slot={slot}
                  slotLabel={slotLabel}
                  onDone={close}
                  onSaved={setSavedId}
                />
              </div>
            )}

            {view === "copy" && (
              <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="copy-from-date">Copy {slotLabel} from</Label>
                  <Input
                    id="copy-from-date"
                    type="date"
                    value={copyDate}
                    max={date}
                    onChange={(e) => setCopyDate(e.target.value)}
                  />
                </div>
                {message && <p className="text-sm text-destructive">{message}</p>}
                <Button
                  type="button"
                  disabled={isPending || !copyDate}
                  onClick={() => copyFrom(copyDate)}
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Copy into {formatHuman(date)}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
    </button>
  );
}
