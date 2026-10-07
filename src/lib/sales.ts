import "server-only";
import { Types } from "mongoose";
import { HttpError } from "./auth";
import { Product } from "./models/Product";
import { Sale } from "./models/Sale";
import { nextFolio } from "./models/Counter";
import { getSettings } from "./models/Settings";
import { computeTotals, lineSignature, paymentLine, priceLine, round2, withUnitPrice, type CustomerType, type PaymentMethod, type ProductPricing } from "./pricing";
import { Customer, phoneKey } from "./models/Customer";
import { adjustLines, type AdjustOptions } from "./adjust";
import { escapeRegex } from "./text";
import type { SessionUser } from "./session";
import type { z } from "zod";
import type { LineInputSchema } from "./validation";
import { CUSTOM_CATEGORY, customFromStored, customPricing, isCustomMode } from "./customItem";

type RawLine = z.infer<typeof LineInputSchema>;

/** Renglón guardado → entrada para volver a calcularlo (p. ej. al cobrar una cotización vencida). */
export function storedToRawLine(it: {
  product?: unknown;
  name?: string | null;
  mode: RawLine["mode"];
  qty: number;
  detail?: string | null;
  unitPrice: number;
  listUnitPrice?: number | null;
  lengthM?: number | null;
  barLengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
}): RawLine {
  // Fuera de catálogo: no hay precio de lista que consultar; se conserva el que se capturó.
  if (!it.product) return { custom: customFromStored(it), mode: it.mode, qty: it.qty };
  return {
    productId: String(it.product),
    mode: it.mode,
    qty: it.qty,
    lengthM: it.lengthM ?? undefined,
    barLengthM: it.barLengthM ?? undefined,
    widthM: it.widthM ?? undefined,
    heightM: it.heightM ?? undefined,
  };
}

/**
 * Recalcula cada renglón con los precios vigentes en la base (nunca confía en el navegador).
 * La excepción son los productos fuera de catálogo: ahí el precio es el que capturó el vendedor.
 */
export async function buildItems(lines: RawLine[], customerType: CustomerType = "particular") {
  const ids = [...new Set(lines.flatMap((l) => (l.productId ? [l.productId] : [])))];
  if (ids.some((id) => !Types.ObjectId.isValid(id))) throw new HttpError(400, "Producto inválido.");
  const products = ids.length ? await Product.find({ _id: { $in: ids } }).lean() : [];
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return lines.map((l, i) => {
    if (l.custom) {
      if (!isCustomMode(l.mode)) throw new HttpError(400, `${l.custom.name}: un producto fuera de catálogo se vende por pieza, kilo o metro.`);
      try {
        const priced = priceLine(customPricing(l.custom, l.mode), l);
        return { product: null, custom: true, code: "", name: l.custom.name, category: CUSTOM_CATEGORY, ...priced };
      } catch (e) {
        throw new HttpError(400, `${l.custom.name}: ${(e as Error).message}`);
      }
    }
    const p = byId.get(l.productId ?? "");
    if (!p || !p.active) throw new HttpError(400, `Renglón ${i + 1}: el producto ya no está disponible.`);
    try {
      const priced = priceLine(p as unknown as ProductPricing, l, { customerType });
      return { product: p._id, code: p.code, name: p.name, category: p.category, ...priced };
    } catch (e) {
      throw new HttpError(400, `${p.name}: ${(e as Error).message}`);
    }
  });
}

/**
 * Aplica «cobrar de más» (oculto) y descuento especial a renglones con precio de lista.
 * Sin ajustes deja los renglones tal cual (las ventas normales no cambian de forma).
 */
/** «Cobrar de más» y «Descuento especial» son decisiones distintas: no se combinan en una misma nota. */
function assertOneAdjust(opts: AdjustOptions) {
  if ((opts.extra ?? 0) > 0 && (opts.discountPct ?? 0) > 0) {
    throw new HttpError(400, "Elige solo un ajuste: cobrar de más o descuento especial, no los dos.");
  }
}

function applyAdjust<T extends { qty: number; unitPrice: number; subtotal: number }>(lines: T[], opts: AdjustOptions) {
  const a = adjustLines(lines, opts);
  const any = a.extra > 0 || a.discountPct > 0;
  return {
    lines: any ? a.lines : lines,
    fields: any
      ? { extraAmount: a.extra, discountPct: a.discountPct, discountAmount: a.discountAmount, shownSubtotal: a.shownSubtotal }
      : { extraAmount: 0, discountPct: 0, discountAmount: 0, shownSubtotal: null },
  };
}

type PayInput = { paymentMethod?: PaymentMethod | null; commissionPct: number; cashReceived: number | null; payNow?: number | null };

/** Construye un pago (con comisión y cambio) validando el efectivo recibido. */
export function makePayment(amount: number, method: PaymentMethod, pct: number, cashReceived: number | null, userName: string, note = "") {
  const p = paymentLine(amount, method, method === "terminal" ? pct : 0);
  let cash: number | null = null;
  let change: number | null = null;
  if (method === "efectivo" && cashReceived !== null && cashReceived !== undefined) {
    if (cashReceived + 1e-9 < p.received) throw new HttpError(400, "El efectivo recibido es menor al monto a pagar.");
    cash = round2(cashReceived);
    change = round2(cash - p.received);
  }
  return { amount: p.amount, method, commissionPct: p.commissionPct, commissionAmount: p.commissionAmount, cashReceived: cash, change, at: new Date(), userName, note };
}

/**
 * Campos de pago de una venta. Sin `payNow` se paga todo; con `payNow` menor al subtotal queda saldo
 * (solo para clientes preferenciales, respetando su límite de crédito si tiene).
 */
async function paymentFields(
  subtotalLines: { subtotal: number }[],
  input: PayInput,
  customer: { _id: unknown; name: string; preferential?: boolean | null; creditLimit?: number | null } | null,
  userName: string,
) {
  const subtotal = round2(subtotalLines.reduce((a, l) => a + l.subtotal, 0));
  const wantsPartial = input.payNow !== null && input.payNow !== undefined && input.payNow < subtotal - 0.005;
  const amount = wantsPartial ? round2(Math.max(0, input.payNow!)) : subtotal;
  if (wantsPartial) {
    if (!customer?.preferential) throw new HttpError(400, "Solo los clientes preferenciales pueden dejar saldo. Márcalo como preferencial en Clientes.");
    if (customer.creditLimit && customer.creditLimit > 0) {
      const agg = await Sale.find({ customer: customer._id, kind: "venta", status: { $ne: "cancelada" }, balance: { $gt: 0 } }).select("balance").lean();
      const owed = agg.reduce((a, r) => a + (r.balance ?? 0), 0);
      if (owed + (subtotal - amount) > customer.creditLimit + 0.005) {
        throw new HttpError(400, `Rebasa el límite de crédito de ${customer.name}: ya debe ${owed.toFixed(2)} de ${customer.creditLimit.toFixed(2)}.`);
      }
    }
  }
  if (amount > 0 && !input.paymentMethod) throw new HttpError(400, "Elige el método de pago.");
  const payments = amount > 0 ? [makePayment(amount, input.paymentMethod!, input.commissionPct, input.cashReceived, userName, wantsPartial ? "Anticipo" : "")] : [];
  const commissionAmount = round2(payments.reduce((a, p) => a + p.commissionAmount, 0));
  const balance = round2(subtotal - amount);
  return {
    subtotal,
    commissionPct: payments[0]?.commissionPct ?? 0,
    commissionAmount,
    total: round2(subtotal + commissionAmount),
    paymentMethod: payments[0]?.method ?? null,
    cashReceived: payments[0]?.cashReceived ?? null,
    change: payments[0]?.change ?? null,
    payments,
    paid: amount,
    balance,
    paymentStatus: balance > 0 ? "parcial" : "pagada",
  };
}

/**
 * Cliente de la venta: el elegido en el buscador, o se registra solo con el nombre/teléfono capturado
 * (si ya existe uno con el mismo teléfono o nombre se reutiliza).
 */
export async function resolveCustomer(input: { customerId?: string | null; customerName?: string; customerPhone?: string; customerType?: CustomerType }) {
  if (input.customerId) {
    if (!Types.ObjectId.isValid(input.customerId)) throw new HttpError(400, "Cliente inválido.");
    const c = await Customer.findById(input.customerId);
    if (!c || !c.active) throw new HttpError(400, "El cliente ya no existe.");
    return c;
  }
  const name = (input.customerName ?? "").trim();
  if (!name) return null;
  const key = phoneKey(input.customerPhone);
  let c = key.length >= 7 ? await Customer.findOne({ phoneKey: key, active: true }) : null;
  if (!c) c = await Customer.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i"), active: true });
  if (c) {
    if (!c.phone && input.customerPhone) {
      c.phone = input.customerPhone;
      c.phoneKey = key;
      await c.save();
    }
    return c;
  }
  return Customer.create({ name, phone: input.customerPhone ?? "", phoneKey: key, customerType: input.customerType ?? "particular" });
}

export async function createSale(
  user: SessionUser,
  input: {
    kind: "venta" | "cotizacion";
    items: RawLine[];
    paymentMethod?: PaymentMethod | null;
    commissionPct: number;
    cashReceived: number | null;
    customerType: CustomerType;
    customerName: string;
    customerPhone: string;
    notes: string;
    customerId?: string | null;
    payNow?: number | null;
    extraAmount?: number | null;
    discountPct?: number;
  },
) {
  assertOneAdjust({ extra: input.extraAmount, discountPct: input.discountPct });
  const adj = applyAdjust(await buildItems(input.items, input.customerType), { extra: input.extraAmount, discountPct: input.discountPct });
  const items = adj.lines;
  const customer = await resolveCustomer(input);
  const base = {
    kind: input.kind,
    items,
    customer: customer?._id ?? null,
    customerType: input.customerType,
    customerName: customer?.name ?? input.customerName,
    customerPhone: input.customerPhone || customer?.phone || "",
    notes: input.notes,
    seller: user.id,
    sellerName: user.name,
    ...adj.fields,
  };

  if (input.kind === "cotizacion") {
    const settings = await getSettings();
    // La cotización puede indicar con qué método piensa pagar el cliente para mostrarle el total con comisión.
    const method = input.paymentMethod ?? null;
    const totals = computeTotals(items, method, input.commissionPct);
    const validUntil = new Date(Date.now() + settings.quoteValidityDays * 86400000);
    return Sale.create({
      ...base,
      folio: await nextFolio("cotizacion"),
      ...totals,
      paymentMethod: method,
      validUntil,
    });
  }

  const pay = await paymentFields(items, input, customer, user.name);
  return Sale.create({
    ...base,
    folio: await nextFolio("venta"),
    ...pay,
  });
}

/**
 * Convierte una cotización en venta. Si sigue vigente se respetan los precios cotizados;
 * si ya venció, se recalcula con los precios actuales.
 */
export async function convertQuote(
  user: SessionUser,
  quoteId: string,
  input: { paymentMethod?: PaymentMethod | null; commissionPct: number; cashReceived: number | null; payNow?: number | null },
) {
  if (!Types.ObjectId.isValid(quoteId)) throw new HttpError(404, "Cotización no encontrada.");
  const quote = await Sale.findById(quoteId);
  if (!quote || quote.kind !== "cotizacion") throw new HttpError(404, "Cotización no encontrada.");
  if (quote.status !== "vigente") throw new HttpError(409, `Esta cotización ya está ${quote.status}.`);

  const expired = !!quote.validUntil && quote.validUntil.getTime() < Date.now();
  const quoteAdj: AdjustOptions = { extra: quote.extraAmount, discountPct: quote.discountPct };
  let adjFields = { extraAmount: quote.extraAmount ?? 0, discountPct: quote.discountPct ?? 0, discountAmount: quote.discountAmount ?? 0, shownSubtotal: quote.shownSubtotal ?? null };
  const items = expired
    ? await buildItems(quote.items.map(storedToRawLine), (quote.customerType ?? "particular") as CustomerType).then((built) => {
        // Venció: precios actuales, pero se respetan el extra y el descuento que se le dieron.
        const a = applyAdjust(built, quoteAdj);
        adjFields = a.fields;
        return a.lines;
      })
    : (quote.toObject().items as { subtotal: number }[]);

  const customer = quote.customer ? await Customer.findById(quote.customer) : null;
  const pay = await paymentFields(items, input, customer, user.name);

  // Marca la cotización primero (atómico) para evitar convertirla dos veces.
  const locked = await Sale.findOneAndUpdate({ _id: quote._id, status: "vigente" }, { status: "convertida" }, { new: true });
  if (!locked) throw new HttpError(409, "Esta cotización ya fue convertida.");

  try {
    const sale = await Sale.create({
      kind: "venta",
      folio: await nextFolio("venta"),
      items,
      customer: quote.customer ?? null,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      customerType: quote.customerType,
      notes: quote.notes,
      seller: user.id,
      sellerName: user.name,
      fromQuote: quote._id,
      fromQuoteFolio: quote.folio,
      ...adjFields,
      ...pay,
    });
    await Sale.updateOne({ _id: quote._id }, { convertedTo: sale._id, convertedToFolio: sale.folio });
    return { sale, repriced: expired };
  } catch (e) {
    await Sale.updateOne({ _id: quote._id }, { status: "vigente" });
    throw e;
  }
}

/**
 * Edita una cotización vigente (agregar, quitar o cambiar renglones y datos del cliente).
 * - Si sigue vigente, los renglones que ya estaban (mismo producto, forma y medida) conservan
 *   el precio cotizado aunque cambie la cantidad; los nuevos toman el precio actual.
 * - Si ya venció, todo se recalcula con precios actuales y la vigencia se renueva.
 */
export async function updateQuote(
  user: SessionUser,
  quoteId: string,
  input: {
    items: RawLine[];
    paymentMethod?: PaymentMethod | null;
    commissionPct: number;
    customerType: CustomerType;
    customerName: string;
    customerPhone: string;
    notes: string;
    customerId?: string | null;
    extraAmount?: number | null;
    discountPct?: number;
  },
) {
  if (!Types.ObjectId.isValid(quoteId)) throw new HttpError(404, "Cotización no encontrada.");
  const quote = await Sale.findById(quoteId);
  if (!quote || quote.kind !== "cotizacion") throw new HttpError(404, "Cotización no encontrada.");
  if (quote.status !== "vigente") throw new HttpError(409, `Esta cotización ya está ${quote.status}; ya no se puede editar.`);
  assertOneAdjust({ extra: input.extraAmount, discountPct: input.discountPct });

  const expired = !!quote.validUntil && quote.validUntil.getTime() < Date.now();
  const sameType = (quote.customerType ?? "particular") === input.customerType;
  let items = await buildItems(input.items, input.customerType);
  let kept = 0;
  if (!expired && sameType) {
    // Precio cotizado de lista (antes del extra y del descuento, que se vuelven a aplicar abajo).
    // Solo productos del catálogo: en los de fuera de catálogo manda el precio que se acaba de capturar.
    const quoted = new Map(quote.items.filter((it) => it.product).map((it) => [lineSignature(String(it.product), it), it.listUnitPrice ?? it.unitPrice]));
    items = items.map((it) => {
      if (!it.product) return it;
      const unit = quoted.get(lineSignature(String(it.product), it));
      if (unit === undefined) return it;
      kept++;
      return withUnitPrice(it, unit);
    });
  }

  const adj = applyAdjust(items, { extra: input.extraAmount, discountPct: input.discountPct });
  items = adj.lines;
  const method = input.paymentMethod ?? null;
  const totals = computeTotals(items, method, method === "terminal" ? input.commissionPct : 0);
  const customer = await resolveCustomer(input);
  const update: Record<string, unknown> = {
    customer: customer?._id ?? null,
    items,
    ...adj.fields,
    ...totals,
    paymentMethod: method,
    customerType: input.customerType,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    notes: input.notes,
    editedAt: new Date(),
    editedByName: user.name,
  };
  if (expired) {
    const settings = await getSettings();
    update.validUntil = new Date(Date.now() + settings.quoteValidityDays * 86400000);
  }
  const saved = await Sale.findOneAndUpdate({ _id: quote._id, status: "vigente" }, { $set: update }, { new: true });
  if (!saved) throw new HttpError(409, "La cotización cambió mientras la editabas. Vuelve a abrirla.");
  return { quote: saved, keptPrices: kept, repriced: expired };
}

/** Registra un abono a una venta con saldo (cliente preferencial). */
export async function addPayment(
  user: SessionUser,
  saleId: string,
  input: { amount: number; paymentMethod: PaymentMethod; commissionPct: number; cashReceived: number | null; note: string },
) {
  if (!Types.ObjectId.isValid(saleId)) throw new HttpError(404, "Venta no encontrada.");
  const sale = await Sale.findById(saleId);
  if (!sale || sale.kind !== "venta") throw new HttpError(404, "Venta no encontrada.");
  if (sale.status === "cancelada") throw new HttpError(409, "La venta está cancelada.");
  const balance = sale.balance ?? 0;
  if (balance <= 0) throw new HttpError(409, "Esta venta ya está liquidada.");
  const amount = round2(input.amount);
  if (amount > balance + 0.005) throw new HttpError(400, `El abono no puede ser mayor al saldo (${balance.toFixed(2)}).`);
  const p = makePayment(amount, input.paymentMethod, input.commissionPct, input.cashReceived, user.name, input.note || "Abono");
  const newBalance = round2(balance - amount);
  const updated = await Sale.findOneAndUpdate(
    { _id: sale._id, balance },
    {
      $push: { payments: p },
      $inc: { paid: amount, commissionAmount: p.commissionAmount, total: p.commissionAmount },
      $set: { balance: newBalance, paymentStatus: newBalance > 0 ? "parcial" : "pagada" },
    },
    { new: true },
  );
  if (!updated) throw new HttpError(409, "El saldo cambió mientras registrabas el abono. Vuelve a intentarlo.");
  return { sale: updated, payment: p };
}
