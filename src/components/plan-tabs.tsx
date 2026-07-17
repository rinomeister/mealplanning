import Link from "next/link";
import { CalendarDays, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays },
  { id: "shopping", href: "/shopping", label: "Shopping", icon: ShoppingCart },
] as const;

export type PlanTab = (typeof TABS)[number]["id"];

/**
 * Switches between the two halves of the Plan section. They stay separate
 * routes — each keeps its own query params (month, range, start date) and its
 * own data fetch — but read as one screen with one nav tab.
 */
export function PlanTabs({ active }: { active: PlanTab }) {
  return (
    <div
      role="tablist"
      aria-label="Plan view"
      className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
    >
      {TABS.map(({ id, href, label, icon: Icon }) => {
        const on = id === active;
        return (
          <Link
            key={id}
            href={href}
            role="tab"
            aria-selected={on}
            className={cn(
              "flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
              on
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground active:bg-card/50",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
