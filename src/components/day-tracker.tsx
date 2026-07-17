"use client";

import { useState } from "react";
import { ScanBarcode } from "lucide-react";
import {
  AddMealControl,
  type PickerMeal,
  type PickerTag,
} from "@/components/day-planner";
import { ScanProductDialog } from "@/components/scan-product-dialog";
import { logProductAction } from "@/app/(app)/track/actions";

/** Per-slot control: scan a product to log, or add a prebuilt meal. */
export function AddFoodControl({
  date,
  slot,
  slotLabel,
  meals,
  tags,
}: {
  date: string;
  slot: string;
  slotLabel: string;
  meals: PickerMeal[];
  tags: PickerTag[];
}) {
  const [scanOpen, setScanOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <ScanBarcode className="size-3.5" /> Scan product
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
    </div>
  );
}
