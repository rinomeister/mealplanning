"use client";

import { useState } from "react";
import { CookingPot, ScanBarcode, Search, Zap } from "lucide-react";
import { QuickAddDialog } from "@/components/quick-add-dialog";
import {
  MealPickerDialog,
  type MealPickerExtras,
  type PickerMeal,
  type PickerTag,
} from "@/components/day-planner";
import type { Usage } from "@/lib/usage";
import { ScanProductDialog } from "@/components/scan-product-dialog";
import {
  AddProductDialog,
  type PickerProduct,
} from "@/components/add-product-dialog";
import {
  logExistingProductAction,
  logProductAction,
} from "@/app/(app)/today/actions";

export type AddFoodData = {
  meals: PickerMeal[];
  tags: PickerTag[];
  products: PickerProduct[];
  productUsage?: Usage;
  mealUsage?: MealPickerExtras["usage"];
};

type Open = "scan" | "product" | "meal" | "quick" | null;

const TILE =
  "press flex h-[60px] flex-col items-center justify-center gap-1 rounded-[14px] bg-surface-2 text-[13px] font-semibold text-ink [&_svg]:size-5";

/**
 * The four ways into a slot, as tiles: scan a barcode, find a product, add a
 * saved meal, or quick-add bare macros. `eaten` logs straight to eaten (Today,
 * for today or earlier) rather than planned.
 */
export function AddFoodTiles({
  date,
  slot,
  slotLabel,
  eaten,
  data,
  slotCount,
}: {
  date: string;
  slot: string;
  slotLabel: string;
  eaten: boolean;
  data: AddFoodData;
  slotCount?: number;
}) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <button type="button" className={TILE} onClick={() => setOpen("scan")}>
          <ScanBarcode /> Scan
        </button>
        <button type="button" className={TILE} onClick={() => setOpen("product")}>
          <Search /> Product
        </button>
        <button type="button" className={TILE} onClick={() => setOpen("meal")}>
          <CookingPot /> Meal
        </button>
        <button type="button" className={TILE} onClick={() => setOpen("quick")}>
          <Zap /> Quick
        </button>
      </div>

      {open === "quick" && (
        <QuickAddDialog date={date} slot={slot} slotLabel={slotLabel} eaten={eaten} onClose={close} />
      )}
      {open === "meal" && (
        <MealPickerDialog
          date={date}
          slot={slot}
          slotLabel={slotLabel}
          meals={data.meals}
          tags={data.tags}
          usage={data.mealUsage}
          slotCount={slotCount}
          eaten={eaten}
          onClose={close}
        />
      )}
      {open === "scan" && (
        <ScanProductDialog
          title={`Scan into ${slotLabel}`}
          confirmLabel={`Add to ${slotLabel}`}
          gramsLabel="How much? (grams)"
          onConfirm={async (p, grams) => {
            const res = await logProductAction(
              {
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
              },
              { eaten },
            );
            return res.ok;
          }}
          onClose={close}
        />
      )}
      {open === "product" && (
        <AddProductDialog
          title={`Add to ${slotLabel}`}
          confirmLabel={`Add to ${slotLabel}`}
          products={data.products}
          usage={data.productUsage}
          onLog={async (productId, grams) => {
            const res = await logExistingProductAction(
              { date, slot, productId, grams },
              { eaten },
            );
            return res.ok;
          }}
          onClose={close}
        />
      )}
    </>
  );
}
