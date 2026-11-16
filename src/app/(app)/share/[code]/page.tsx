import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { MacroSummary } from "@/components/macro-summary";
import { EmptyState } from "@/components/empty-state";
import { ImportMealButton } from "@/components/import-meal-button";
import { fmtMacro, hasAnyMacro } from "@/lib/macros";
import { formatIngredientLine } from "@/lib/format";
import { formatShareCode, parseShareCode } from "@/lib/share";

/** Preview a shared meal before importing a copy of it. */
export default async function SharedMealPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const userId = await requireUserId();
  const { code: raw } = await params;
  const code = parseShareCode(decodeURIComponent(raw));
  if (code && code !== raw) redirect(`/share/${code}`);

  const share = code
    ? await prisma.mealShare.findUnique({
        where: { code },
        include: {
          meal: {
            include: {
              user: { select: { name: true } },
              ingredients: { orderBy: { position: "asc" } },
              tags: { include: { tag: { select: { name: true, color: true } } } },
            },
          },
        },
      })
    : null;

  if (!share) {
    return (
      <>
        <PageHeader title="Shared meal" />
        <EmptyState
          title="This code doesn't work"
          description="It may have been mistyped, or the owner stopped sharing. Ask them for a fresh code."
          action={
            <Link href="/share" className={buttonVariants({ variant: "outline" })}>
              Enter another code
            </Link>
          }
        />
      </>
    );
  }

  const meal = share.meal;
  const isOwner = meal.userId === userId;
  const sharer = meal.user.name?.trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title={meal.name}
        description={`${sharer ? `Shared by ${sharer}` : "Shared meal"} · code ${formatShareCode(share.code)}`}
      />

      <div className="flex flex-col gap-4">
        {isOwner ? (
          <p className="rounded-lg bg-muted p-3 text-sm">
            This is your meal — this is what people see when you share it.{" "}
            <Link href={`/meals/${meal.id}`} className="font-medium text-primary hover:underline">
              Back to it
            </Link>
          </p>
        ) : (
          <ImportMealButton code={share.code} />
        )}

        {meal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {meal.tags.map(({ tag }) => (
              <Badge
                key={tag.name}
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

        {hasAnyMacro(meal) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Macros per serving
                {meal.servingLabel ? ` (${meal.servingLabel})` : ""}
                {meal.serves > 1 ? ` · makes ${fmtMacro(meal.serves)}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <MacroSummary
                macros={{
                  kcal: meal.kcal ?? 0,
                  protein: meal.protein ?? 0,
                  fat: meal.fat ?? 0,
                  carbs: meal.carbs ?? 0,
                  sugar: meal.sugar ?? 0,
                  fiber: meal.fiber ?? 0,
                }}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ingredients</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
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
            <CardContent className="pt-0">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{meal.prepSteps}</p>
            </CardContent>
          </Card>
        )}

        {!isOwner && (
          <p className="text-center text-xs text-muted-foreground">
            Importing makes your own copy — edit it however you like.
          </p>
        )}
      </div>
    </>
  );
}
