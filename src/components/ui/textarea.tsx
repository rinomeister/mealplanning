import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-3 text-[17px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus-visible:border-ink focus-visible:shadow-[0_0_0_4px_var(--track)] disabled:cursor-not-allowed disabled:opacity-50 desk:text-base",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
