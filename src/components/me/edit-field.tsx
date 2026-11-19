"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn, parseDecimal } from "@/lib/utils";
import { fmtKcal } from "@/lib/macro-format";
import { PROFILE_FIELDS, TARGET_KEYS, pcfKcal, type ProfileField } from "@/lib/profile-fields";
import { Button } from "@/components/ui/button";
import { FlowScreen } from "@/components/add/flow-screen";
import { MacroBadge } from "@/components/macro-ui";
import { useToast } from "@/components/toast";
import { updateProfileFieldAction } from "@/app/(app)/me/actions";

export type FieldValues = Record<ProfileField, string>;

const isMacro = (k: ProfileField): k is "protein" | "carbs" | "fat" | "sugar" | "fiber" =>
  k === "protein" || k === "carbs" || k === "fat" || k === "sugar" || k === "fiber";

/**
 * Me → tap a row. One field, full screen, keyboard up. On the targets, ⌃ ⌄
 * save and step to the previous / next target.
 */
export function EditField({ field, values, weightKg }: { field: ProfileField; values: FieldValues; weightKg: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const def = PROFILE_FIELDS[field];
  const [value, setValue] = useState(values[field]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isTarget = TARGET_KEYS.includes(field);
  const idx = TARGET_KEYS.indexOf(field);

  const num = (k: ProfileField) => {
    const raw = k === field ? value : values[k];
    const n = parseDecimal(raw);
    return raw.trim() && Number.isFinite(n) ? n : null;
  };

  async function save(): Promise<boolean> {
    if (value === values[field]) return true;
    setBusy(true);
    const res = await updateProfileFieldAction(field, value);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    return true;
  }

  async function saveAndClose() {
    if (!(await save())) return;
    if (value !== values[field]) toast.show({ message: `${def.label} saved` });
    router.back();
  }

  async function step(to: number) {
    if (!(await save())) return;
    router.replace(`/me/edit/${TARGET_KEYS[to]}`);
  }

  // The P/C/F check: do the gram targets add up to the calorie target?
  const p = num("protein");
  const c = num("carbs");
  const f = num("fat");
  const kcal = num("kcal");
  const showPcf = field === "kcal" || field === "protein" || field === "carbs" || field === "fat";
  const sum = pcfKcal(p ?? 0, c ?? 0, f ?? 0);
  const diff = kcal != null ? sum - kcal : 0;
  const within = kcal ? Math.abs(diff) / kcal <= 0.02 : false;
  // Suggest moving carbs (or fat when carbs is the one being edited).
  const fix = field === "carbs" ? { name: "fat", per: 9 } : { name: "carbs", per: 4 };
  const fixG = Math.round(Math.abs(diff) / fix.per / 5) * 5;

  const perKg = field === "protein" && weightKg && num("protein") != null ? num("protein")! / weightKg : null;

  return (
    <FlowScreen
      top={
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3">
          <button type="button" onClick={() => router.back()} className="-ml-1 h-11 px-1 font-semibold">
            Cancel
          </button>
          <h1 className="text-center font-semibold">{isTarget ? "Daily targets" : "You"}</h1>
          <span className="w-14" />
        </div>
      }
      bottom={
        <div className="flex gap-2">
          {isTarget && (
            <>
              <button
                type="button"
                aria-label="Previous target"
                disabled={busy || idx <= 0}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => void step(idx - 1)}
                className="press grid size-12 shrink-0 place-items-center rounded-[14px] bg-surface-2 disabled:opacity-40"
              >
                <ChevronUp className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next target"
                disabled={busy || idx >= TARGET_KEYS.length - 1}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => void step(idx + 1)}
                className="press grid size-12 shrink-0 place-items-center rounded-[14px] bg-surface-2 disabled:opacity-40"
              >
                <ChevronDown className="size-5" />
              </button>
            </>
          )}
          <Button type="button" size="lg" className="flex-1" disabled={busy} onPointerDown={(e) => e.preventDefault()} onClick={() => void saveAndClose()}>
            {busy && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-3 pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          void saveAndClose();
        }}
      >
        <label htmlFor="field" className="flex items-center gap-2 text-[15px] font-semibold text-ink-2">
          {isMacro(field) && <MacroBadge macro={field} />}
          {def.label}
        </label>
        <div className="flex h-16 items-center rounded-[14px] border-2 border-ink bg-surface px-4 focus-within:shadow-[0_0_0_4px_var(--track)]">
          <input
            id="field"
            autoFocus
            autoComplete={field === "name" ? "name" : "off"}
            inputMode={def.kind === "text" ? "text" : "decimal"}
            enterKeyHint="done"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            placeholder={def.kind === "text" ? "Your name" : "Not set"}
            className={cn("min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3", def.kind === "text" ? "text-[20px] font-medium" : "num text-[30px] font-semibold")}
          />
          {def.unit && <span className="shrink-0 text-ink-3">{isTarget ? `${def.unit} / day` : def.unit}</span>}
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        {perKg != null && <p className="text-sm text-ink-3">≈ {perKg.toFixed(1)} g per kg bodyweight</p>}
        {def.hint && <p className="text-sm text-ink-3">{def.hint}</p>}
        {isTarget && <p className="text-sm text-ink-3">Leave it empty for no target.</p>}

        {showPcf && (p != null || c != null || f != null) && (
          <div className="mt-1 rounded-[14px] bg-surface-2 p-3.5">
            <p className="text-[13px] font-semibold text-ink-2">
              P/C/F add up to <span className="num">{fmtKcal(sum)}</span> kcal{kcal != null && <> · target <span className="num">{fmtKcal(kcal)}</span></>}
            </p>
            {sum > 0 && (
              <div className="my-2 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                <i className="block" style={{ flex: (p ?? 0) * 4, background: "var(--pro)" }} />
                <i className="block" style={{ flex: (c ?? 0) * 4, background: "var(--carb)" }} />
                <i className="block" style={{ flex: (f ?? 0) * 9, background: "var(--fat)" }} />
              </div>
            )}
            <p className="text-[13px] text-ink-2">
              {kcal == null
                ? "Set a calorie target to compare."
                : within
                  ? `Within ${Math.max(0, Math.round((Math.abs(diff) / kcal) * 100))}% of your calorie target.`
                  : diff > 0
                    ? `${fmtKcal(diff)} kcal over${fixG > 0 && field !== "kcal" ? ` · lower ${fix.name} by ${fixG} g?` : "."}`
                    : `${fmtKcal(-diff)} kcal under${fixG > 0 && field !== "kcal" ? ` · raise ${fix.name} by ${fixG} g?` : "."}`}
            </p>
          </div>
        )}
      </form>
    </FlowScreen>
  );
}
