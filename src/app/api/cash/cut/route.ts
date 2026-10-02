import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { CashCut, CashMovement } from "@/lib/models/Cash";
import { nextCutFolio } from "@/lib/models/Counter";
import { periodSummary } from "@/lib/cash";
import { round2 } from "@/lib/pricing";
import { CashCutInput, parse } from "@/lib/validation";

const Body = CashCutInput.extend({ withdrawTo: z.enum(["fuera", "chica"]).optional().default("fuera") });

/** Vista previa del corte actual (lo que debería haber en caja). */
export const GET = handle(async () => {
  await requireApi("cash:cut");
  await connectDB();
  return NextResponse.json(await periodSummary());
});

/**
 * Hace el corte: guarda lo esperado contra lo contado. Lo que no se retira queda como fondo
 * del siguiente periodo; el retiro puede pasar a la caja chica.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApi("cash:cut");
  const { counted, withdrawn, notes, withdrawTo } = parse(Body, await req.json());
  if (withdrawn > counted + 0.005) throw new HttpError(400, "No puedes retirar más de lo contado.");
  await connectDB();
  const sum = await periodSummary(new Date());
  const cut = await CashCut.create({
    folio: await nextCutFolio(),
    from: sum.from,
    to: sum.to,
    openingFloat: sum.openingFloat,
    cashSales: sum.cashSales,
    cashPayments: sum.cashPayments,
    entries: sum.entries,
    exits: sum.exits,
    expected: sum.expected,
    counted: round2(counted),
    difference: round2(counted - sum.expected),
    withdrawn: round2(withdrawn),
    leftFloat: round2(counted - withdrawn),
    byMethod: sum.byMethod,
    commissions: sum.commissions,
    salesCount: sum.salesCount,
    notes,
    user: user.id,
    userName: user.name,
  });
  if (withdrawn > 0 && withdrawTo === "chica") {
    // Se registra después del corte para que no cuente en el periodo cerrado.
    await CashMovement.create({ box: "chica", type: "entrada", concept: "Traspaso", amount: round2(withdrawn), description: `Retiro del corte ${cut.folio}`, user: user.id, userName: user.name });
  }
  return NextResponse.json({ id: String(cut._id), folio: cut.folio }, { status: 201 });
});
