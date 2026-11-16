"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtMacro } from "@/lib/macros";
import { parseDecimal } from "@/lib/utils";
import { setCookedWeightAction } from "@/app/(app)/meals/actions";

/**
 * "Weigh the whole pot": record this batch's cooked weight right on the meal
 * page. Every pot comes out a little different, so this is the one number you
 * update each time you cook — then you log the meal by the grams on your plate.
 */
export function BatchWeightCard({
  mealId,
  serves,
  cookedGrams,
  kcalPerServing,
}: {
  mealId: string;
  serves: number;
  cookedGrams: number | null;
  kcalPerServing: number | null;
}) {
  const [value, setValue] = useState(cookedGrams != null ? String(cookedGrams) : "");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const typed = parseDecimal(value);
  const valid = Number.isFinite(typed) && typed > 0;
  const perServing = valid ? typed / serves : null;
  const unchanged = valid ? typed === cookedGrams : value.trim() === "" && cookedGrams == null;

  function save(grams: number | null) {
    setMessage("");
    setSaved(false);
    startTransition(async () => {
      const res = await setCookedWeightAction(mealId, grams);
      if (res.ok) setSaved(true);
      else setMessage(res.error);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
            <Scale className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Weigh the whole pot</p>
            <p className="text-xs text-muted-foreground">
              Enter the cooked weight of this batch, then log it by the grams on
              your plate instead of by servings.
            </p>
          </div>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) {
              setMessage("Enter the weight in grams.");
              return;
            }
            save(typed);
          }}
        >
          <Input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            inputMode="decimal"
            placeholder="e.g. 1200"
            className="w-28"
            aria-label="Cooked batch weight in grams"
          />
          <span className="text-sm text-muted-foreground">g</span>
          <Button
            type="submit"
            variant="outline"
            disabled={isPending || unchanged}
            className="ml-auto"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved && unchanged ? (
              <Check className="size-4" />
            ) : null}
            {saved && unchanged ? "Saved" : "Save"}
          </Button>
        </form>
        {perServing != null && (
          <p className="text-xs tabular-nums text-muted-foreground">
            {fmtMacro(serves)} serving{serves === 1 ? "" : "s"} · about{" "}
            {Math.round(perServing)} g each
            {kcalPerServing != null &&
              ` · ${fmtMacro((kcalPerServing / perServing) * 100, "kcal")} kcal per 100 g`}
          </p>
        )}
        {cookedGrams != null && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setValue("");
              save(null);
            }}
            className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Stop logging by weight
          </button>
        )}
        {message && <p className="text-sm text-destructive">{message}</p>}
      </CardContent>
    </Card>
  );
}
