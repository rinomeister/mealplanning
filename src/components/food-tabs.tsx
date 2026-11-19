import Link from "next/link";

const TABS = [
  { id: "products", href: "/library/products", label: "Products" },
  { id: "meals", href: "/library/meals", label: "Meals" },
] as const;

export type FoodTab = (typeof TABS)[number]["id"];

/**
 * Products | Meals switch at the top of Library. Separate routes so each keeps
 * its own query params and data fetch, same as PlanTabs.
 */
export function FoodTabs({ active }: { active: FoodTab }) {
  return (
    <div role="tablist" aria-label="Library view" className="seg mb-4">
      {TABS.map(({ id, href, label }) => (
        <Link
          key={id}
          href={href}
          role="tab"
          aria-selected={id === active}
          replace
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
