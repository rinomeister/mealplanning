import Link from "next/link";

const TABS = [
  { id: "calendar", href: "/plan", label: "Week" },
  { id: "shopping", href: "/plan/list", label: "List" },
] as const;

export type PlanTab = (typeof TABS)[number]["id"];

/**
 * Week | List switch on the Plan tab. They stay separate routes — each keeps
 * its own query params and data fetch — but read as one screen.
 */
export function PlanTabs({ active }: { active: PlanTab }) {
  return (
    <div role="tablist" aria-label="Plan view" className="seg mb-4">
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
