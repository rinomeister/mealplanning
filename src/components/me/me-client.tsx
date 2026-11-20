"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnitSystem } from "@/lib/units";
import { SCANNER_ENGINES, useScannerEngine } from "@/lib/scanner-pref";
import { useToast } from "@/components/toast";
import { AVATARS, avatarSrc } from "@/lib/avatars";
import { Avatar } from "@/components/avatar-link";
import { applyDefaultTargetsAction, updateAvatarAction, updateUnitsAction } from "@/app/(app)/me/actions";

/** Metric | Imperial. Only changes the display; storage stays metric. */
export function UnitsSetting({ units }: { units: UnitSystem }) {
  // Shows the tap right away; the server render catches up after refresh.
  const [choice, setChoice] = useState<UnitSystem | null>(null);
  const shown = choice ?? units;
  return (
    <div className="seg" role="radiogroup" aria-label="Units">
      {(
        [
          ["METRIC", "Metric"],
          ["IMPERIAL", "Imperial"],
        ] as const
      ).map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={shown === v}
          className={cn(shown === v && "on")}
          onClick={() => {
            setChoice(v);
            void updateUnitsAction(v);
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function ScannerEngineName() {
  const engine = useScannerEngine();
  return <>{SCANNER_ENGINES.find((e) => e.value === engine)?.label}</>;
}

/** After sign-up: set targets here, or take the defaults and go. */
export function WelcomeCard() {
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <div className="card flex flex-col gap-3 border-2 border-ink p-4">
      <div>
        <p className="text-[17px] font-semibold">Welcome! Set your daily targets</p>
        <p className="mt-0.5 text-sm text-ink-2">Tap any row below to set it. Or skip and start with sensible defaults; you can change them any time.</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          start(async () => {
            await applyDefaultTargetsAction();
            toast.show({ message: "Default targets set" });
            router.push("/");
          })
        }
        className="press flex h-12 items-center justify-center gap-2 rounded-btn bg-surface-2 font-semibold"
      >
        {busy && <Loader2 className="size-4 animate-spin" />} Skip, use defaults
      </button>
    </div>
  );
}

/** Grid of preset avatars plus the plain initial. One tap saves. */
export function AvatarPicker({ avatar, name }: { avatar: string | null; name: string | null }) {
  const router = useRouter();
  const toast = useToast();
  // Shows the tap right away; the server render catches up after refresh.
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const shown = choice === undefined ? avatar : choice;

  function pick(key: string | null) {
    if (key === shown) return;
    setChoice(key);
    void updateAvatarAction(key).then((res) => {
      if (!res.ok) {
        setChoice(undefined);
        toast.show({ message: res.error, tone: "error" });
        return;
      }
      router.refresh();
    });
  }

  const options: { key: string | null; label: string }[] = [
    { key: null, label: "Initial" },
    ...AVATARS.map((a) => ({ key: a.key as string, label: a.label })),
  ];

  return (
    <div className="card p-4">
      <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-5 gap-3 min-[400px]:grid-cols-7">
        {options.map((o) => {
          const on = shown === o.key;
          return (
            <button
              key={o.key ?? "initial"}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              onClick={() => pick(o.key)}
              className={cn(
                "press relative aspect-square rounded-full outline-offset-2",
                on && "outline outline-[3px] outline-ink",
              )}
            >
              {o.key ? (
                // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG
                <img src={avatarSrc(o.key as (typeof AVATARS)[number]["key"])} alt="" className="size-full rounded-full" />
              ) : (
                <Avatar name={name} className="size-full text-lg" />
              )}
              {on && (
                <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-ink text-inv">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
