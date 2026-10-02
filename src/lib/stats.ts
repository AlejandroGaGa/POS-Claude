import "server-only";
import { Sale } from "./models/Sale";
import { dayStr, range } from "./dates";

type Agg = { total: number; count: number };
const bump = (m: Map<string, Agg>, k: string, v: number) => {
  const e = m.get(k) ?? { total: 0, count: 0 };
  e.total += v;
  e.count += 1;
  m.set(k, e);
};
const sorted = (m: Map<string, Agg>) => [...m.entries()].map(([k, v]) => ({ _id: k, ...v })).sort((a, b) => b.total - a.total);

/**
 * Estadísticas del periodo. Se calculan en el servidor de la app a partir de una consulta
 * con proyección: para el volumen de un mostrador (miles de ventas al año) es rápido y
 * funciona igual en cualquier MongoDB compatible.
 */
export async function getStats(desde: string, hasta: string) {
  const createdAt = range(desde, hasta);
  const [sales, quotes, cancelled] = await Promise.all([
    Sale.find({ kind: "venta", status: { $ne: "cancelada" }, createdAt })
      .select("createdAt total commissionAmount paymentMethod sellerName items.code items.name items.category items.subtotal")
      .lean(),
    Sale.find({ kind: "cotizacion", createdAt }).select("status").lean(),
    Sale.countDocuments({ kind: "venta", status: "cancelada", createdAt }),
  ]);

  let total = 0;
  let commission = 0;
  const byMethod = new Map<string, Agg>();
  const commissionByMethod = new Map<string, number>();
  const bySeller = new Map<string, Agg>();
  const byDay = new Map<string, Agg>();
  const byProduct = new Map<string, Agg & { name: string; category: string }>();
  const byCategory = new Map<string, Agg>();

  for (const s of sales) {
    total += s.total;
    commission += s.commissionAmount ?? 0;
    const m = s.paymentMethod ?? "—";
    bump(byMethod, m, s.total);
    commissionByMethod.set(m, (commissionByMethod.get(m) ?? 0) + (s.commissionAmount ?? 0));
    bump(bySeller, s.sellerName || "—", s.total);
    bump(byDay, dayStr(new Date(s.createdAt)), s.total);
    for (const it of s.items) {
      const e = byProduct.get(it.code ?? "") ?? { total: 0, count: 0, name: it.name ?? "", category: it.category ?? "" };
      e.total += it.subtotal;
      e.count += 1;
      byProduct.set(it.code ?? "", e);
      bump(byCategory, it.category || "Sin categoría", it.subtotal);
    }
  }

  const quoteCount = quotes.length;
  const converted = quotes.filter((q) => q.status === "convertida").length;
  const pending = quotes.filter((q) => q.status === "vigente").length;

  return {
    total,
    count: sales.length,
    avg: sales.length ? total / sales.length : 0,
    commission,
    cancelled,
    byMethod: sorted(byMethod).map((x) => ({ ...x, commission: commissionByMethod.get(x._id) ?? 0 })),
    bySeller: sorted(bySeller),
    byDay: [...byDay.entries()].map(([k, v]) => ({ _id: k, ...v })).sort((a, b) => a._id.localeCompare(b._id)),
    topProducts: [...byProduct.entries()]
      .map(([code, v]) => ({ code, name: v.name, category: v.category, total: v.total, lines: v.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    byCategory: sorted(byCategory),
    quotes: { count: quoteCount, converted, pending, rate: quoteCount ? converted / quoteCount : 0 },
  };
}

/** Total vendido (sin canceladas) en un rango, para comparar contra el periodo anterior. */
export async function getPeriodTotal(desde: string, hasta: string) {
  const sales = await Sale.find({ kind: "venta", status: { $ne: "cancelada" }, createdAt: range(desde, hasta) }).select("total").lean();
  return sales.reduce((a, s) => a + s.total, 0);
}
