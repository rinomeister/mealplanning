import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { MealForm } from "@/components/meal-form";

export default async function NewMealPage() {
  const userId = await requireUserId();
  const tags = await prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });

  return (
    <>
      <PageHeader title="New meal" description="Add a meal to your library." />
      <MealForm tags={tags} />
    </>
  );
}
