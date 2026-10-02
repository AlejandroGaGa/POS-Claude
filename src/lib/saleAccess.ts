import "server-only";
import { Types } from "mongoose";
import { notFound, redirect } from "next/navigation";
import { Sale } from "./models/Sale";
import { can } from "./roles";
import type { SessionUser } from "./session";
import { HttpError } from "./errors";

/** Carga una venta/cotización respetando permisos: el vendedor solo ve sus ventas (las cotizaciones las ven todos). */
export async function loadSaleFor(user: SessionUser, id: string) {
  if (!Types.ObjectId.isValid(id)) notFound();
  const sale = await Sale.findById(id).lean();
  if (!sale) notFound();
  if (sale.kind === "venta" && !can(user.role, "sales:viewAll") && String(sale.seller) !== user.id) redirect("/sin-permiso");
  return sale;
}

/** Igual que loadSaleFor, para rutas de API (lanza HttpError en vez de redirigir). */
export async function loadSaleForApi(user: SessionUser, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "No encontrado.");
  const sale = await Sale.findById(id).lean();
  if (!sale) throw new HttpError(404, "No encontrado.");
  if (sale.kind === "venta" && !can(user.role, "sales:viewAll") && String(sale.seller) !== user.id) throw new HttpError(403, "No tienes permiso para ver esta venta.");
  return sale;
}
