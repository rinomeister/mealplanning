"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importSharedMealAction } from "@/app/(app)/import/actions";

/** Import the previewed meal; on success the action redirects to the copy. */
export function ImportMealButton({ code }: { code: string }) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await importSharedMealAction(code);
            if (res && !res.ok) setMessage(res.error);
          })
        }
      >
        {isPending ? <Loader2 className="animate-spin" /> : <Download />}
        Import to my meals
      </Button>
      {message && <p className="text-sm text-destructive">{message}</p>}
    </div>
  );
}
