"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteMealAction } from "@/app/(app)/meals/actions";

export function DeleteMealButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this meal? Planned entries using it will block deletion.")) {
          return;
        }
        startTransition(async () => {
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
