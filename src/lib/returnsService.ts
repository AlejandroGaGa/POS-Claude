import "server-only";
import { Types } from "mongoose";
import { HttpError } from "./errors";
import { Sale } from "./models/Sale";
import { Return } from "./models/Return";
import { Customer } from "./models/Customer";
import { nextReturnFolio } from "./models/Counter";
import { buildItems, makePayment, resolveCustomer } from "./sales";
import { round2, type CustomerType } from "./pricing";
import { normalizeFolio, returnableQty, returnedLineValue, settleReturn } from "./returns";

export { normalizeFolio };
import { escapeRegex, looseRegex } from "./text";
import type { SessionUser } from "./session";
import type { ReturnInputT } from "./validation";

/** Modos que se venden por pieza entera (no se puede devolver media tira). */
const INTEGER_MODES = new Set(["pieza", "tira", "tramo", "hoja", "m2"]);

const LOOKUP_FIELDS = "folio fromQuoteFolio createdAt customer customerName customerPhone customerType total subtotal balance sellerName items.name items.qty items.returnedQty returnedTotal";

/**
 * Busca ventas para devolver. Acepta folio de venta (V-…), de la cotización de la que salió (C-…),
 * de una devolución anterior (D-…), nombre o teléfono del cliente (registrado o no, sin importar
 * acentos ni espacios) o nombre/código de producto.
 */
export async function searchSalesForReturn(q: string) {
  const t = q.trim();
  if (t.length < 2) return { sales: [], hint: "" };
  const base = { kind: "venta", status: { $ne: "cancelada" } };
  const f = normalizeFolio(t);

  if (f?.prefix === "V") {
    const sales = await Sale.find({ ...base, folio: f.folio }).select(LOOKUP_FIELDS).lean();
    return { sales, hint: sales.length ? "" : `No hay una venta vigente con folio ${f.folio}.` };
  }
  if (f?.prefix === "C") {
    const sales = await Sale.find({ ...base, fromQuoteFolio: f.folio }).select(LOOKUP_FIELDS).lean();
    if (sales.length) return { sales, hint: "" };
    const quote = await Sale.findOne({ kind: "cotizacion", folio: f.folio }).select("status").lean();
    const hint = !quote
      ? `No existe la cotización ${f.folio}.`
      : quote.status === "vigente"
        ? `La cotización ${f.folio} todavía no se cobra: no hay nada que devolver.`
        : `La cotización ${f.folio} está ${quote.status}.`;
    return { sales: [], hint };
  }
  if (f?.prefix === "D") {
    const r = await Return.findOne({ folio: f.folio }).select("sale").lean();
    if (!r) return { sales: [], hint: `No existe la devolución ${f.folio}.` };
    if (!r.sale) return { sales: [], hint: `${f.folio} fue una devolución sin nota.` };
    const sales = await Sale.find({ ...base, _id: r.sale }).select(LOOKUP_FIELDS).lean();
    return { sales, hint: "" };
  }

  const rx = looseRegex(t);
  const customers = await Customer.find({ $or: [{ name: rx }, { phone: rx }] }).select("_id").limit(50).lean();
  const sales = await Sale.find({
    ...base,
    $or: [
      { folio: new RegExp(escapeRegex(t), "i") },
      { fromQuoteFolio: new RegExp(escapeRegex(t), "i") },
      { customerName: rx },
      { customerPhone: rx },
      { "items.name": rx },
      { "items.code": new RegExp(escapeRegex(t), "i") },
      ...(customers.length ? [{ customer: { $in: customers.map((c) => c._id) } }] : []),
    ],
  })
    .sort({ createdAt: -1 })
    .limit(25)
    .select(LOOKUP_FIELDS)
    .lean();
  return { sales, hint: sales.length ? "" : "No encontré ventas con ese dato. Prueba con el folio, el teléfono o regístrala sin nota." };
}

/** Venta para el formulario de devolución (cualquier rol puede devolver, aunque no la haya vendido). */
export async function loadSaleForReturn(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "Venta no encontrada.");
  const sale = await Sale.findById(id).lean();
  if (!sale || sale.kind !== "venta") throw new HttpError(404, "Venta no encontrada.");
  if (sale.status === "cancelada") throw new HttpError(409, `La venta ${sale.folio} está cancelada.`);
  return sale;
}

/** Filtro que acepta el valor guardado o el campo ausente (ventas anteriores a devoluciones). */
const sameOrMissing = (v: number) => (v === 0 ? { $in: [0, null] } : v);

/**
 * Registra una devolución o cambio:
 * 1. Valida que no se devuelva más de lo vendido (descontando devoluciones anteriores).
 * 2. Acredita lo devuelto al precio pagado y cobra lo nuevo a precio actual.
 * 3. Resuelve la diferencia según el modo (con diferencia, cortesía o cobrar lo nuevo completo).
 * 4. Marca en la venta original las cantidades devueltas y, si debía saldo, se lo abona primero.
 */
export async function createReturn(user: SessionUser, input: ReturnInputT) {
  const sale = input.saleId ? await loadSaleForReturn(input.saleId) : null;
  const customerType = ((sale?.customerType as CustomerType) ?? input.customerType) || "particular";

  // 1–2. Lo devuelto
  let returnedItems: Record<string, unknown>[] = [];
  const qtyByIndex = new Map<number, number>();
  if (sale) {
    if (!input.returned.length) throw new HttpError(400, "Elige qué productos regresa el cliente.");
    for (const r of input.returned) {
      if (qtyByIndex.has(r.index)) throw new HttpError(400, "Un renglón viene repetido.");
      const it = sale.items[r.index];
      if (!it) throw new HttpError(400, "Renglón de la venta inválido.");
      const qty = Math.round(r.qty * 1000) / 1000;
      if (INTEGER_MODES.has(it.mode) && !Number.isInteger(qty)) throw new HttpError(400, `${it.name}: la cantidad a devolver debe ser entera.`);
      const max = returnableQty(it.qty, it.returnedQty);
      if (qty > max + 1e-9) {
        throw new HttpError(400, max > 0 ? `${it.name}: solo se pueden devolver ${max}.` : `${it.name} ya se devolvió completo.`);
      }
      qtyByIndex.set(r.index, qty);
      returnedItems.push({
        product: it.product,
        code: it.code,
        name: it.name,
        category: it.category,
        mode: it.mode,
        qty,
        lengthM: it.lengthM ?? undefined,
        barLengthM: it.barLengthM ?? undefined,
        widthM: it.widthM ?? undefined,
        heightM: it.heightM ?? undefined,
        unitPrice: it.unitPrice,
        subtotal: qty === it.qty ? it.subtotal : returnedLineValue(it.unitPrice, qty),
        detail: it.detail,
        saleItemIndex: r.index,
      });
    }
  } else {
    if (!input.returnedLines.length) throw new HttpError(400, "Agrega los productos que regresa el cliente.");
    returnedItems = (await buildItems(input.returnedLines, customerType)).map((x) => ({ ...x, saleItemIndex: null }));
  }
  const returnedTotal = round2(returnedItems.reduce((a, x) => a + (x.subtotal as number), 0));

  // Lo nuevo que se lleva (precio actual)
  const newItems = input.newItems.length ? await buildItems(input.newItems, customerType) : [];
  const newTotal = round2(newItems.reduce((a, x) => a + x.subtotal, 0));
  if (input.mode === "cortesia" && !newItems.length) {
    throw new HttpError(400, "La cortesía es para cambios. Si solo regresa producto sin reembolso, elige «Cobrar lo nuevo completo».");
  }

  // 3. Diferencia
  const balance = sale?.balance ?? 0;
  const st = settleReturn({ returnedTotal, newTotal, mode: input.mode, balance });
  let charge: ReturnType<typeof makePayment> | null = null;
  if (st.charge > 0) {
    if (!input.paymentMethod) throw new HttpError(400, "Elige cómo paga el cliente.");
    charge = makePayment(st.charge, input.paymentMethod, input.commissionPct, input.cashReceived, user.name);
  }

  // Cliente: el de la venta, o el capturado (se registra solo si trae nombre, como en el mostrador).
  const customer = sale ? null : await resolveCustomer({ customerId: input.customerId, customerName: input.customerName, customerPhone: input.customerPhone, customerType });
  const id = new Types.ObjectId();
  const folio = await nextReturnFolio();

  // 4. Venta original: cantidades devueltas y saldo (atómico: si alguien devolvió o abonó en paralelo, se rechaza).
  if (sale) {
    const prevReturned = sale.returnedTotal ?? 0;
    const set: Record<string, unknown> = {};
    for (const [i, q] of qtyByIndex) set[`items.${i}.returnedQty`] = round2((sale.items[i].returnedQty ?? 0) + q);
    const inc: Record<string, number> = { returnedTotal: returnedTotal };
    if (st.appliedToBalance > 0) {
      inc.balance = -st.appliedToBalance;
      set.paymentStatus = round2(balance - st.appliedToBalance) > 0 ? "parcial" : "pagada";
    }
    const updated = await Sale.findOneAndUpdate(
      { _id: sale._id, status: { $ne: "cancelada" }, returnedTotal: sameOrMissing(prevReturned), balance: sameOrMissing(balance) },
      { $set: set, $inc: inc, $push: { returns: { _id: id, folio, at: new Date(), outcome: st.outcome } } },
      { new: true },
    );
    if (!updated) throw new HttpError(409, "La venta cambió mientras registrabas la devolución. Vuelve a abrirla.");
  }

  try {
    return await Return.create({
      _id: id,
      folio,
      sale: sale?._id ?? null,
      saleFolio: sale?.folio ?? "",
      quoteFolio: sale?.fromQuoteFolio ?? "",
      saleDate: sale?.createdAt ?? null,
      customer: sale ? (sale.customer ?? null) : (customer?._id ?? null),
      customerName: sale ? sale.customerName || input.customerName : (customer?.name ?? input.customerName),
      customerPhone: sale ? sale.customerPhone || input.customerPhone : input.customerPhone || customer?.phone || "",
      customerType,
      returnedItems,
      returnedTotal,
      newItems,
      newTotal,
      mode: input.mode,
      outcome: st.outcome,
      difference: st.difference,
      charge: charge
        ? { amount: charge.amount, method: charge.method, commissionPct: charge.commissionPct, commissionAmount: charge.commissionAmount, cashReceived: charge.cashReceived, change: charge.change }
        : null,
      chargeAmount: st.charge,
      commissionAmount: charge?.commissionAmount ?? 0,
      refundAmount: st.refund,
      appliedToBalance: st.appliedToBalance,
      waivedAmount: st.waived,
      notRefundedAmount: st.notRefunded,
      reason: input.reason,
      notes: input.notes,
      user: user.id,
      userName: user.name,
    });
  } catch (e) {
    // No se pudo guardar la devolución: se deshace lo marcado en la venta.
    if (sale) {
      const unset: Record<string, unknown> = {};
      for (const [i] of qtyByIndex) unset[`items.${i}.returnedQty`] = sale.items[i].returnedQty ?? 0;
      await Sale.updateOne(
        { _id: sale._id },
        { $set: { ...unset, paymentStatus: sale.paymentStatus ?? null }, $inc: { returnedTotal: -returnedTotal, balance: st.appliedToBalance }, $pull: { returns: { _id: id } } },
      );
    }
    throw e;
  }
}
