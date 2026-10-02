import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { addPayment } from "@/lib/sales";
import { PaymentInput, parse } from "@/lib/validation";

/** Abono a una venta con saldo pendiente. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApi("sales:create");
  const data = parse(PaymentInput, await req.json());
  await connectDB();
  const { sale } = await addPayment(user, (await params).id, data);
  return NextResponse.json({ ok: true, balance: sale.balance, total: sale.total });
});
