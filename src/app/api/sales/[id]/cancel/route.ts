import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { Sale } from "@/lib/models/Sale";
import { can } from "@/lib/roles";
import { parse } from "@/lib/validation";

const Body = z.object({ reason: z.string().trim().min(3, "Escribe el motivo de la cancelación").max(300) });

/**
 * Ventas: solo el administrador puede cancelar (afecta estadísticas).
 * Cotizaciones: las puede cancelar quien la hizo, o un encargado/admin.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApi("sales:create");
  const { reason } = parse(Body, await req.json());
  const id = (await params).id;
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "No encontrado.");
  await connectDB();
  const doc = await Sale.findById(id);
  if (!doc) throw new HttpError(404, "No encontrado.");
  if (doc.status !== "vigente") throw new HttpError(409, `Ya está ${doc.status}.`);
  const allowed =
    doc.kind === "venta" ? can(user.role, "sales:cancel") : can(user.role, "sales:viewAll") || String(doc.seller) === user.id;
  if (!allowed) throw new HttpError(403, "No tienes permiso para cancelar esto.");
  doc.status = "cancelada";
  doc.cancelledAt = new Date();
  doc.cancelledByName = user.name;
  doc.cancelReason = reason;
  await doc.save();
  return NextResponse.json({ ok: true });
});
