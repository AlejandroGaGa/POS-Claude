import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { createSale } from "@/lib/sales";
import { SaleInput, parse } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const user = await requireApi("sales:create");
  const data = parse(SaleInput, await req.json());
  await connectDB();
  const sale = await createSale(user, data);
  return NextResponse.json({ id: String(sale._id), folio: sale.folio }, { status: 201 });
});
