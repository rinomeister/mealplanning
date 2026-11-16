"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteMealAction,
  mealUpcomingCountAction,
} from "@/app/(app)/meals/actions";
import { deleteMessage } from "@/lib/format";

export function DeleteMealButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const upcoming = await mealUpcomingCountAction(id);
          if (!confirm(deleteMessage("meal", upcoming))) return;
          const res = await deleteMealAction(id);
          if (res && !res.ok) alert(res.error);
        });
      }}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      Delete
    </Button>
  );
}
