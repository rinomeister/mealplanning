import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({
  className,
  style,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-2.5 text-xs font-semibold text-ink",
        className,
      )}
      style={style}
      {...props}
    />
  );
}

export { Badge };
