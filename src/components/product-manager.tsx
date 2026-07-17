"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, ScanBarcode, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EMPTY_DRAFT,
  ProductFields,
  draftFrom,
  draftToInput,
  type ProductDraft,
} from "@/components/product-fields";
import { hasAnyMacro, type MealMacros } from "@/lib/macros";
import {
  createProductAction,
  deleteProductAction,
  updateProductAction,
} from "@/app/(app)/products/actions";

export type ManagedProduct = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingGrams: number | null;
  per100g: MealMacros;
};

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={product ? "Edit product" : "New product"}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)] shadow-lg sm:max-w-md sm:rounded-2xl sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
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
      </div>
    </div>
  );
}

export function NewProductButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" className={className} onClick={() => setOpen(true)}>
        <Plus /> New product
      </Button>
      {open && <ProductDialog product={null} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ProductCard({ product }: { product: ManagedProduct }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`Delete “${product.name}”?`)) return;
    startTransition(async () => {
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
