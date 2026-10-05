import "server-only";
import { Sale } from "./models/Sale";
import { CashCut, CashMovement, type CashBox } from "./models/Cash";
import { Return } from "./models/Return";
import { dayStr, startOfDay } from "./dates";
import { round2, type PaymentMethod } from "./pricing";

export interface PeriodSummary {
  from: Date;
  to: Date;
  openingFloat: number;
  cashSales: number;
  cashPayments: number;
  /** Diferencias cobradas en efectivo por cambios. */
  returnCharges: number;
  /** Efectivo regresado a clientes por devoluciones. */
  refunds: number;
  returnsCount: number;
  entries: number;
  exits: number;
  expected: number;
  byMethod: Record<PaymentMethod, number>;
  commissions: number;
  salesCount: number;
  pendingCredit: number; // saldo que quedó a crédito en el periodo
  lastCutFolio: string | null;
}

/** Inicio del periodo actual: el último corte, o el inicio del día si nunca se ha hecho uno. */
export async function lastCut() {
  return CashCut.findOne().sort({ to: -1 }).lean();
}

/**
 * Lo que pasó por caja entre dos momentos: pagos de ventas (incluye abonos) por método
 * y movimientos manuales de la caja de mostrador. Las ventas canceladas no cuentan.
 */
export async function periodSummary(to = new Date()): Promise<PeriodSummary> {
  const cut = await lastCut();
  const from = cut ? new Date(cut.to) : startOfDay(dayStr());
  const openingFloat = cut?.leftFloat ?? 0;

  const sales = await Sale.find({
    kind: "venta",
    status: { $ne: "cancelada" },
    $or: [{ "payments.at": { $gt: from, $lte: to } }, { createdAt: { $gt: from, $lte: to } }],
  })
    .select("payments paymentMethod total commissionAmount createdAt balance")
    .lean();

  const byMethod: Record<PaymentMethod, number> = { efectivo: 0, transferencia: 0, terminal: 0 };
  let cashSales = 0;
  let cashPayments = 0;
  let commissions = 0;
  let salesCount = 0;
  let pendingCredit = 0;
  for (const s of sales) {
    const created = new Date(s.createdAt);
    const inPeriod = created > from && created <= to;
    if (inPeriod) {
      salesCount++;
      pendingCredit += s.balance ?? 0;
    }
    if (!s.payments?.length) {
      // Ventas anteriores al registro de pagos: un pago por el total al crearse.
      if (inPeriod && s.paymentMethod) {
        byMethod[s.paymentMethod as PaymentMethod] += s.total;
        commissions += s.commissionAmount ?? 0;
        if (s.paymentMethod === "efectivo") cashSales += s.total;
      }
      continue;
    }
    s.payments.forEach((p, i) => {
      const at = new Date(p.at ?? s.createdAt);
      if (!(at > from && at <= to)) return;
      const received = round2(p.amount + (p.commissionAmount ?? 0));
      byMethod[p.method as PaymentMethod] += received;
      commissions += p.commissionAmount ?? 0;
      if (p.method === "efectivo") {
        if (i === 0) cashSales += received;
        else cashPayments += received;
      }
    });
  }

  // Devoluciones y cambios: lo cobrado de diferencia entra por su método; lo regresado sale del efectivo.
  const returns = await Return.find({ createdAt: { $gt: from, $lte: to } }).select("charge refundAmount").lean();
  let returnCharges = 0;
  let refunds = 0;
  for (const r of returns) {
    refunds += r.refundAmount ?? 0;
    if (r.charge?.amount) {
      const received = round2(r.charge.amount + (r.charge.commissionAmount ?? 0));
      byMethod[r.charge.method as PaymentMethod] += received;
      commissions += r.charge.commissionAmount ?? 0;
      if (r.charge.method === "efectivo") returnCharges += received;
    }
  }

  const moves = await CashMovement.find({ box: "caja", createdAt: { $gt: from, $lte: to } }).select("type amount").lean();
  const entries = moves.filter((m) => m.type === "entrada").reduce((a, m) => a + m.amount, 0);
  const exits = moves.filter((m) => m.type === "salida").reduce((a, m) => a + m.amount, 0);

  return {
    from,
    to,
    openingFloat: round2(openingFloat),
    cashSales: round2(cashSales),
    cashPayments: round2(cashPayments),
    returnCharges: round2(returnCharges),
    refunds: round2(refunds),
    returnsCount: returns.length,
    entries: round2(entries),
    exits: round2(exits),
    expected: round2(openingFloat + cashSales + cashPayments + returnCharges - refunds + entries - exits),
    byMethod: { efectivo: round2(byMethod.efectivo), transferencia: round2(byMethod.transferencia), terminal: round2(byMethod.terminal) },
    commissions: round2(commissions),
    salesCount,
    pendingCredit: round2(pendingCredit),
    lastCutFolio: cut?.folio ?? null,
  };
}

/** Saldo de una caja sumando todos sus movimientos (la caja chica no depende de cortes). */
export async function boxBalance(box: CashBox): Promise<number> {
  const moves = await CashMovement.find({ box }).select("type amount").lean();
  return round2(moves.reduce((a, m) => a + (m.type === "entrada" ? m.amount : -m.amount), 0));
}
