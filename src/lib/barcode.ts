import type { MealMacros } from "@/lib/macros";

/**
 * Result of a barcode -> nutrition lookup. Discriminated on `found`, mirroring
 * the app's server-action result style. Macros use the shared `MealMacros`
 * shape (nullable fields) so scanned data drops straight into meal forms later.
 */
export type BarcodeLookupResult =
  | {
      found: true;
      code: string;
      name: string;
      brand: string | null;
      /** Free-text serving size from the product label, e.g. "30 g". */
      servingLabel: string | null;
      per100g: MealMacros;
      /** Present only when the source provides per-serving values. */
      perServing: MealMacros | null;
      source: "openfoodfacts";
    }
  | { found: false; code: string; error?: string };

// Open Food Facts requests a descriptive User-Agent identifying the app.
const USER_AGENT = "MealPlanning/0.1 (barcode nutrition lookup)";

type OffNutriments = Record<string, number | string | undefined>;

/** Coerce an Open Food Facts nutriment value to a number, or null if absent. */
function num(nutriments: OffNutriments, key: string): number | null {
  const v = nutriments[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function macrosFrom(nutriments: OffNutriments, suffix: string): MealMacros {
  return {
    kcal: num(nutriments, `energy-kcal${suffix}`),
    protein: num(nutriments, `proteins${suffix}`),
    fat: num(nutriments, `fat${suffix}`),
    carbs: num(nutriments, `carbohydrates${suffix}`),
  };
}

/** True when at least one macro field has a value. */
function hasAnyMacro(m: MealMacros): boolean {
  return m.kcal != null || m.protein != null || m.fat != null || m.carbs != null;
}

/**
 * Look up a barcode against Open Food Facts and map it to macros. Runs
 * server-side (route handler) so it stays swappable and avoids CORS. Never
 * throws — network/parse failures return `{ found: false, error }`.
 */
export async function lookupBarcode(code: string): Promise<BarcodeLookupResult> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json` +
    `?fields=product_name,brands,serving_size,nutriments`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Cache repeat scans of the same product for a day.
      next: { revalidate: 86400 },
    });
  } catch {
    return { found: false, code, error: "Could not reach the food database." };
  }

  if (res.status === 404) return { found: false, code };
  if (!res.ok) {
    return { found: false, code, error: `Food database error (${res.status}).` };
  }

  let data: {
    status?: number;
    product?: {
      product_name?: string;
      brands?: string;
      serving_size?: string;
      nutriments?: OffNutriments;
    };
  };
  try {
    data = await res.json();
  } catch {
    return { found: false, code, error: "Malformed response from food database." };
  }

  // OFF returns status 0 (or no product) when the barcode is unknown.
  if (data.status === 0 || !data.product) return { found: false, code };

  const nutriments = data.product.nutriments ?? {};
  const per100g = macrosFrom(nutriments, "_100g");
  const perServing = macrosFrom(nutriments, "_serving");

  const name = data.product.product_name?.trim();
  // No name and no macros means there's nothing useful to show.
  if (!name && !hasAnyMacro(per100g)) return { found: false, code };

  return {
    found: true,
    code,
    name: name || "Unnamed product",
    brand: data.product.brands?.trim() || null,
    servingLabel: data.product.serving_size?.trim() || null,
    per100g,
    perServing: hasAnyMacro(perServing) ? perServing : null,
    source: "openfoodfacts",
  };
}
