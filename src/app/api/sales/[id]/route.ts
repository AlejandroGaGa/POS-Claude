import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { updateQuote } from "@/lib/sales";
import { QuoteUpdateInput, parse } from "@/lib/validation";

/** Edita los productos y datos de una cotización vigente (cualquier vendedor puede retomarla). */
export const PUT = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApi("sales:create");
  const data = parse(QuoteUpdateInput, await req.json());
  await connectDB();
  const { quote, keptPrices, repriced } = await updateQuote(user, (await params).id, data);
  return NextResponse.json({ id: String(quote._id), folio: quote.folio, total: quote.total, keptPrices, repriced });
});
