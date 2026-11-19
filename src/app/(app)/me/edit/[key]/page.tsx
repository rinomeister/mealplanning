import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { PROFILE_FIELDS, type ProfileField } from "@/lib/profile-fields";
import { EditField, type FieldValues } from "@/components/me/edit-field";

const s = (n: number | null | undefined) => (n == null ? "" : String(n));

export default async function EditFieldPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(key in PROFILE_FIELDS)) notFound();
  const userId = await requireUserId();
  const [u, weight] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.bodyweightLog.findFirst({ where: { userId }, orderBy: { recordedAt: "desc" }, select: { weightKg: true } }),
  ]);
  const values: FieldValues = {
    kcal: s(u.targetKcal),
    protein: s(u.targetProtein),
    carbs: s(u.targetCarbs),
    fat: s(u.targetFat),
    sugar: s(u.targetSugar),
    fiber: s(u.targetFiber),
    name: u.name ?? "",
    height: s(u.heightCm),
  };
  // key remounts the form when ⌃ ⌄ step to another field.
  return <EditField key={key} field={key as ProfileField} values={values} weightKg={weight?.weightKg ?? null} />;
}
