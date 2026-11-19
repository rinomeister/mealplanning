import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { loadAisles } from "@/lib/shopping-list";
import { AddListItem } from "@/components/plan/add-list-item";

export default async function AddListItemPage() {
  const userId = await requireUserId();
  const [aisles, products] = await Promise.all([
    loadAisles(userId),
    prisma.product.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 2000 }),
  ]);
  return <AddListItem aisles={aisles} productNames={products.map((p) => p.name)} />;
}
