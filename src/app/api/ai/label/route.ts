import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { GeminiError, geminiImageJson, takeDailyAllowance } from "@/lib/gemini";
import type { LabelScanResult } from "@/lib/label-scan";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024;
const DAILY_LIMIT = 40;

const PROMPT = `You read nutrition labels from food packaging photos. The label may be in Croatian, English, German, Italian or another language
(e.g. "Energetska vrijednost" = energy, "Bjelančevine"/"Proteini" = protein, "Ugljikohidrati" = carbohydrate, "od kojih šećeri" = of which sugars,
"Masti" = fat, "Vlakna" = fibre).

Copy the numbers exactly as printed. Do not estimate or invent values; use null for anything not visible or not legible.
- Prefer the "per 100 g" or "per 100 ml" column. Set basis to "100g" or "100ml" accordingly.
- Only if the label has no per-100 column, use the per-serving/per-portion column and set basis to "serving".
- kcal: the kilocalorie value. kj: the kilojoule value. Fill both if both are printed.
- sugar = "of which sugars"; fat = total fat (not saturates); carbs = total carbohydrate.
- servingGrams: the weight in g (or ml) of one serving/portion if the label states it, else null.
- name and brand: only if clearly visible in the photo, else null.
- readable: false if the photo shows no nutrition table or it is too blurry to read.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    readable: { type: "BOOLEAN" },
    basis: { type: "STRING", enum: ["100g", "100ml", "serving"] },
    kcal: { type: "NUMBER", nullable: true },
    kj: { type: "NUMBER", nullable: true },
    protein: { type: "NUMBER", nullable: true },
    carbs: { type: "NUMBER", nullable: true },
    sugar: { type: "NUMBER", nullable: true },
    fat: { type: "NUMBER", nullable: true },
    fiber: { type: "NUMBER", nullable: true },
    servingGrams: { type: "NUMBER", nullable: true },
    name: { type: "STRING", nullable: true },
    brand: { type: "STRING", nullable: true },
  },
  required: ["readable", "basis", "kcal", "kj", "protein", "carbs", "sugar", "fat", "fiber", "servingGrams", "name", "brand"],
};

const amount = z.number().finite().min(0).max(5000).nullable().catch(null);
const Reply = z.object({
  readable: z.boolean(),
  basis: z.enum(["100g", "100ml", "serving"]).catch("100g"),
  kcal: amount,
  kj: amount,
  protein: amount,
  carbs: amount,
  sugar: amount,
  fat: amount,
  fiber: amount,
  servingGrams: amount,
  name: z.string().trim().max(120).nullable().catch(null),
  brand: z.string().trim().max(80).nullable().catch(null),
});

const fail = (error: string, status: number) => NextResponse.json<LabelScanResult>({ ok: false, error }, { status });

/** POST /api/ai/label — multipart "image" of a nutrition label → its numbers. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Not signed in.", 401);

  let image: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("image");
    image = f instanceof File ? f : null;
  } catch {
    // fall through
  }
  if (!image || !image.type.startsWith("image/")) return fail("No photo received.", 400);
  if (image.size > MAX_BYTES) return fail("That photo is too large.", 413);

  if (!takeDailyAllowance(userId, DAILY_LIMIT)) {
    return fail("That's enough label scans for today. Type the numbers in instead.", 429);
  }

  try {
    const raw = await geminiImageJson({
      prompt: PROMPT,
      image: { mimeType: image.type, base64: Buffer.from(await image.arrayBuffer()).toString("base64") },
      schema: SCHEMA,
    });
    const parsed = Reply.safeParse(raw);
    if (!parsed.success) return fail("Couldn't read that label. Try another photo.", 502);
    const r = parsed.data;

    const kcal = r.kcal ?? (r.kj != null ? Math.round(r.kj / 4.184) : null);
    if (!r.readable || (kcal == null && r.protein == null && r.carbs == null && r.fat == null)) {
      return fail("Couldn't find a nutrition table. Get closer, avoid glare and try again.", 422);
    }
    return NextResponse.json<LabelScanResult>({
      ok: true,
      basis: r.basis,
      kcal,
      protein: r.protein,
      carbs: r.carbs,
      sugar: r.sugar,
      fat: r.fat,
      fiber: r.fiber,
      servingGrams: r.servingGrams,
      name: r.name || null,
      brand: r.brand || null,
    });
  } catch (e) {
    if (e instanceof GeminiError) {
      if (e.kind === "config") return fail("Label scanning isn't set up yet (no Gemini API key).", 503);
      if (e.kind === "quota") return fail("The free AI limit is used up for now. Try again later or type the numbers in.", 429);
    }
    console.error("Label scan failed", e);
    return fail("Couldn't read the label right now. Try again in a moment.", 502);
  }
}
