"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, CookingPot, Loader2, Plus, Search, X } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";
import { scaleMacros, type Macros, type MealMacros } from "@/lib/macros";
import { MACROS_UI, fmtG, fmtKcal, type Targets } from "@/lib/macro-format";
import type { LastAmount } from "@/lib/usage";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { MacroDot } from "@/components/macro-ui";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { FlowScreen } from "@/components/add/flow-screen";
import { addPlanEntryAction } from "@/app/(app)/plan/actions";
import { removeEntriesAction } from "@/app/(app)/today/actions";

export type PickMeal = {
  id: string;
  name: string;
  per: MealMacros;
  servingLabel: string | null;
  gramsPerServing: number | null;
  cookedGrams: number | null;
  favorite: boolean;
  tagIds: string[];
};

type Chip = "fit" | "favorites" | "protein" | `tag:${string}`;

function unitLabel(m: PickMeal, n: number): string {
  if (m.servingLabel) return m.servingLabel.replace(/^1\s+/, "");
  return n === 1 ? "serving" : "servings";
}

/**
 * Add a saved meal: best fit for what's left first, then by servings (with
 * the meal's own serving name) or by weight for a weighed batch.
 */
export function MealPick({
  date,
  initialSlot,
  eatenFlag,
  backHref,
  meals,
  tags,
  last,
  remaining,
}: {
  date: string;
  initialSlot: SlotKey;
  eatenFlag: boolean;
  backHref: string;
  meals: PickMeal[];
  tags: { id: string; name: string }[];
  last: Record<string, LastAmount>;
  remaining: Targets;
}) {
  const router = useRouter();
  const toast = useToast();
  const [slot, setSlot] = useState<SlotKey>(initialSlot);
  const [chip, setChip] = useState<Chip>("fit");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<"servings" | "grams">("servings");
  const [amount, setAmount] = useState("1");
  const [pending, setPending] = useState<string | null>(null);

  const kcalLeft = remaining.kcal;
  const pLeft = remaining.protein;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let pool = meals.filter((m) => !q || m.name.toLowerCase().includes(q));
    if (chip === "favorites") pool = pool.filter((m) => m.favorite);
    if (chip.startsWith("tag:")) pool = pool.filter((m) => m.tagIds.includes(chip.slice(4)));
    const density = (m: PickMeal) => (m.per.kcal ? ((m.per.protein ?? 0) / m.per.kcal) * 100 : 0);
    if (chip === "protein") return [...pool].sort((a, b) => density(b) - density(a));
    // Best fit: meals whose one serving stays within the kcal left, ranked by
    // how close their protein is to the protein left; then the rest.
    const fits = (m: PickMeal) => kcalLeft == null || (m.per.kcal ?? 0) <= kcalLeft;
    const closeness = (m: PickMeal) => (pLeft == null ? 0 : Math.abs((m.per.protein ?? 0) - Math.max(0, pLeft)));
    return [...pool].sort((a, b) => {
      const fa = fits(a), fb = fits(b);
      if (fa !== fb) return fa ? -1 : 1;
      if (fa) return closeness(a) - closeness(b);
      return (a.per.kcal ?? 0) - (b.per.kcal ?? 0);
    });
  }, [meals, query, chip, kcalLeft, pLeft]);

  /** The amount one tap on + adds: last time's, else one serving. */
  function defaultAmount(m: PickMeal): { servings: number; grams: number | null } {
    const l = last[m.id];
    if (m.gramsPerServing != null) {
      const grams = l?.grams ?? (l ? l.servings * m.gramsPerServing : m.gramsPerServing);
      return { servings: grams / m.gramsPerServing, grams: Math.round(grams) };
    }
    return { servings: l?.servings ?? 1, grams: null };
  }

  function expand(m: PickMeal) {
    if (open === m.id) {
      setOpen(null);
      return;
    }
    const d = defaultAmount(m);
    setOpen(m.id);
    if (d.grams != null && last[m.id]?.grams != null) {
      setMode("grams");
      setAmount(String(d.grams));
    } else {
      setMode("servings");
      setAmount(String(Math.round(d.servings * 100) / 100));
    }
  }

  async function add(m: PickMeal, servings: number, grams: number | null, leave: boolean) {
    setPending(m.id);
    const res = await addPlanEntryAction({ date, slot, mealId: m.id, servings, grams }, { eaten: eatenFlag });
    setPending(null);
    if (!res.ok) {
      toast.show({ message: res.error, tone: "error" });
      return;
    }
    toast.undoable({
      message: `Added to ${SLOT_LABELS[slot]} · ${fmtKcal((m.per.kcal ?? 0) * servings)} kcal`,
      commit: () => {},
      undo: () => void removeEntriesAction([res.id]),
    });
    if (leave) router.push(backHref);
  }

  const chips: { id: Chip; label: string }[] = [
    { id: "fit", label: "Best fit" },
    { id: "favorites", label: "Favorites" },
    { id: "protein", label: "High protein" },
    ...tags.map((t) => ({ id: `tag:${t.id}` as Chip, label: t.name })),
  ];

  return (
    <FlowScreen
      top={
        <>
          <div className="flex items-center gap-1">
            <Link href={backHref} className="-ml-2 grid size-11 place-items-center rounded-[14px]" aria-label="Back">
              <ChevronLeft className="size-6" />
            </Link>
            <h1 className="flex min-w-0 flex-1 items-center gap-1 text-[22px] font-semibold">
              <span className="shrink-0">Add meal</span>
              <label className="relative inline-flex min-w-0 items-center gap-1 font-normal text-ink-3">
                <span className="truncate">· {SLOT_LABELS[slot]}</span>
                <ChevronDown className="size-4 shrink-0" />
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value as SlotKey)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Slot"
                >
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {SLOT_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
            </h1>
            <button
              type="button"
              onClick={() => {
                setSearching((s) => !s);
                setQuery("");
              }}
              className="grid size-11 place-items-center rounded-[14px] bg-surface-2"
              aria-label={searching ? "Close search" : "Search meals"}
            >
              {searching ? <X className="size-5" /> : <Search className="size-5" />}
            </button>
          </div>
          {searching && (
            <input
              autoFocus
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search meals"
              aria-label="Search meals"
              className="mt-2 h-[52px] w-full rounded-full border-2 border-ink bg-surface px-5 text-[17px] outline-none"
            />
          )}
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {chips.map((c) => (
              <button key={c.id} type="button" onClick={() => setChip(c.id)} className={cn("chip sm", chip === c.id && "on")} aria-pressed={chip === c.id}>
                {c.label}
              </button>
            ))}
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-6 pt-2">
        {remaining.kcal != null && (
          <p className="rounded-btn bg-pro-t px-4 py-3 text-sm">
            <b>Left today:</b>{" "}
            {[
              `${fmtKcal(Math.max(0, remaining.kcal))} kcal`,
              remaining.protein != null ? `${fmtG(Math.max(0, remaining.protein))} P` : null,
              remaining.carbs != null ? `${fmtG(Math.max(0, remaining.carbs))} C` : null,
              remaining.fat != null ? `${fmtG(Math.max(0, remaining.fat))} F` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {meals.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="grid size-14 place-items-center rounded-[16px] bg-surface-2">
              <CookingPot className="size-6" />
            </span>
            <p className="t-h2 mt-4">No meals yet</p>
            <p className="mt-1 max-w-xs text-ink-3">Build one from products, or turn a logged slot into a meal.</p>
            <Link href="/meals/new" className="press mt-4 flex h-11 items-center rounded-[14px] bg-surface-2 px-4 font-semibold">
              Build a meal
            </Link>
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-ink-3">No meals match.</p>
        ) : (
          list.map((m) => {
            const kcal = m.per.kcal ?? 0;
            const over = kcalLeft != null ? kcal - kcalLeft : -1;
            const isOpen = open === m.id;
            const meta = [
              m.servingLabel ?? "1 serving",
              m.gramsPerServing != null ? `${fmtG(m.gramsPerServing)} g` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const n = parseDecimal(amount);
            const valid = Number.isFinite(n) && n > 0;
            const servings = !valid ? 0 : mode === "grams" && m.gramsPerServing ? n / m.gramsPerServing : n;
            const preview = scaleMacros(m.per, servings) as Macros;

            return (
              <article
                key={m.id}
                className={cn(
                  "rounded-card bg-surface shadow-card",
                  isOpen ? "border-2 border-ink p-4" : "border border-line px-4 py-3",
                  !isOpen && over > 0 && "opacity-70",
                )}
              >
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => expand(m)} aria-expanded={isOpen} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[17px] font-semibold">{m.name}</span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {meta}
                      {kcalLeft != null &&
                        (over > 0 ? (
                          <span className="font-semibold text-bad"> · {fmtKcal(over)} kcal over</span>
                        ) : (
                          <span className="font-semibold text-good"> · fits</span>
                        ))}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-3 text-[13px] font-semibold text-ink-2">
                      {MACROS_UI.slice(0, isOpen ? 5 : 3).map((x) => (
                        <span key={x.key} className={cn("inline-flex items-center gap-1", x.cls)}>
                          <MacroDot macro={x.key} />
                          <span className="num">{fmtG(m.per[x.key] ?? 0)}</span>
                          {isOpen && ` ${x.letter}`}
                        </span>
                      ))}
                    </span>
                  </button>
                  <span className="num text-right text-lg font-semibold">
                    {fmtKcal(kcal)}
                    {isOpen && <span className="block text-xs font-normal text-ink-3">kcal</span>}
                  </span>
                  {!isOpen && (
                    <button
                      type="button"
                      disabled={pending === m.id}
                      onClick={() => {
                        const d = defaultAmount(m);
                        void add(m, d.servings, d.grams, false);
                      }}
                      className="press grid size-11 shrink-0 place-items-center rounded-full bg-surface-2"
                      aria-label={`Add ${m.name}`}
                    >
                      {pending === m.id ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 flex flex-col gap-3">
                    {m.gramsPerServing != null && (
                      <div className="seg" role="tablist" aria-label="Amount by">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mode === "servings"}
                          onClick={() => {
                            setMode("servings");
                            setAmount(String(Math.round(servings * 100) / 100 || 1));
                          }}
                        >
                          Servings
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mode === "grams"}
                          onClick={() => {
                            setMode("grams");
                            setAmount(String(Math.round((servings || 1) * m.gramsPerServing!)));
                          }}
                        >
                          Weigh (g)
                        </button>
                      </div>
                    )}
                    <Stepper
                      value={amount}
                      onChange={setAmount}
                      step={mode === "grams" ? 5 : 0.5}
                      min={0}
                      unit={mode === "grams" ? "g" : unitLabel(m, n)}
                      label={mode === "grams" ? "grams" : "servings"}
                    />
                    <div className="flex">
                      <Button
                        type="button"
                        size="lg"
                        className="min-w-0 flex-1"
                        disabled={!valid || pending === m.id}
                        onClick={() =>
                          void add(m, servings, mode === "grams" ? n : m.gramsPerServing != null ? servings * m.gramsPerServing : null, true)
                        }
                      >
                        {pending === m.id && <Loader2 className="animate-spin" />}
                        Add {valid ? (mode === "grams" ? `${fmtG(n)} g` : `${fmtG(n)} ${unitLabel(m, n)}`) : ""} · {fmtKcal(preview.kcal)} kcal
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </FlowScreen>
  );
}
