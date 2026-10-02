import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { Product, ProductRaw } from "@/lib/models/Product";
import { PriceLog } from "@/lib/models/PriceLog";
import { BulkAdjustInput, parse } from "@/lib/validation";
import { adjustPrice } from "@/lib/pricing";

/** Sube o baja precios por porcentaje (todo el catálogo o una categoría). */
export const POST = handle(async (req: Request) => {
  const user = await requireApi("products:edit");
  const { category, pct, roundTo, apply } = parse(BulkAdjustInput, await req.json());
  await connectDB();
  const filter: Record<string, unknown> = { active: true };
  if (category) filter.category = category;
  const products = await Product.find(filter).lean();

  const adj = (v: number | null | undefined) => (typeof v === "number" && v > 0 ? adjustPrice(v, pct, roundTo) : v ?? null);
  const plan = products.map((p) => {
    const next = {
      price: adj(p.price),
      pricePerMeter: adj(p.pricePerMeter),
      pricePerM2: adj(p.pricePerM2),
      pricePerM2Vidriero: adj(p.pricePerM2Vidriero),
      bars: (p.bars ?? []).map((b) => ({ lengthM: b.lengthM, price: adj(b.price) as number })),
      sheets: (p.sheets ?? []).map((s) => ({ widthM: s.widthM, heightM: s.heightM, price: adj(s.price) as number })),
    };
    const changes: { field: string; from: unknown; to: unknown }[] = [];
    if (next.price !== p.price) changes.push({ field: "Precio", from: p.price, to: next.price });
    if (next.pricePerMeter !== p.pricePerMeter) changes.push({ field: "Precio por metro", from: p.pricePerMeter, to: next.pricePerMeter });
    if (next.pricePerM2 !== p.pricePerM2) changes.push({ field: "Precio por m² particular", from: p.pricePerM2, to: next.pricePerM2 });
    if (next.pricePerM2Vidriero !== (p.pricePerM2Vidriero ?? null)) changes.push({ field: "Precio por m² vidriero", from: p.pricePerM2Vidriero, to: next.pricePerM2Vidriero });
    (p.bars ?? []).forEach((b, i) => {
      if (next.bars[i].price !== b.price) changes.push({ field: `Tira ${b.lengthM} m`, from: b.price, to: next.bars[i].price });
    });
    (p.sheets ?? []).forEach((s, i) => {
      if (next.sheets[i].price !== s.price) changes.push({ field: `Hoja ${s.widthM}×${s.heightM}`, from: s.price, to: next.sheets[i].price });
    });
    return { p, next, changes };
  });
  const affected = plan.filter((x) => x.changes.length);

  if (!apply) {
    return NextResponse.json({
      total: products.length,
      affected: affected.length,
      sample: affected.slice(0, 25).map((x) => ({ code: x.p.code, name: x.p.name, changes: x.changes })),
    });
  }
  if (affected.length) {
    await ProductRaw.bulkWrite(affected.map((x) => ({ updateOne: { filter: { _id: x.p._id }, update: { $set: x.next } } })));
    await PriceLog.insertMany(
      affected.map((x) => ({ product: x.p._id, productCode: x.p.code, productName: x.p.name, user: user.id, userName: user.name, source: "ajuste-masivo", changes: x.changes })),
    );
  }
  return NextResponse.json({ applied: true, affected: affected.length });
});
