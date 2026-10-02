/**
 * Importa/actualiza productos desde un CSV (mismo formato que la pantalla "Importar lista").
 *   npm run import:products -- data/lista-precios.csv            → vista previa
 *   npm run import:products -- data/lista-precios.csv --apply    → aplica
 *   ... --apply --replace   → además da de baja (sin borrar) los productos activos que NO vienen en el CSV
 */
import "dotenv/config";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";

config({ path: ".env.local" });

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Indica la ruta del CSV");
  const apply = process.argv.includes("--apply");

  const { connectDB } = await import("../src/lib/db");
  const { Product, ProductRaw } = await import("../src/lib/models/Product");
  const { PriceLog } = await import("../src/lib/models/PriceLog");
  const { parseCsv, rowToProduct } = await import("../src/lib/csvImport");
  const { ProductInput } = await import("../src/lib/validation");
  const { priceChanges } = await import("../src/lib/priceDiff");

  const rows = parseCsv(readFileSync(file, "utf8")).map((r, i) => rowToProduct(r, i + 2));
  const errors: string[] = [];
  const valid: { line: number; data: ReturnType<typeof ProductInput.parse> }[] = [];
  for (const r of rows) {
    if (r.error) errors.push(`Renglón ${r.line}: ${r.error}`);
    else {
      const res = ProductInput.safeParse(r.data);
      if (res.success) valid.push({ line: r.line, data: res.data });
      else errors.push(`Renglón ${r.line}: ${res.error.issues[0].path.join(".")} ${res.error.issues[0].message}`);
    }
  }
  if (errors.length) {
    console.error(errors.join("\n"));
    throw new Error(`${errors.length} renglón(es) con error. Corrige y vuelve a intentar.`);
  }

  await connectDB();
  // Una sola consulta para saber cuáles existen; luego escrituras por lote (rápido aun contra Atlas).
  const existing = await Product.find({ code: { $in: valid.map((v) => v.data.code) } }).lean();
  const byCode = new Map(existing.map((p) => [p.code, p]));
  const toCreate = valid.filter((v) => !byCode.has(v.data.code)).map((v) => v.data);
  const toUpdate = valid.filter((v) => byCode.has(v.data.code));
  const created = toCreate.length;
  const updated = toUpdate.length;
  const changed = toUpdate
    .map((v) => ({ v, changes: priceChanges(byCode.get(v.data.code) as unknown as Record<string, unknown>, v.data) }))
    .filter((x) => x.changes.length);
  if (!apply && changed.length) console.log(`  ${changed.length} producto(s) existentes cambian de precio.`);

  if (apply) {
    if (toCreate.length) {
      const docs = await Product.insertMany(toCreate);
      await PriceLog.insertMany(
        docs.map((p) => ({ product: p._id, productCode: p.code, productName: p.name, userName: "script", source: "importacion", changes: [{ field: "alta", from: null, to: "Importado" }] })),
      );
    }
    if (toUpdate.length) {
      await ProductRaw.bulkWrite(toUpdate.map((v) => ({ updateOne: { filter: { code: v.data.code }, update: { $set: v.data } } })));
      if (changed.length) {
        await PriceLog.insertMany(
          changed.map(({ v, changes }) => ({ product: byCode.get(v.data.code)!._id, productCode: v.data.code, productName: v.data.name, userName: "script", source: "importacion", changes })),
        );
      }
    }
  }
  let retired = 0;
  if (process.argv.includes("--replace")) {
    const keep = valid.map((v) => v.data.code);
    const filter = { active: true, code: { $nin: keep } };
    retired = await Product.countDocuments(filter);
    if (apply && retired) await Product.updateMany(filter, { $set: { active: false } });
  }
  console.log(
    `${apply ? "✓ Aplicado" : "Vista previa"}: ${created} nuevos, ${updated} existentes` +
      (process.argv.includes("--replace") ? `, ${retired} se dan de baja por no estar en la lista` : "") +
      `.${apply ? "" : " Agrega --apply para guardar."}`,
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("✗", e.message);
  await mongoose.disconnect();
  process.exit(1);
});
