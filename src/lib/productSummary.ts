import { formatM, formatMoney, formatNumber, type ProductPricing } from "./pricing";

/** Resumen corto del precio para listas, p. ej. "$95.00/m · tira 6 m $520.00". */
export function priceSummary(p: ProductPricing): string[] {
  const out: string[] = [];
  const u = p.unitLabel || "pza";
  switch (p.unitType) {
    case "pieza":
      if (p.price) out.push(`${formatMoney(p.price)} / ${u}`);
      break;
    case "kg":
      if (p.price) out.push(`${formatMoney(p.price)} / kg`);
      break;
    case "metro":
      if (p.price) out.push(`${formatMoney(p.price)} / m`);
      break;
    case "perfil":
      for (const b of p.bars ?? []) out.push(`Tira ${formatM(b.lengthM)} m: ${formatMoney(b.price)}`);
      if (p.pricePerMeter) out.push(`Tramo: ${formatMoney(p.pricePerMeter)} / m`);
      break;
    case "vidrio":
      for (const s of p.sheets ?? []) if (s.price) out.push(`Hoja${s.widthM ? ` ${formatM(s.widthM)}×${formatM(s.heightM)}` : ""}: ${formatMoney(s.price)}`);
      if (p.pricePerM2) out.push(`m² particular: ${formatMoney(p.pricePerM2)}`);
      if (p.pricePerM2Vidriero) out.push(`m² vidriero: ${formatMoney(p.pricePerM2Vidriero)}`);
      break;
  }
  return out.length ? out : ["Sin precio capturado"];
}
