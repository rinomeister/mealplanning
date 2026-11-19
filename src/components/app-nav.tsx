"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  CalendarDays,
  ChartPie,
  House,
  Library,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { defaultSlot } from "@/lib/default-slot";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  /** Label in the desktop rail, where there's room to say more. */
  railLabel?: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Extra path roots this tab owns. */
  also?: string[];
};

// Home is the glanceable dashboard, Today is where you log. Library holds
// products and meals; Plan holds the week plan and the shopping list.
const HOME: NavItem = { href: "/", label: "Home", icon: House, exact: true };
const TODAY: NavItem = { href: "/today", label: "Today", icon: ChartPie };
const LIBRARY: NavItem = {
  href: "/library/products",
  label: "Library",
  icon: Library,
  also: ["/library", "/meals", "/products"],
};
const PLAN: NavItem = {
  href: "/plan",
  label: "Plan",
  railLabel: "Plan & list",
  icon: CalendarDays,
};
const NAV = [HOME, TODAY, LIBRARY, PLAN];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return (
    matches(pathname, item.href) ||
    (item.also?.some((h) => matches(pathname, h)) ?? false)
  );
}

/** Where "+" goes: the add sheet for the slot that fits the time of day. */
function addHref() {
  return `/today?add=${defaultSlot()}`;
}
function scanHref() {
  return `/scan?slot=${defaultSlot()}`;
}

/**
 * The centre "+": tap opens Add for the current slot, long-press goes
 * straight to the scanner.
 */
function AddButton() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);

  function start() {
    longPressed.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      longPressed.current = true;
      navigator.vibrate?.(10);
      router.push(scanHref());
    }, 500);
  }
  function cancel() {
    clearTimeout(timer.current);
  }

  return (
    <button
      type="button"
      aria-label="Add food (hold to scan)"
      className="press -mt-3.5 grid size-15 shrink-0 place-items-center rounded-[20px] bg-accent text-on-accent shadow-[0_6px_18px_rgba(0,0,0,.22)]"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (longPressed.current) return;
        router.push(addHref());
      }}
    >
      <Plus className="size-7" strokeWidth={2.25} />
    </button>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] text-[11px] font-semibold",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 2} />
      {item.label}
    </Link>
  );
}

/** Phone/tablet bottom bar. Last child of the shell's flex column, not fixed. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="safe-bottom hide-on-kbd shrink-0 border-t border-line bg-surface desk:hidden"
    >
      <div className="mx-auto flex max-w-lg items-start justify-around px-2 pb-1 pt-1.5 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
        <Tab item={HOME} active={isActive(pathname, HOME)} />
        <Tab item={TODAY} active={isActive(pathname, TODAY)} />
        <div className="flex flex-1 justify-center">
          <AddButton />
        </div>
        <Tab item={LIBRARY} active={isActive(pathname, LIBRARY)} />
        <Tab item={PLAN} active={isActive(pathname, PLAN)} />
      </div>
    </nav>
  );
}

/** Desktop (≥900 px) left rail: Add food, the four sections, Me at the bottom. */
export function Rail() {
  const pathname = usePathname();
  const router = useRouter();

  // "A" opens Add from anywhere on desktop, unless you're typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "a" && e.key !== "A") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      router.push(addHref());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  const meActive = matches(pathname, "/me");

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-bg px-4 pb-6 pt-6 desk:flex">
      <button
        type="button"
        onClick={() => router.push(addHref())}
        className="press mb-6 flex h-[52px] items-center gap-2.5 rounded-btn bg-accent px-5 font-semibold text-on-accent"
      >
        <Plus className="size-5" strokeWidth={2.25} />
        Add food
        <kbd className="ml-auto font-sans text-xs font-semibold opacity-60">A</kbd>
      </button>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-[52px] items-center rounded-btn px-5 font-semibold transition-colors",
                active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60",
              )}
            >
              {item.railLabel ?? item.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/me"
        aria-current={meActive ? "page" : undefined}
        className={cn(
          "mt-auto flex h-[52px] items-center rounded-btn px-5 font-semibold transition-colors",
          meActive ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60",
        )}
      >
        Me &amp; settings
      </Link>
    </aside>
  );
}
