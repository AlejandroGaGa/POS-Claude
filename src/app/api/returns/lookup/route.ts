import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { searchSalesForReturn } from "@/lib/returnsService";

/** Busca la venta a devolver por folio (V-/C-/D-), cliente, teléfono o producto. */
export const GET = handle(async (req: Request) => {
  await requireApi("returns:create");
  await connectDB();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const { sales, hint } = await searchSalesForReturn(q.slice(0, 80));
  return NextResponse.json({ sales, hint });
});
