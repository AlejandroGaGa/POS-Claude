import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { Customer, phoneKey } from "@/lib/models/Customer";
import { Sale } from "@/lib/models/Sale";
import { can } from "@/lib/roles";
import { CustomerInput, parse } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "Cliente no encontrado.");
  const c = await Customer.findById(id);
  if (!c) throw new HttpError(404, "Cliente no encontrado.");
  return c;
}

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApi("customers:manage");
  const data = parse(CustomerInput, await req.json());
  await connectDB();
  const c = await load((await params).id);
  const touchesCredit = (data.preferential !== undefined && data.preferential !== c.preferential) || (data.creditLimit !== undefined && data.creditLimit !== c.creditLimit);
  if (touchesCredit && !can(user.role, "customers:credit")) throw new HttpError(403, "Solo el encargado o el administrador autorizan clientes preferenciales.");
  const key = phoneKey(data.phone);
  if (key.length >= 7 && (await Customer.exists({ _id: { $ne: c._id }, phoneKey: key, active: true }))) throw new HttpError(409, "Ya hay otro cliente con ese teléfono.");
  Object.assign(c, data, { phoneKey: key });
  await c.save();
  // Mantiene el nombre visible en sus notas vigentes.
  await Sale.updateMany({ customer: c._id, kind: "cotizacion", status: "vigente" }, { customerName: c.name });
  return NextResponse.json({ customer: c });
});

/** Baja lógica: el historial de ventas se conserva. */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApi("customers:manage");
  if (!can(user.role, "customers:credit")) throw new HttpError(403, "Solo el encargado o el administrador dan de baja clientes.");
  await connectDB();
  const c = await load((await params).id);
  const owes = await Sale.exists({ customer: c._id, kind: "venta", status: { $ne: "cancelada" }, balance: { $gt: 0 } });
  if (owes) throw new HttpError(409, "No se puede dar de baja: tiene saldo pendiente.");
  c.active = false;
  await c.save();
  return NextResponse.json({ ok: true });
});
