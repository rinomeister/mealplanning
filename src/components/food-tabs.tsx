import Link from "next/link";
import { Package, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "meals", href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { id: "products", href: "/products", label: "Products", icon: Package },
] as const;

export type FoodTab = (typeof TABS)[number]["id"];

/**
 * Switches between the two halves of the Food section: meals you cook and
 * single products you eat. Separate routes so each keeps its own query params
 * and data fetch, same as PlanTabs.
 */
export function FoodTabs({ active }: { active: FoodTab }) {
  return (
    <div
      role="tablist"
      aria-label="Food view"
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
