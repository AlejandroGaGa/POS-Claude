import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { CashMovement } from "@/lib/models/Cash";
import { boxBalance } from "@/lib/cash";
import { CashMovementInput, parse } from "@/lib/validation";

/** Registra una entrada o salida de efectivo (caja de mostrador o caja chica). */
export const POST = handle(async (req: Request) => {
  const user = await requireApi("cash:move");
  const data = parse(CashMovementInput, await req.json());
  await connectDB();
  if (data.box === "chica" && data.type === "salida") {
    const bal = await boxBalance("chica");
    if (data.amount > bal + 0.005) throw new HttpError(400, `En caja chica solo hay $${bal.toFixed(2)}.`);
  }
  const m = await CashMovement.create({ ...data, user: user.id, userName: user.name });
  return NextResponse.json({ movement: m }, { status: 201 });
});
