"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import type { BarcodeLookupResult } from "@/lib/barcode";
import { SLOT_LABELS, type SlotKey } from "@/lib/schemas";
import { fmtKcal } from "@/lib/macro-format";
import { useToast } from "@/components/toast";
import { BarcodeCamera } from "@/components/barcode-camera";
import { FlowScreen } from "@/components/add/flow-screen";
import { OffSearchPanel } from "@/components/off-search-panel";
import { ProductForm } from "@/components/product/product-form";
import { importOffProductAction } from "@/app/(app)/products/actions";
import { logExistingProductAction, removeEntriesAction } from "@/app/(app)/today/actions";

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Top({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3">
      <button type="button" onClick={onCancel} className="-ml-1 h-11 px-1 font-semibold">
        Cancel
      </button>
      <h1 className="truncate text-center font-semibold">{title}</h1>
      <span className="w-14" />
    </div>
  );
}

/**
 * /products/new: scan a barcode, search Open Food Facts, or type it in.
 * Scans and search picks are saved straight away and open for review; an
 * unknown barcode opens the custom form with the code filled in.
 */
export function ProductNew({
  via,
  barcode: initialBarcode,
  slot,
}: {
  via: "scan" | "online" | null;
  barcode: string | null;
  slot: SlotKey;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"scan" | "online" | "form">(via ?? "form");
  const [barcode, setBarcode] = useState(initialBarcode);
  const [typed, setTyped] = useState("");
  const [looking, setLooking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const cancel = () => router.push("/library/products");

  async function lookup(code: string) {
    if (looking) return;
    setLooking(code);
    setError("");
    try {
      const res = await fetch(`/api/barcode/${code}`);
      const data: BarcodeLookupResult = await res.json();
      if (data.found && data.productId) {
        toast.show({ message: `${data.name} is already in your products` });
        router.replace(`/products/${data.productId}`);
        return;
      }
      if (data.found) {
        const saved = await importOffProductAction({
          barcode: data.code,
          name: data.name,
          brand: data.brand,
          servingLabel: data.servingLabel,
          servingGrams: data.servingGrams,
          ...data.per100g,
        });
        if (saved.ok) {
          toast.show({ message: `Saved ${data.name}. Check the numbers.` });
          router.replace(`/products/${saved.product.id}`);
          return;
        }
        setError(saved.error);
      } else {
        // Not found anywhere: type it in, with the barcode kept.
        setBarcode(code);
        setMode("form");
      }
    } catch {
      setError("Couldn't look that up. Check the connection and try again.");
    }
    setLooking(null);
  }

  if (mode === "scan") {
    return (
      <FlowScreen top={<Top title="Scan barcode" onCancel={cancel} />}>
        <div className="flex flex-col gap-4 pb-8">
          <BarcodeCamera onDetected={(c) => void lookup(c)} />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d{6,14}$/.test(typed)) void lookup(typed);
            }}
          >
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="search"
              value={typed}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 14);
                setTyped(v);
                if (v.length === 13) void lookup(v);
              }}
              placeholder="Or type the barcode"
              aria-label="Barcode"
              className="num h-[52px] min-w-0 flex-1 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 text-[17px] outline-none focus:border-2 focus:border-ink"
            />
            <button type="submit" className="press h-[52px] rounded-[14px] bg-surface-2 px-4 font-semibold">
              Look up
            </button>
          </form>
          {looking && (
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Loader2 className="size-4 animate-spin" /> Looking up {looking}…
            </p>
          )}
          {error && <p className="text-sm text-bad">{error}</p>}
          <button type="button" className="self-start text-sm font-semibold underline" onClick={() => setMode("form")}>
            Enter it myself instead
          </button>
        </div>
      </FlowScreen>
    );
  }

  if (mode === "online") {
    return (
      <FlowScreen top={<Top title="Search Open Food Facts" onCancel={cancel} />}>
        <div className="flex flex-col gap-4 pb-8">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(query.trim());
            }}
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
            <input
              autoFocus
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Product name, e.g. skyr"
              aria-label="Search Open Food Facts"
              className="h-[52px] w-full rounded-full bg-surface-2 pl-12 pr-4 text-[17px] outline-none focus:ring-2 focus:ring-ink"
            />
          </form>
          {submitted.length >= 2 ? (
            <OffSearchPanel
              key={submitted}
              query={submitted}
              auto
              onPick={(p) => {
                toast.show({ message: `Saved ${p.name}. Check the numbers.` });
                router.replace(`/products/${p.id}`);
              }}
            />
          ) : (
            <p className="text-sm text-ink-3">Search runs when you press search. Picking a result saves it to your products.</p>
          )}
          <button type="button" className="self-start text-sm font-semibold underline" onClick={() => setMode("form")}>
            Enter it myself instead
          </button>
        </div>
      </FlowScreen>
    );
  }

  return (
    <ProductForm
      barcode={barcode}
      addSlot={slot}
      onCancel={cancel}
      onSaved={async (p, add) => {
        if (!add || !p.id) {
          toast.show({ message: `Saved ${p.name}` });
          router.push("/library/products");
          return;
        }
        const grams = p.servingGrams ?? 100;
        const res = await logExistingProductAction(
          { date: localToday(), slot, productId: p.id, grams },
          { eaten: true },
        );
        if (!res.ok) {
          toast.show({ message: res.error, tone: "error" });
          router.push("/library/products");
          return;
        }
        const kcal = ((p.per100g.kcal ?? 0) * grams) / 100;
        toast.undoable({
          message: `Added to ${SLOT_LABELS[slot]} · ${fmtKcal(kcal)} kcal`,
          commit: () => {},
          undo: () => void removeEntriesAction([res.id]),
        });
        router.push("/today");
      }}
    />
  );
}
