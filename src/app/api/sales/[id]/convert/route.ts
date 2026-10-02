import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { convertQuote } from "@/lib/sales";
import { ConvertInput, parse } from "@/lib/validation";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApi("sales:create");
  const data = parse(ConvertInput, await req.json());
  await connectDB();
  const { sale, repriced } = await convertQuote(user, (await params).id, data);
  return NextResponse.json({ id: String(sale._id), folio: sale.folio, repriced }, { status: 201 });
});
