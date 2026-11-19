"use client";

import { useState, useTransition } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
import { Check, ChevronDown, Loader2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyWeekAction } from "@/app/(app)/plan/actions";
import { addDaysKey, formatHuman } from "@/lib/dates";

/** Monday of the week containing `key`. */
function mondayOf(key: string): string {
  return format(startOfWeek(parseISO(key), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function weekLabel(start: string): string {
  return `${formatHuman(start)} – ${formatHuman(addDaysKey(start, 6))}`;
}

/**
 * Repeat a week's plan: last week into this one, this week into next, or any
 * week onto any other. Days line up Monday-to-Monday; copies are added after
 * whatever the target days already hold.
 */
export function WeekCopyCard({ today }: { today: string }) {
  const thisWeek = mondayOf(today);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(addDaysKey(thisWeek, -7));
  const [to, setTo] = useState(thisWeek);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function copy(fromStart: string, toStart: string) {
    if (
      !confirm(
        `Copy ${weekLabel(fromStart)} onto ${weekLabel(toStart)}?\n\nEverything is added on top of what's already planned that week.`,
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await copyWeekAction({ fromStart, toStart });
      setMessage(
        res.ok
          ? { ok: true, text: `Copied ${res.count} item${res.count === 1 ? "" : "s"} into ${weekLabel(toStart)}.` }
          : { ok: false, text: res.error },
      );
    });
  }

  return (
    <Card className="mt-5">
      <CardContent className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
          aria-expanded={open}
        >
          <Repeat className="size-4 text-primary" />
          <span className="flex-1 text-base font-semibold">Repeat a week</span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => copy(addDaysKey(thisWeek, -7), thisWeek)}
              >
                Last week → this week
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => copy(thisWeek, addDaysKey(thisWeek, 7))}
              >
                This week → next week
              </Button>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Or pick any two weeks</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="week-from" className="text-xs">Copy week of</Label>
                  <Input
                    id="week-from"
                    type="date"
                    value={from}
                    onChange={(e) => e.target.value && setFrom(mondayOf(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="week-to" className="text-xs">Onto week of</Label>
                  <Input
                    id="week-to"
                    type="date"
                    value={to}
                    onChange={(e) => e.target.value && setTo(mondayOf(e.target.value))}
                  />
                </div>
              </div>
              <Button
                type="button"
                disabled={isPending || from === to}
                onClick={() => copy(from, to)}
              >
                {isPending && <Loader2 className="animate-spin" />}
                Copy week
              </Button>
            </div>

            {message && (
              <p
                className={`flex items-center gap-1.5 text-sm ${message.ok ? "text-good" : "text-destructive"}`}
              >
                {message.ok && <Check className="size-4" />}
                {message.text}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
