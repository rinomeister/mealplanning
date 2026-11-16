import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { searchOff } from "@/lib/barcode";

export const dynamic = "force-dynamic";

/** GET /api/products/search?q=skyr — Open Food Facts name search (signed in only). */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 100) {
    return NextResponse.json(
      { ok: false, error: "Type at least 2 characters." },
      { status: 400 },
    );
  }

  return NextResponse.json(await searchOff(q));
}
