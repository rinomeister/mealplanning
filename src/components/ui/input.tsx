import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] font-medium text-ink outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-ink-3 focus-visible:border-ink focus-visible:shadow-[0_0_0_4px_var(--track)] aria-[invalid=true]:border-bad disabled:cursor-not-allowed disabled:opacity-50 desk:h-11 desk:text-base",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
