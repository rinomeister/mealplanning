import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MacroSummary } from "@/components/macro-summary";
import { DeleteMealButton } from "@/components/delete-meal-button";
import { formatIngredientLine } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;

  const meal = await prisma.meal.findFirst({
    where: { id, userId },
    include: {
      ingredients: { orderBy: { position: "asc" } },
      tags: { include: { tag: true } },
    },
  });

  if (!meal) notFound();

  const hasMacros =
    meal.kcal != null ||
    meal.protein != null ||
    meal.fat != null ||
    meal.carbs != null;

  return (
    <>
      <PageHeader
        title={meal.name}
        description={meal.servingLabel ? `Per serving: ${meal.servingLabel}` : undefined}
        action={
          <Link
            href={`/meals/${meal.id}/edit`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Pencil /> Edit
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        {meal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {meal.tags.map(({ tag }) => (
              <Badge
                key={tag.id}
                style={{
                  backgroundColor: (tag.color ?? "#64748b") + "22",
                  borderColor: "transparent",
                  color: tag.color ?? "#64748b",
                }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {hasMacros && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Macros per serving</CardTitle>
            </CardHeader>
            <CardContent>
              <MacroSummary
                macros={{
                  kcal: meal.kcal ?? 0,
                  protein: meal.protein ?? 0,
                  fat: meal.fat ?? 0,
                  carbs: meal.carbs ?? 0,
                }}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            {meal.ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ingredients listed.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {meal.ingredients.map((ing) => (
                  <li key={ing.id} className="flex gap-2">
                    <span className="text-primary">•</span>
                    {formatIngredientLine(ing)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {meal.prepSteps && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preparation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {meal.prepSteps}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <DeleteMealButton id={meal.id} />
        </div>
      </div>
    </>
  );
}
