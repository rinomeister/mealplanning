import Link from "next/link";
import { CookingPot, ScanBarcode, Search, Zap } from "lucide-react";
import { flowHref } from "@/lib/add-flow";
import type { SlotKey } from "@/lib/schemas";

const TILE =
  "press flex h-[60px] flex-col items-center justify-center gap-1 rounded-[14px] bg-surface-2 text-[13px] font-semibold text-ink [&_svg]:size-5";

/**
 * The four ways into a slot, as tiles: scan a barcode, find a product, add a
 * saved meal, or quick-add bare macros. Each opens its full-screen flow.
 */
export function AddFoodTiles({ date, slot }: { date: string; slot: SlotKey }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <Link href={flowHref("scan", slot, date)} className={TILE}>
        <ScanBarcode /> Scan
      </Link>
      <Link href={flowHref("search", slot, date)} className={TILE}>
        <Search /> Product
      </Link>
      <Link href={flowHref("meal", slot, date)} className={TILE}>
        <CookingPot /> Meal
      </Link>
      <Link href={flowHref("quick", slot, date)} className={TILE}>
        <Zap /> Quick
      </Link>
    </div>
  );
}
