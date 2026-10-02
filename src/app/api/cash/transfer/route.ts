import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { CashMovement } from "@/lib/models/Cash";
import { boxBalance, periodSummary } from "@/lib/cash";
import { CashTransferInput, parse } from "@/lib/validation";

/** Pasa efectivo entre la caja de mostrador y la caja chica (dos movimientos ligados). */
export const POST = handle(async (req: Request) => {
  const user = await requireApi("cash:move");
  const { from, amount, description } = parse(CashTransferInput, await req.json());
  await connectDB();
  const available = from === "chica" ? await boxBalance("chica") : (await periodSummary()).expected;
  if (amount > available + 0.005) throw new HttpError(400, `Solo hay $${available.toFixed(2)} en ${from === "chica" ? "caja chica" : "la caja de mostrador"}.`);
  const to = from === "caja" ? "chica" : "caja";
  const pairId = randomUUID();
  const base = { concept: "Traspaso", amount, description, user: user.id, userName: user.name, pairId };
  await CashMovement.create([
    { ...base, box: from, type: "salida", description: description || `A ${to === "chica" ? "caja chica" : "caja de mostrador"}` },
    { ...base, box: to, type: "entrada", description: description || `De ${from === "chica" ? "caja chica" : "caja de mostrador"}` },
  ]);
  return NextResponse.json({ ok: true }, { status: 201 });
});
