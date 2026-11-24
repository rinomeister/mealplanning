/** Client side of the nutrition-label scan (POST /api/ai/label). */

export type LabelScanResult =
  | {
      ok: true;
      /** What the numbers are relative to. "serving" uses servingGrams (may be null: ask). */
      basis: "100g" | "100ml" | "serving";
      kcal: number | null;
      protein: number | null;
      carbs: number | null;
      sugar: number | null;
      fat: number | null;
      fiber: number | null;
      servingGrams: number | null;
      name: string | null;
      brand: string | null;
    }
  | { ok: false; error: string };

/**
 * Shrinks a camera photo to at most `maxSide` px as JPEG. Label text needs a
 * bit more resolution than a plate photo, hence the 1600 default. Falls back
 * to the original file if the browser can't decode it.
 */
export async function shrinkPhoto(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function scanLabel(file: File): Promise<LabelScanResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "You're offline. Label scanning needs a connection." };
  }
  const photo = await shrinkPhoto(file);
  const body = new FormData();
  body.append("image", photo, "label.jpg");
  try {
    const res = await fetch("/api/ai/label", { method: "POST", body });
    return (await res.json()) as LabelScanResult;
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check the connection and try again." };
  }
}
