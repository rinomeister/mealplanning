"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, CopyPlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyDayAction, removeEntriesAction } from "@/app/(app)/today/actions";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/ui/modal";
import { addDaysKey, formatHuman } from "@/lib/dates";

/**
 * Copy a whole day into this one: "same as yesterday" in one tap, or any day
 * you pick. Every slot comes across; skipped entries stay behind.
 */
export function DayCopyMenu({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [pickDate, setPickDate] = useState(addDaysKey(date, -1));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const yesterday = addDaysKey(date, -1);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function copyFrom(fromDate: string, closeAfter: boolean) {
    setMessage("");
    startTransition(async () => {
      const res = await copyDayAction({ fromDate, toDate: date });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      if (closeAfter) setOpen(false);
      toast.undoable({
        message: `Copied ${res.count} item${res.count === 1 ? "" : "s"} from ${formatHuman(fromDate)}`,
        commit: () => {},
        undo: () => startTransition(async () => void (await removeEntriesAction(res.ids))),
      });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMessage("");
          setPickDate(yesterday);
          setOpen(true);
        }}
        className="grid size-11 place-items-center rounded-[14px] text-ink hover:bg-surface-2"
        aria-label="Copy a whole day into this one"
      >
        <Copy className="size-5" />
      </button>


      {open && (
        <Modal onClose={() => setOpen(false)} label={"Copy a whole day"}>
            <div className="flex items-center gap-2 border-b border-border p-4">
              <p className="flex-1 text-sm font-semibold">
                Copy a whole day into {formatHuman(date)}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-4">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => copyFrom(yesterday, true)}
              >
                <CopyPlus /> Same as yesterday ({formatHuman(yesterday)})
              </Button>
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <Label htmlFor="copy-day-date">Or copy from</Label>
                <div className="flex gap-2">
                  <Input
                    id="copy-day-date"
                    type="date"
                    value={pickDate}
                    onChange={(e) => setPickDate(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={isPending || !pickDate}
                    onClick={() => copyFrom(pickDate, true)}
                  >
                    {isPending && <Loader2 className="animate-spin" />}
                    Copy
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Everything from that day is added after what&apos;s already here.
              </p>
              {message && <p className="text-sm text-destructive">{message}</p>}
            </div>
          </Modal>
      )}
    </>
  );
}
