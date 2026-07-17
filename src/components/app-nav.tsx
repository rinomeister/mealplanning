"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  NotebookPen,
  ShoppingCart,
  User,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/track", label: "Today", icon: NotebookPen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart },
  { href: "/profile", label: "Profile", icon: User },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    // The root layout opts into `viewportFit: "cover"`, so the page extends
    // under the home indicator. The bar's background fills to the true bottom
    // edge, but `pb-[env(safe-area-inset-bottom)]` lifts the tap targets clear
    // of it — without this the lower half of each button is unpressable.
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-6 gap-0.5 py-1 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                // min-h-12 keeps each target at ~48px, above the 44px iOS minimum.
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[12px] font-medium leading-none tracking-tight transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground active:bg-muted",
              )}
            >
              <Icon className="size-6 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
