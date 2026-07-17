import { NextResponse } from "next/server";
import { lookupBarcode, productRowToResult } from "@/lib/barcode";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/barcode/[code]">,
) {
  const { code } = await ctx.params;

  // Retail barcodes (EAN/UPC) are all digits; reject anything else early.
  if (!/^\d{6,14}$/.test(code)) {
    return NextResponse.json(
      { found: false, code, error: "Invalid barcode." },
      { status: 400 },
    );
  }

  // Our own database wins: a product cached here may carry user-corrected macros
  // that OFF doesn't have. Fall back to Open Food Facts only when unknown.
  const existing = await prisma.product.findUnique({ where: { barcode: code } });
  if (existing) {
    // `barcode` is nullable on the model (hand-entered foods have none), but we
    // matched on it here, so it's this exact code.
    return NextResponse.json(productRowToResult({ ...existing, barcode: code }));
  }

  const result = await lookupBarcode(code);
  return NextResponse.json(result);
}
