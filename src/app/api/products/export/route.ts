import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { CSV_HEADERS } from "@/lib/csvImport";

function cell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Descarga el catálogo en el mismo formato que acepta la importación (para editar en Excel y volver a subir). */
export const GET = handle(async () => {
  await requireApi("products:view");
  await connectDB();
  const products = await Product.find({ active: true }).sort({ category: 1, name: 1 }).lean();
  const lines = [CSV_HEADERS.join(",")];
  for (const p of products) {
    const row: Record<(typeof CSV_HEADERS)[number], unknown> = {
      codigo: p.code,
      nombre: p.name,
      grupo: p.group,
      categoria: p.category,
      linea: p.line,
      color: p.color,
      tipo: p.unitType,
      unidad: p.unitLabel,
      precio: p.price,
      precio_metro: p.pricePerMeter,
      tiras: (p.bars ?? []).map((b) => `${b.lengthM}:${b.price}`).join("|"),
      tramo_minimo_m: p.unitType === "perfil" ? p.minCutM : "",
      precio_m2: p.pricePerM2,
      precio_m2_vidriero: p.pricePerM2Vidriero,
      hojas: (p.sheets ?? []).map((s) => `${s.widthM}x${s.heightM}:${s.price}`).join("|"),
      notas: p.notes,
    };
    lines.push(CSV_HEADERS.map((h) => cell(row[h])).join(","));
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="lista-precios-${date}.csv"` },
  });
});
