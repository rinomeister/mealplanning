"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CameraOff, ChevronDown, ChevronLeft, Flashlight, Keyboard, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCameraScanner } from "@/lib/use-camera-scanner";
import { flowHref } from "@/lib/add-flow";
import { fmtKcal } from "@/lib/macro-format";
import { scaleGrams, type Macros } from "@/lib/macros";
import type { Targets } from "@/lib/macro-format";
import type { BarcodeLookupResult } from "@/lib/barcode";
import { SLOTS, SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { FlowScreen } from "@/components/add/flow-screen";
import { ProductForm } from "@/components/product/product-form";
import { ProductConfirm, type ConfirmProduct } from "@/components/add/product-confirm";
import { setProductFavoriteAction } from "@/app/(app)/products/actions";
import {
  logExistingProductAction,
  logProductAction,
  removeEntriesAction,
} from "@/app/(app)/today/actions";

type Phase =
  | { kind: "camera" }
  | { kind: "typing" }
  | { kind: "looking"; code: string }
  | { kind: "found"; product: ConfirmProduct; servingLabel: string | null }
  | { kind: "missing"; code: string; error?: string }
  | { kind: "create"; code: string };

const KEEP_KEY = "keep-scanning";
const keepSub = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(KEEP_KEY, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(KEEP_KEY, cb);
  };
};
const readKeep = () => {
  try {
    return localStorage.getItem(KEEP_KEY) === "1";
  } catch {
    return false;
  }
};
function writeKeep(on: boolean) {
  try {
    localStorage.setItem(KEEP_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(KEEP_KEY));
}

/** Barcodes are 8 (EAN-8), 12 (UPC-A) or 13 (EAN-13) digits: look up then. */
const AUTO_LENGTHS = new Set([8, 12, 13]);

/** Dark pill: "Adding to Snack 2 ▾", a native select underneath. */
function SlotPill({ slot, onSlot }: { slot: SlotKey; onSlot: (s: SlotKey) => void }) {
  return (
    <label className="relative inline-flex h-11 items-center gap-1.5 rounded-full bg-black/55 px-4 text-sm text-white">
      Adding to <b className="font-semibold">{SLOT_LABELS[slot]}</b>
      <ChevronDown className="size-4" />
      <select
        value={slot}
        onChange={(e) => onSlot(e.target.value as SlotKey)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Slot to add to"
      >
        {SLOTS.map((s) => (
          <option key={s} value={s}>
            {SLOT_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Full-screen scanner: camera → confirm amount sheet → added. Type a barcode
 * instead, or search by name. Unknown barcodes can be created on the spot.
 */
export function ScannerScreen({
  date,
  initialSlot,
  eatenFlag,
  backHref,
  lastGrams,
  favoriteIds,
  eaten,
  targets,
}: {
  date: string;
  initialSlot: SlotKey;
  eatenFlag: boolean;
  backHref: string;
  lastGrams: Record<string, number | null>;
  favoriteIds: string[];
  eaten: Macros;
  targets: Targets;
}) {
  const router = useRouter();
  const toast = useToast();
  const [slot, setSlot] = useState<SlotKey>(initialSlot);
  const [phase, setPhase] = useState<Phase>({ kind: "camera" });
  const [typed, setTyped] = useState("");
  const [favorites, setFavorites] = useState(favoriteIds);
  const [dayEaten, setDayEaten] = useState(eaten);
  const keep = useSyncExternalStore(keepSub, readKeep, () => false);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const lookup = useCallback(async (code: string) => {
    setPhase({ kind: "looking", code });
    try {
      const res = await fetch(`/api/barcode/${code}`);
      const data: BarcodeLookupResult = await res.json();
      if (data.found) {
        setPhase({
          kind: "found",
          servingLabel: data.servingLabel,
          product: {
            id: data.productId ?? null,
            barcode: data.code,
            name: data.name,
            brand: data.brand,
            servingGrams: data.servingGrams,
            portions: data.portions ?? [],
            per100g: data.per100g,
          },
        });
      } else {
        setPhase({ kind: "missing", code, error: data.error });
      }
    } catch {
      setPhase({ kind: "missing", code, error: "You're offline or the lookup failed." });
    }
  }, []);

  const { videoRef, frameRef, status: camStatus, start, stop, torch, toggleTorch } = useCameraScanner(lookup);

  // The camera runs only while the camera view is showing.
  useEffect(() => {
    if (phase.kind === "camera") void start();
    else if (phase.kind === "typing" || phase.kind === "create") stop();
  }, [phase.kind, start, stop]);

  function rescan() {
    setTyped("");
    setPhase({ kind: "camera" });
  }

  async function add(product: ConfirmProduct, servingLabel: string | null, grams: number): Promise<boolean> {
    const res = product.id
      ? await logExistingProductAction({ date, slot, productId: product.id, grams }, { eaten: eatenFlag })
      : await logProductAction(
          {
            date,
            slot,
            barcode: product.barcode!,
            name: product.name,
            brand: product.brand,
            servingLabel,
            servingGrams: product.servingGrams,
            ...product.per100g,
            grams,
          },
          { eaten: eatenFlag },
        );
    if (!res.ok) return false;
    const kcal = scaleGrams(product.per100g, grams).kcal;
    if (eatenFlag) {
      const m = scaleGrams(product.per100g, grams);
      setDayEaten((d) => ({
        kcal: d.kcal + m.kcal,
        protein: d.protein + m.protein,
        fat: d.fat + m.fat,
        carbs: d.carbs + m.carbs,
        sugar: d.sugar + m.sugar,
        fiber: d.fiber + m.fiber,
      }));
    }
    toast.undoable({
      message: `Added to ${SLOT_LABELS[slot]} · ${fmtKcal(kcal)} kcal`,
      commit: () => {},
      undo: () => void removeEntriesAction([res.id]),
    });
    if (keep) rescan();
    else router.push(backHref);
    return true;
  }

  function toggleFavorite(id: string) {
    const on = !favorites.includes(id);
    setFavorites((f) => (on ? [...f, id] : f.filter((x) => x !== id)));
    void setProductFavoriteAction(id, on);
  }

  // ---------------------------------------------------------------- typing
  if (phase.kind === "typing") {
    const digits = typed.replace(/\D/g, "");
    return (
      <FlowScreen
        dark
        top={
          <div className="flex items-center gap-2 pb-2">
            <button type="button" onClick={rescan} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Back to camera">
              <ChevronLeft className="size-5" />
            </button>
            <p className="flex-1 text-center font-semibold">Adding to {SLOT_LABELS[slot]}</p>
            <span className="size-11" />
          </div>
        }
        bottom={
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="w-full"
            disabled={digits.length < 6}
            onClick={() => void lookup(digits)}
          >
            Look up
          </Button>
        }
      >
        <label className="mt-8 flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-white/70">Barcode (EAN / UPC)</span>
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="search"
            autoComplete="off"
            value={typed}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 14);
              setTyped(v);
              clearTimeout(typeTimer.current);
              // 13 digits can't grow; 8 or 12 might, so wait for a pause.
              if (v.length === 13) void lookup(v);
              else if (AUTO_LENGTHS.has(v.length)) typeTimer.current = setTimeout(() => void lookup(v), 900);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && digits.length >= 6) void lookup(digits);
            }}
            className="num h-16 rounded-[14px] border-2 border-white/80 bg-transparent px-4 text-[28px] tracking-wider text-white outline-none"
          />
          <span className="text-[13px] text-white/60">
            {digits.length} of 13 digits · looks up automatically at 8, 12 or 13
          </span>
        </label>
      </FlowScreen>
    );
  }

  // ---------------------------------------------------------------- create
  if (phase.kind === "create") {
    return (
      <ProductForm
        embedded
        barcode={phase.code}
        onCancel={() => setPhase({ kind: "missing", code: phase.code })}
        onSaved={() => void lookup(phase.code)}
      />
    );
  }

  // ---------------------------------------------------------------- camera
  const blocked = camStatus === "denied" || camStatus === "unavailable";

  return (
    <div
      className="fixed inset-x-0 z-30 overflow-hidden bg-[#111214] text-white"
      style={{ top: "var(--vv-top, 0px)", height: "var(--vv-h, 100dvh)" }}
    >
      <video
        ref={videoRef}
        className={cn("absolute inset-0 size-full object-cover", (phase.kind !== "camera" || blocked) && "invisible")}
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={frameRef}
        className={cn("absolute inset-0 size-full object-cover", phase.kind === "camera" && "invisible")}
      />

      {!blocked && phase.kind === "camera" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative h-44 w-[78%] max-w-sm rounded-[14px] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-[14px]", "right-0 top-0 border-r-4 border-t-4 rounded-tr-[14px]", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-[14px]", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-[14px]"].map((c) => (
              <span key={c} className={cn("absolute size-9 border-white", c)} />
            ))}
            <span className="scan-line absolute inset-x-5 h-0.5 bg-[#5b8cff] shadow-[0_0_12px_#5b8cff]" />
          </div>
          <p className="mt-5 font-semibold">{camStatus === "starting" ? "Starting camera…" : "Point at the barcode"}</p>
          <p className="text-sm text-white/70">It scans automatically — hold steady</p>
        </div>
      )}

      {blocked && phase.kind === "camera" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="grid size-16 place-items-center rounded-[18px] bg-white/10">
            <CameraOff className="size-7" />
          </span>
          <p className="t-h2 mt-5">{camStatus === "denied" ? "Camera access is off" : "No camera available"}</p>
          <p className="mt-2 max-w-xs text-white/75">
            You can still type the barcode{camStatus === "denied" ? ", or allow the camera in your browser settings and come back" : ""}.
          </p>
          {camStatus === "denied" && (
            <div className="mt-5 w-full max-w-sm rounded-card border border-white/15 p-4 text-left text-[13px] text-white/75">
              <p className="mb-1 font-semibold text-white">iPhone</p>
              <p>Settings → Safari → Camera → Allow (or the site settings for this app).</p>
              <p className="mb-1 mt-3 font-semibold text-white">Android</p>
              <p>Tap the lock icon in Chrome → Permissions → Camera.</p>
            </div>
          )}
        </div>
      )}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <Link href={backHref} className="grid size-11 place-items-center rounded-full bg-black/55" aria-label="Close scanner">
          <X className="size-5" />
        </Link>
        <SlotPill slot={slot} onSlot={setSlot} />
        {torch.supported ? (
          <button
            type="button"
            onClick={toggleTorch}
            className={cn("grid size-11 place-items-center rounded-full", torch.on ? "bg-white text-black" : "bg-black/55")}
            aria-label={torch.on ? "Turn torch off" : "Turn torch on"}
            aria-pressed={torch.on}
          >
            <Flashlight className="size-5" />
          </button>
        ) : (
          <span className="size-11" />
        )}
      </div>

      {/* Bottom actions */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {blocked ? (
            <>
              <Button type="button" size="lg" variant="secondary" onClick={() => setPhase({ kind: "typing" })}>
                Type barcode
              </Button>
              <Link href={flowHref("search", slot, date)} className="press flex h-[52px] items-center justify-center rounded-btn bg-white/10 font-semibold">
                Search by name
              </Link>
              <button type="button" className="h-11 font-semibold" onClick={() => void start()}>
                Try camera again
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Link href={flowHref("search", slot, date)} className="press flex h-[52px] items-center justify-center gap-2 rounded-btn bg-black/55 font-semibold">
                  <Search className="size-5" /> Search name
                </Link>
                <button type="button" onClick={() => setPhase({ kind: "typing" })} className="press flex h-[52px] items-center justify-center gap-2 rounded-btn bg-black/55 font-semibold">
                  <Keyboard className="size-5" /> Type barcode
                </button>
              </div>
              <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-white/85">
                Keep scanning after add
                <input
                  type="checkbox"
                  role="switch"
                  checked={keep}
                  onChange={(e) => writeKeep(e.target.checked)}
                  className="peer sr-only"
                />
                <span aria-hidden className="relative h-7 w-12 rounded-full bg-white/25 transition-colors peer-checked:bg-good peer-focus-visible:ring-2 peer-focus-visible:ring-white after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
              </label>
            </>
          )}
        </div>
      </div>

      {phase.kind === "looking" && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <p className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Looking up {phase.code}…
          </p>
        </div>
      )}

      {phase.kind === "found" && (
        <Sheet label={`Add ${phase.product.name}`} onClose={rescan}>
          <p className="mx-auto -mt-1 mb-2 w-fit rounded-full bg-good px-3 py-1 text-[13px] font-semibold text-white">
            ✓ Found · {phase.product.barcode}
          </p>
          <ProductConfirm
            product={phase.product}
            lastGrams={phase.product.id ? lastGrams[phase.product.id] ?? null : null}
            slot={slot}
            onSlot={setSlot}
            eaten={dayEaten}
            targets={targets}
            favorite={phase.product.id ? favorites.includes(phase.product.id) : undefined}
            onToggleFavorite={phase.product.id ? () => toggleFavorite(phase.product.id!) : undefined}
            onAdd={(g) => add(phase.product, phase.servingLabel, g)}
          />
        </Sheet>
      )}

      {phase.kind === "missing" && (
        <Sheet label="Barcode not found" onClose={rescan}>
          <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
            <p className="t-h2">We don&apos;t know this one</p>
            <p className="text-ink-2">
              Barcode <span className="num font-semibold text-ink">{phase.code}</span> isn&apos;t in your products or
              Open Food Facts.{phase.error ? ` ${phase.error}` : ""}
            </p>
            <Button type="button" size="lg" onClick={() => setPhase({ kind: "create", code: phase.code })}>
              Create product with this barcode
            </Button>
            <Link href={flowHref("search", slot, date)} className="press flex h-[52px] items-center justify-center rounded-btn bg-surface-2 font-semibold">
              Search by name
            </Link>
            <button type="button" className="h-11 font-semibold" onClick={rescan}>
              Scan again
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
