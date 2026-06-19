function fmtNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toString();
}

export function formatQtyUnit(
  qty: number | null,
  unit: string | null,
): string {
  if (qty == null && !unit) return "";
  if (qty == null) return unit ?? "";
  if (!unit) return fmtNumber(qty);
  return `${fmtNumber(qty)} ${unit}`;
}

export function formatIngredientLine(ing: {
  qty: number | null;
  unit: string | null;
  name: string;
  note?: string | null;
}): string {
  const qu = formatQtyUnit(ing.qty, ing.unit);
  const base = qu ? `${qu} ${ing.name}` : ing.name;
  return ing.note ? `${base} (${ing.note})` : base;
}
