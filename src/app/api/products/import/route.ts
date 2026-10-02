import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { Product, ProductRaw } from "@/lib/models/Product";
import { PriceLog } from "@/lib/models/PriceLog";
import { ProductInput, parse } from "@/lib/validation";
import { priceChanges } from "@/lib/priceDiff";

const Body = z.object({
  rows: z.array(z.object({ line: z.number(), data: z.record(z.string(), z.unknown()) })).max(5000),
  apply: z.boolean().default(false),
});

/** Crea o actualiza productos por código. Con apply=false solo devuelve la vista previa. */
export const POST = handle(async (req: Request) => {
  const user = await requireApi("products:edit");
  const { rows, apply } = parse(Body, await req.json());
  await connectDB();

  const errors: { line: number; error: string }[] = [];
  const valid: { line: number; data: z.infer<typeof ProductInput> }[] = [];
  for (const r of rows) {
    const res = ProductInput.safeParse(r.data);
    if (res.success) valid.push({ line: r.line, data: res.data });
    else errors.push({ line: r.line, error: `${res.error.issues[0].path.join(".")}: ${res.error.issues[0].message}` });
  }
  const codes = valid.map((v) => v.data.code.toUpperCase());
  const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (dupes.length) errors.push({ line: 0, error: `Códigos repetidos en el archivo: ${[...new Set(dupes)].join(", ")}` });

  const existing = await Product.find({ code: { $in: codes } }).lean();
  const byCode = new Map(existing.map((p) => [p.code, p]));
  const creates = valid.filter((v) => !byCode.has(v.data.code.toUpperCase()));
  const updates = valid
    .filter((v) => byCode.has(v.data.code.toUpperCase()))
    .map((v) => ({ ...v, changes: priceChanges(byCode.get(v.data.code.toUpperCase()) as unknown as Record<string, unknown>, v.data) }));

  if (!apply || errors.length) {
    return NextResponse.json({
      apply: false,
      errors,
      creates: creates.length,
      updates: updates.length,
      priceChanges: updates.filter((u) => u.changes.length).length,
      sample: updates.filter((u) => u.changes.length).slice(0, 20).map((u) => ({ code: u.data.code, name: u.data.name, changes: u.changes })),
    });
  }

  if (creates.length) {
    const created = await Product.insertMany(creates.map((c) => c.data));
    await PriceLog.insertMany(
      created.map((p) => ({ product: p._id, productCode: p.code, productName: p.name, user: user.id, userName: user.name, source: "importacion", changes: [{ field: "alta", from: null, to: "Importado" }] })),
    );
  }
  if (updates.length) {
    await ProductRaw.bulkWrite(updates.map((u) => ({ updateOne: { filter: { code: u.data.code.toUpperCase() }, update: { $set: { ...u.data, code: u.data.code.toUpperCase() } } } })));
    const logs = updates
      .filter((u) => u.changes.length)
      .map((u) => ({ product: byCode.get(u.data.code.toUpperCase())!._id, productCode: u.data.code.toUpperCase(), productName: u.data.name, user: user.id, userName: user.name, source: "importacion", changes: u.changes }));
    if (logs.length) await PriceLog.insertMany(logs);
  }
  return NextResponse.json({ apply: true, errors: [], creates: creates.length, updates: updates.length });
});
