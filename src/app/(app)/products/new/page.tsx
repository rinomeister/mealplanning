import { requireUserId } from "@/lib/auth-helpers";
import { userNow } from "@/lib/user-time";
import { parseSlot } from "@/lib/add-flow";
import { ProductNew } from "@/components/product/product-new";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ via?: string; barcode?: string; slot?: string }>;
}) {
  await requireUserId();
  const sp = await searchParams;
  const now = await userNow();
  const via = sp.via === "scan" || sp.via === "online" ? sp.via : null;
  const barcode = sp.barcode && /^\d{6,14}$/.test(sp.barcode) ? sp.barcode : null;
  return <ProductNew via={via} barcode={barcode} slot={parseSlot(sp.slot ?? null) ?? now.slot} />;
}
