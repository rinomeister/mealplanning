import { z } from "zod";

export const SLOTS = [
  "BREAKFAST",
  "SNACK_1",
  "LUNCH",
  "SNACK_2",
  "DINNER",
] as const;
export type SlotKey = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<SlotKey, string> = {
  BREAKFAST: "Breakfast",
  SNACK_1: "Snack #1",
  LUNCH: "Lunch",
  SNACK_2: "Snack #2",
  DINNER: "Dinner",
};

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters"),
});

// Normalize a comma decimal separator ("1,5") to a dot before coercion, so
// locale keyboards that emit a comma still parse correctly.
const normalizeDecimal = (v: unknown) =>
  typeof v === "string" ? v.replace(",", ".") : v;

const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = typeof v === "number" ? v : Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  qty: optionalNumber,
  unit: z.string().trim().max(24).optional().transform((v) => v || null),
  note: z.string().trim().max(160).optional().transform((v) => v || null),
  // Present only for scanned ingredients. Macros are per 100 g/ml.
  barcode: z.string().trim().max(32).nullish().transform((v) => v || null),
  kcal: optionalNumber,
  protein: optionalNumber,
  fat: optionalNumber,
  carbs: optionalNumber,
  sugar: optionalNumber,
  fiber: optionalNumber,
});

export const mealSchema = z.object({
  name: z.string().trim().min(1, "Meal name is required").max(120),
  prepSteps: z.string().trim().max(8000).optional().transform((v) => v || null),
  servingLabel: z.string().trim().max(60).optional().transform((v) => v || null),
  serves: z
    .preprocess(normalizeDecimal, z.coerce.number().positive().max(100))
    .default(1),
  macrosManual: z.boolean().default(false),
  kcal: optionalNumber,
  protein: optionalNumber,
  fat: optionalNumber,
  carbs: optionalNumber,
  sugar: optionalNumber,
  fiber: optionalNumber,
  ingredients: z.array(ingredientSchema).max(100).default([]),
  tagIds: z.array(z.string()).default([]),
});

export type MealInput = z.infer<typeof mealSchema>;
export type MealInputRaw = z.input<typeof mealSchema>;

export const tagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().max(16).optional(),
});

export const planEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  slot: z.enum(SLOTS),
  mealId: z.string().min(1),
  servings: z
    .preprocess(normalizeDecimal, z.coerce.number().positive().max(100))
    .default(1),
});

// A scanned product, macros stored per 100 g/ml. Backs the "edit macros" form.
export const productMacrosSchema = z.object({
  barcode: z.string().regex(/^\d{6,14}$/, "Invalid barcode"),
  name: z.string().trim().min(1, "Name is required").max(200),
  brand: z.string().trim().max(120).nullish().transform((v) => v || null),
  servingLabel: z.string().trim().max(60).nullish().transform((v) => v || null),
  servingGrams: optionalNumber,
  kcal: optionalNumber,
  protein: optionalNumber,
  fat: optionalNumber,
  carbs: optionalNumber,
  sugar: optionalNumber,
  fiber: optionalNumber,
});

export type ProductMacrosInput = z.infer<typeof productMacrosSchema>;
export type ProductMacrosInputRaw = z.input<typeof productMacrosSchema>;

// Logging a scanned product into a day+slot: the product payload plus where and
// how much (grams) was eaten.
export const logProductSchema = productMacrosSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  slot: z.enum(SLOTS),
  grams: z.preprocess(normalizeDecimal, z.coerce.number().positive().max(100000)),
});

export type LogProductInputRaw = z.input<typeof logProductSchema>;

// A hand-entered product: same shape as a scanned one minus the barcode, for
// food that never had a scannable package (butcher's meat, loose produce).
export const manualProductSchema = productMacrosSchema.omit({ barcode: true });

export type ManualProductInput = z.infer<typeof manualProductSchema>;
export type ManualProductInputRaw = z.input<typeof manualProductSchema>;

/** Editing an existing product in place, by id rather than by barcode. */
export const editProductSchema = manualProductSchema.extend({
  id: z.string().min(1),
});

export type EditProductInputRaw = z.input<typeof editProductSchema>;

// Logging a product we already hold: no macro payload, just which one and how
// much. Macros are read from the row server-side.
export const logExistingProductSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  slot: z.enum(SLOTS),
  productId: z.string().min(1),
  grams: z.preprocess(normalizeDecimal, z.coerce.number().positive().max(100000)),
});

export type LogExistingProductInputRaw = z.input<typeof logExistingProductSchema>;

// Turn everything logged in a day+slot into a reusable meal.
export const createMealFromSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  slot: z.enum(SLOTS),
  name: z.string().trim().min(1, "Meal name is required").max(120),
});

export type CreateMealFromSlotInput = z.input<typeof createMealFromSlotSchema>;

// Copy one day's slot into another day's same slot.
export const copySlotSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  slot: z.enum(SLOTS),
});

export type CopySlotInput = z.input<typeof copySlotSchema>;

export const bodyweightSchema = z.object({
  weightKg: z.preprocess(normalizeDecimal, z.coerce.number().positive().max(700)),
  recordedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().trim().max(160).optional().transform((v) => v || null),
});

export const profileSchema = z.object({
  name: z.string().trim().max(80).optional().transform((v) => v || null),
  heightCm: optionalNumber,
  targetKcal: optionalNumber,
  targetProtein: optionalNumber,
  targetFat: optionalNumber,
  targetCarbs: optionalNumber,
  targetSugar: optionalNumber,
  targetFiber: optionalNumber,
  units: z.enum(["METRIC", "IMPERIAL"]).default("METRIC"),
});
