import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PICKER_PRODUCT_SELECT, toPickerProduct } from "@/lib/products";
import { ProductEdit } from "@/components/product/product-edit";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUserId();
  const { id } = await params;
  const row = await prisma.product.findUnique({
    where: { id },
    select: { ...PICKER_PRODUCT_SELECT, servingLabel: true },
  });
  if (!row) notFound();
  const p = toPickerProduct(row);
  return <ProductEdit initial={{ ...p, servingLabel: row.servingLabel }} />;
}
