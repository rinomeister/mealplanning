"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteMessage } from "@/lib/format";
import { Globe, Loader2, Pencil, Plus, ScanBarcode, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ScanProductDialog } from "@/components/scan-product-dialog";
import { OffSearchDialog } from "@/components/off-search-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EMPTY_DRAFT,
  ProductFields,
  draftFrom,
  draftToInput,
  type ProductDraft,
} from "@/components/product-fields";
import { hasAnyMacro } from "@/lib/macros";
import type { PickerProduct } from "@/lib/products";
import { Modal } from "@/components/ui/modal";
import {
  createProductAction,
  deleteProductAction,
  importOffProductAction,
  productUpcomingCountAction,
  updateProductAction,
} from "@/app/(app)/products/actions";

export type ManagedProduct = PickerProduct;

/** Create (no `product`) or edit (with one) — the fields are identical. */
function ProductDialog({
  product,
  onClose,
}: {
  product: ManagedProduct | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(
    product ? draftFrom(product) : EMPTY_DRAFT,
  );
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    const input = draftToInput(draft);
    if (!input.name) {
      setMessage("Give it a name.");
      return;
    }
    startTransition(async () => {
      const res = product
        ? await updateProductAction({ ...input, id: product.id })
        : await createProductAction(input);
      if (res.ok) onClose();
      else setMessage(res.error);
    });
  }

  return (
    <Modal onClose={onClose} label={product ? "Edit product" : "New product"} className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <p className="text-sm font-semibold">
            {product ? "Edit product" : "New product"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {product?.barcode && (
            <p className="text-xs text-muted-foreground">
              Barcode {product.barcode} — your values replace the Open Food Facts
              ones for good.
            </p>
          )}
          <ProductFields draft={draft} onChange={setDraft} />
          {message && <p className="text-sm text-destructive">{message}</p>}
          <Button type="button" disabled={isPending} onClick={save}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </div>
      </Modal>
  );
}

/**
 * The three ways to add a product: type it in, scan its barcode, or search
 * Open Food Facts by name. Scans and search picks are saved by barcode.
 */
export function ProductAddActions({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "new" | "scan" | "search">(null);
  const close = () => setOpen(null);
  const btn =
    "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium active:bg-muted hover:bg-muted";

  return (
    <>
      <div className={cn("flex gap-2", className)}>
        <button type="button" className={cn(btn, "border-primary bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80")} onClick={() => setOpen("new")}>
          <Plus className="size-4" /> New
        </button>
        <button type="button" className={btn} onClick={() => setOpen("scan")}>
          <ScanBarcode className="size-4" /> Scan
        </button>
        <button type="button" className={btn} onClick={() => setOpen("search")}>
          <Globe className="size-4" /> Search online
        </button>
      </div>
      {open === "new" && <ProductDialog product={null} onClose={close} />}
      {open === "scan" && (
        <ScanProductDialog
          title="Scan a product"
          confirmLabel="Save to products"
          askGrams={false}
          onConfirm={async (p) => {
            const res = await importOffProductAction({
              barcode: p.barcode,
              name: p.name,
              brand: p.brand,
              servingLabel: p.servingLabel,
              servingGrams: p.servingGrams,
              ...p.per100g,
            });
            if (res.ok) router.refresh();
            return res.ok;
          }}
          onClose={close}
        />
      )}
      {open === "search" && (
        <OffSearchDialog
          title="Add from Open Food Facts"
          onPick={() => router.refresh()}
          onClose={close}
        />
      )}
    </>
  );
}

export function ProductCard({ product }: { product: ManagedProduct }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const upcoming = await productUpcomingCountAction(product.id);
      if (!confirm(deleteMessage(`“${product.name}”`, upcoming))) return;
      const res = await deleteProductAction(product.id);
      if (!res.ok) setError(res.error);
    });
  }

  const kcal = product.per100g.kcal;

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{product.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {product.brand && <span>{product.brand}</span>}
                {product.barcode && (
                  <span className="flex items-center gap-1">
                    <ScanBarcode className="size-3" /> Scanned
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {kcal != null ? `${Math.round(kcal)} kcal/100g` : "No macros"}
            </span>
          </div>

          {product.portions.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {product.portions.map((p) => `1 ${p.label} = ${p.grams} g`).join(" · ")}
            </p>
          )}

          {!hasAnyMacro(product.per100g) && (
            <p className="text-xs text-amber-600">
              No macros — anything logged with this won&apos;t count.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium active:bg-muted"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground active:bg-muted hover:text-destructive"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Delete
            </button>
          </div>
        </CardContent>
      </Card>
      {editing && (
        <ProductDialog product={product} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
