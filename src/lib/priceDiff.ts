import type { ProductInputT } from "./validation";

const FIELDS: { key: keyof ProductInputT; label: string }[] = [
  { key: "price", label: "Precio" },
  { key: "pricePerMeter", label: "Precio por metro" },
  { key: "pricePerM2", label: "Precio por m²" },
  { key: "bars", label: "Tiras" },
  { key: "pricePerM2Vidriero", label: "Precio por m² vidriero" },
  { key: "sheets", label: "Hojas" },
  { key: "unitType", label: "Tipo de venta" },
];

function norm(v: unknown) {
  return JSON.stringify(v ?? null);
}

/** Lista de cambios de precio entre lo guardado y lo nuevo (para el historial). */
export function priceChanges(before: Record<string, unknown>, after: Partial<ProductInputT>) {
  const out: { field: string; from: unknown; to: unknown }[] = [];
  for (const f of FIELDS) {
    if (!(f.key in after)) continue;
    const a = before[f.key];
    const b = after[f.key];
    const one = (x: Record<string, unknown>) =>
      "lengthM" in x && x.lengthM !== undefined ? { lengthM: x.lengthM, price: x.price } : { widthM: x.widthM, heightM: x.heightM, price: x.price };
    const clean = (v: unknown) => (Array.isArray(v) ? v.map((x) => one(x as Record<string, unknown>)) : v);
    if (norm(clean(a)) !== norm(clean(b))) out.push({ field: f.label, from: clean(a) ?? null, to: clean(b) ?? null });
  }
  return out;
}
