import { NextResponse } from "next/server";
import { lookupBarcode } from "@/lib/barcode";

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

  const result = await lookupBarcode(code);
  return NextResponse.json(result);
}
