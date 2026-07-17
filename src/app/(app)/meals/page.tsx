import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { FoodTabs } from "@/components/food-tabs";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const userId = await requireUserId();
  const { q, tag } = await searchParams;

  const [tags, meals] = await Promise.all([
    prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.meal.findMany({
      where: {
        userId,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        ...(tag ? { tags: { some: { tagId: tag } } } : {}),
      },
      include: {
        tags: { include: { tag: true } },
        _count: { select: { ingredients: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Food"
        description="Your saved meals and recipes."
        action={
          <Link
            href="/meals/new"
            className={cn(buttonVariants(), "hidden sm:inline-flex")}
          >
            <Plus /> New meal
          </Link>
        }
      />
      <FoodTabs active="meals" />

      <form action="/meals" className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search meals…"
            className="pl-9"
          />
        </div>
        {tag && <input type="hidden" name="tag" value={tag} />}
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip href={buildHref(q, undefined)} active={!tag}>
            All
          </FilterChip>
          {tags.map((t) => (
            <FilterChip
              key={t.id}
              href={buildHref(q, tag === t.id ? undefined : t.id)}
              active={tag === t.id}
              color={t.color}
            >
              {t.name}
            </FilterChip>
          ))}
        </div>
      )}

      <Link href="/meals/new" className="mb-4 block sm:hidden">
        <Button className="w-full">
          <Plus /> New meal
        </Button>
      </Link>

      {meals.length === 0 ? (
        <EmptyState
          title="No meals yet"
          description={
            q || tag
              ? "No meals match your filters."
              : "Create your first meal to start planning."
          }
          action={
            <Link href="/meals/new">
              <Button>
                <Plus /> New meal
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {meals.map((meal) => (
            <Link key={meal.id} href={`/meals/${meal.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-tight">{meal.name}</p>
                    {meal.kcal != null && (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {Math.round(meal.kcal)} kcal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {meal._count.ingredients} ingredient
                    {meal._count.ingredients === 1 ? "" : "s"}
                  </p>
                  {meal.tags.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-1">
                      {meal.tags.map(({ tag: t }) => (
                        <Badge
                          key={t.id}
                          style={{
                            backgroundColor: (t.color ?? "#64748b") + "22",
                            borderColor: "transparent",
                            color: t.color ?? "#64748b",
                          }}
                        >
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function buildHref(q: string | undefined, tag: string | undefined) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  const qs = params.toString();
  return qs ? `/meals?${qs}` : "/meals";
}

function FilterChip({
  href,
  active,
  color,
  children,
}: {
  href: string;
  active: boolean;
  color?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
      style={active && color ? { backgroundColor: color } : undefined}
    >
      {children}
    </Link>
  );
}
