import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { PriceLog } from "@/lib/models/PriceLog";
import { ProductInput, parse } from "@/lib/validation";
import { priceChanges } from "@/lib/priceDiff";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "Producto no encontrado.");
  await connectDB();
  const p = await Product.findById(id);
  if (!p) throw new HttpError(404, "Producto no encontrado.");
  return p;
}

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await requireApi("products:view");
  const p = await load((await params).id);
  return NextResponse.json({ product: p });
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApi("products:edit");
  const data = parse(ProductInput, await req.json());
  const p = await load((await params).id);
  const changes = priceChanges(p.toObject() as Record<string, unknown>, data);
  p.set(data);
  await p.save();
  if (changes.length) {
    await PriceLog.create({ product: p._id, productCode: p.code, productName: p.name, user: user.id, userName: user.name, source: "edicion", changes });
  }
  return NextResponse.json({ product: p });
});

/** Baja lógica: se oculta del mostrador pero se conserva en las ventas pasadas. */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await requireApi("products:edit");
  const p = await load((await params).id);
  p.active = false;
  await p.save();
  return NextResponse.json({ ok: true });
});
