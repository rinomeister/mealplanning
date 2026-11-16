"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setMealFavoriteAction } from "@/app/(app)/meals/actions";

/** Star a meal so it sits at the top of the meal picker on Track. */
export function FavoriteMealButton({
  mealId,
  initial,
}: {
  mealId: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        startTransition(async () => {
          await setMealFavoriteAction(mealId, next);
        });
      }}
    >
      <Star className={cn(on && "fill-amber-400 text-amber-400")} />
    </Button>
  );
}
