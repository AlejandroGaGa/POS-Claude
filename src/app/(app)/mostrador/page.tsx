import { Types } from "mongoose";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Product } from "@/lib/models/Product";
import { Sale } from "@/lib/models/Sale";
import { Customer } from "@/lib/models/Customer";
import { can } from "@/lib/roles";
import { getSettings } from "@/lib/models/Settings";
import { plain } from "@/lib/serialize";
import { lineSignature, round2, type LineInput, type PaymentMethod, type CustomerType } from "@/lib/pricing";
import type { ProductJSON } from "@/lib/types";
import { customFromStored, customProduct, isCustomMode } from "@/lib/customItem";
import Pos, { type CategoryInfo, type EditQuote } from "@/components/pos/Pos";
import type { PickedCustomer } from "@/components/CustomerPicker";

async function loadCustomer(id: unknown): Promise<PickedCustomer | null> {
  if (!id || !Types.ObjectId.isValid(String(id))) return null;
  const c = await Customer.findById(id).select("name phone customerType preferential creditLimit active").lean();
  if (!c || !c.active) return null;
  return { _id: String(c._id), name: c.name, phone: c.phone ?? "", customerType: (c.customerType ?? "particular") as CustomerType, preferential: !!c.preferential, creditLimit: c.creditLimit ?? 0 };
}

export const metadata = { title: "Mostrador" };

/** Carga una cotización vigente como carrito para agregar o quitar productos. */
async function loadQuoteForEdit(id: string): Promise<EditQuote | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const q = await Sale.findById(id).lean();
  if (!q || q.kind !== "cotizacion" || q.status !== "vigente") return null;
  const ids = [...new Set(q.items.flatMap((it) => (it.product ? [String(it.product)] : [])))];
  const products = plain<ProductJSON[]>(await Product.find({ _id: { $in: ids } }).lean());
  const byId = new Map(products.map((p) => [p._id, p]));
  const expired = !!q.validUntil && new Date(q.validUntil).getTime() < Date.now();
  const locked: Record<string, number> = {};
  const lines = q.items.flatMap((it, i) => {
    // En el carrito va el precio de lista cotizado; el extra y el descuento se vuelven a aplicar encima.
    const unit = it.listUnitPrice ?? it.unitPrice;
    // Fuera de catálogo: se reconstruye con el nombre y precio guardados en la cotización.
    const customMode = !it.product && isCustomMode(it.mode) ? it.mode : null;
    const product = customMode ? customProduct(customFromStored(it), customMode, `${id}-${i}`) : byId.get(String(it.product));
    if (!product) return [];
    const dims = {
      ...(it.lengthM != null ? { lengthM: it.lengthM } : {}),
      ...(it.barLengthM != null ? { barLengthM: it.barLengthM } : {}),
      ...(it.widthM != null ? { widthM: it.widthM } : {}),
      ...(it.heightM != null ? { heightM: it.heightM } : {}),
    };
    const input: LineInput = { mode: it.mode, qty: it.qty, ...dims };
    if (!expired && !customMode) locked[lineSignature(product._id, input)] = unit;
    return [{ key: `${id}-${i}`, product, input, priced: { mode: it.mode, qty: it.qty, ...dims, unitPrice: unit, subtotal: round2(unit * it.qty), detail: it.detail ?? "" } }];
  });
  return {
    id,
    folio: q.folio,
    expired,
    validUntil: q.validUntil ? new Date(q.validUntil).toISOString() : null,
    customerType: (q.customerType ?? "particular") as CustomerType,
    customerName: q.customerName ?? "",
    customerPhone: q.customerPhone ?? "",
    notes: q.notes ?? "",
    paymentMethod: (q.paymentMethod ?? null) as PaymentMethod | null,
    commissionPct: q.commissionPct ?? 0,
    lines,
    locked,
    missing: q.items.length - lines.length,
    extraAmount: q.extraAmount ?? 0,
    discountPct: q.discountPct ?? 0,
    customer: await loadCustomer(q.customer),
  };
}

export default async function MostradorPage({ searchParams }: { searchParams: Promise<{ cotizacion?: string; cliente?: string }> }) {
  const user = await requirePage("sales:create");
  const { cotizacion, cliente } = await searchParams;
  await connectDB();
  const [settings, products, editQuote, initialCustomer] = await Promise.all([
    getSettings(),
    Product.find({ active: true }).select("category group").lean(),
    cotizacion ? loadQuoteForEdit(cotizacion) : Promise.resolve(null),
    cliente ? loadCustomer(cliente) : Promise.resolve(null),
  ]);
  // Cuenta tarjetas (un perfil con varios colores cuenta como uno).
  const seen = new Map<string, Set<string>>();
  for (const p of products) {
    const set = seen.get(p.category) ?? new Set<string>();
    set.add(p.group || String(p._id));
    seen.set(p.category, set);
  }
  const categories: CategoryInfo[] = [...seen.entries()]
    .map(([name, set]) => ({ name, count: set.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  return <Pos defaultPct={settings.defaultCommissionPct} categories={categories} editQuote={editQuote} initialCustomer={initialCustomer} canCredit={can(user.role, "customers:credit")} />;
}
