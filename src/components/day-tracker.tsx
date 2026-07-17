"use client";

import { useState } from "react";
import { Package, ScanBarcode } from "lucide-react";
import {
  AddMealControl,
  type PickerMeal,
  type PickerTag,
} from "@/components/day-planner";
import { ScanProductDialog } from "@/components/scan-product-dialog";
import {
  AddProductDialog,
  type PickerProduct,
} from "@/components/add-product-dialog";
import {
  logExistingProductAction,
  logProductAction,
} from "@/app/(app)/track/actions";

const BUTTON =
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-sm font-medium text-primary active:bg-muted";

/**
 * Per-slot control, three ways in: scan a barcode, pick/type a product (the
 * no-barcode path), or add a meal you've already built.
 */
export function AddFoodControl({
  date,
  slot,
  slotLabel,
  meals,
  tags,
  products,
}: {
  date: string;
  slot: string;
  slotLabel: string;
  meals: PickerMeal[];
  tags: PickerTag[];
  products: PickerProduct[];
}) {
  const [scanOpen, setScanOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className={BUTTON}
      >
        <ScanBarcode className="size-4" /> Scan product
      </button>
      <button
        type="button"
        onClick={() => setProductOpen(true)}
        className={BUTTON}
      >
        <Package className="size-4" /> Add product
      </button>
      <AddMealControl
        date={date}
        slot={slot}
        slotLabel={slotLabel}
        meals={meals}
        tags={tags}
      />
      {scanOpen && (
        <ScanProductDialog
          title={`Scan into ${slotLabel}`}
          confirmLabel={`Log to ${slotLabel}`}
          gramsLabel="How much did you eat? (grams)"
          onConfirm={async (p, grams) => {
            const res = await logProductAction({
              date,
              slot,
              barcode: p.barcode,
              name: p.name,
              brand: p.brand,
              servingLabel: p.servingLabel,
              servingGrams: p.servingGrams,
              kcal: p.per100g.kcal,
              protein: p.per100g.protein,
              fat: p.per100g.fat,
              carbs: p.per100g.carbs,
              sugar: p.per100g.sugar,
              fiber: p.per100g.fiber,
              grams,
            });
            return res.ok;
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
      {productOpen && (
        <AddProductDialog
          title={`Add to ${slotLabel}`}
          confirmLabel={`Log to ${slotLabel}`}
          products={products}
          onLog={async (productId, grams) => {
            const res = await logExistingProductAction({
              date,
              slot,
              productId,
              grams,
            });
            return res.ok;
          }}
          onClose={() => setProductOpen(false)}
        />
      )}
    </div>
  );
}
