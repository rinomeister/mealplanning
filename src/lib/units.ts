export type UnitSystem = "METRIC" | "IMPERIAL";

const LB_PER_KG = 2.2046226218;

export function weightLabel(units: UnitSystem): string {
  return units === "IMPERIAL" ? "lb" : "kg";
}

/** Convert stored kg to the user's display unit. */
export function kgToDisplay(kg: number, units: UnitSystem): number {
  const v = units === "IMPERIAL" ? kg * LB_PER_KG : kg;
  return Math.round(v * 10) / 10;
}

/** Convert a value entered in the user's display unit back to kg for storage. */
export function displayToKg(value: number, units: UnitSystem): number {
  const kg = units === "IMPERIAL" ? value / LB_PER_KG : value;
  return Math.round(kg * 1000) / 1000;
}
