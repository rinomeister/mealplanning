import Link from "next/link";

/** Week | List switch at the top of Plan. List carries the items-left badge. */
export function PlanTabs({ active, left }: { active: "week" | "list"; left: number }) {
  return (
    <div role="tablist" aria-label="Plan view" className="seg mb-4">
      <Link href="/plan" role="tab" aria-selected={active === "week"} replace>
        Week
      </Link>
      <Link href="/plan/list" role="tab" aria-selected={active === "list"} replace>
        List
        {left > 0 && (
          <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-bold text-inv" aria-label={`${left} left to buy`}>
            {left}
          </span>
        )}
      </Link>
    </div>
  );
}
