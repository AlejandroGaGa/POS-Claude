import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { createReturn } from "@/lib/returnsService";
import { ReturnInput, parse } from "@/lib/validation";

/** Registra una devolución o cambio. */
export const POST = handle(async (req: Request) => {
  const user = await requireApi("returns:create");
  const data = parse(ReturnInput, await req.json());
  await connectDB();
  const r = await createReturn(user, data);
  return NextResponse.json({ id: String(r._id), folio: r.folio, outcome: r.outcome, refund: r.refundAmount, charge: r.chargeAmount }, { status: 201 });
});
