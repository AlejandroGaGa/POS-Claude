/**
 * Lógica de precios del mostrador. Funciones puras: se usan igual en el
 * navegador (para mostrar totales al instante) y en el servidor (que siempre
 * recalcula con los precios de la base de datos antes de guardar).
 */

export const UNIT_TYPES = ["pieza", "kg", "metro", "perfil", "vidrio"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const SALE_MODES = ["pieza", "kg", "metro", "tira", "tramo", "hoja", "m2"] as const;
export type SaleMode = (typeof SALE_MODES)[number];

export const PAYMENT_METHODS = ["efectivo", "transferencia", "terminal"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  pieza: "Por pieza / unidad",
  kg: "Por kilo",
  metro: "Por metro lineal",
  perfil: "Perfil de aluminio (tira y tramo)",
  vidrio: "Vidrio / cristal (hoja y m²)",
};

export const MODE_LABELS: Record<SaleMode, string> = {
  pieza: "Pieza",
  kg: "Kilos",
  metro: "Metros",
  tira: "Tira completa",
  tramo: "Tramo (corte)",
  hoja: "Hoja completa",
  m2: "Medida (m²)",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  terminal: "Terminal (tarjeta)",
};

export const CUSTOMER_TYPES = ["particular", "vidriero"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export const CUSTOMER_LABELS: Record<CustomerType, string> = { particular: "Particular", vidriero: "Vidriero" };

export const DEFAULT_MIN_CUT_M = 0.5;
export const MAX_COMMISSION_PCT = 20;

export interface Bar {
  lengthM: number;
  price: number;
}

export interface Sheet {
  widthM: number;
  heightM: number;
  price: number;
}

/** Los campos de precio de un producto. */
export interface ProductPricing {
  unitType: UnitType;
  unitLabel?: string;
  price?: number | null; // pieza, kg, metro
  pricePerMeter?: number | null; // perfil: tramos
  bars?: Bar[]; // perfil: tiras completas
  minCutM?: number | null; // perfil: tramo mínimo
  pricePerM2?: number | null; // vidrio: por medida, cliente particular
  pricePerM2Vidriero?: number | null; // vidrio: por medida, cliente vidriero
  sheets?: Sheet[]; // vidrio: hojas completas (pueden ser varios tamaños)
}

/** Lo que captura el vendedor para un renglón. */
export interface LineInput {
  mode: SaleMode;
  qty: number;
  lengthM?: number; // tramo
  barLengthM?: number; // tira
  widthM?: number; // m2 (medida) u hoja (tamaño elegido)
  heightM?: number; // m2 (medida) u hoja (tamaño elegido)
}

export interface PriceOptions {
  /** Tipo de cliente: cambia el precio por m² del vidrio. */
  customerType?: CustomerType;
}

export interface PricedLine {
  mode: SaleMode;
  qty: number;
  lengthM?: number;
  barLengthM?: number;
  widthM?: number;
  heightM?: number;
  unitPrice: number;
  subtotal: number;
  /** Texto corto para la nota, p. ej. "Tramo 1.25 m" o "0.80 × 1.20 m (0.96 m²)". */
  detail: string;
}

export class PricingError extends Error {
  name = "PricingError";
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
}

export function formatNumber(n: number, maxDecimals = 3): string {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: maxDecimals }).format(n);
}

/** Medidas en metros con 2 decimales: 6.10, 1.80 × 2.60. */
export function formatM(n: number): string {
  return new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function positive(n: number | undefined | null): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function sameLength(a: number, b: number) {
  return Math.abs(a - b) < 0.001;
}

/** Formas de venta disponibles para un producto según sus precios capturados. */
export function availableModes(p: ProductPricing): SaleMode[] {
  switch (p.unitType) {
    case "pieza":
      return positive(p.price) ? ["pieza"] : [];
    case "kg":
      return positive(p.price) ? ["kg"] : [];
    case "metro":
      return positive(p.price) ? ["metro"] : [];
    case "perfil": {
      const m: SaleMode[] = [];
      if (p.bars?.some((b) => positive(b.price))) m.push("tira");
      if (positive(p.pricePerMeter)) m.push("tramo");
      return m;
    }
    case "vidrio": {
      const m: SaleMode[] = [];
      if (p.sheets?.some((s) => positive(s.price))) m.push("hoja");
      if (positive(p.pricePerM2) || positive(p.pricePerM2Vidriero)) m.push("m2");
      return m;
    }
  }
}

function requireQty(qty: number, integer: boolean, label: string) {
  if (!positive(qty)) throw new PricingError(`La cantidad de ${label} debe ser mayor a 0.`);
  if (integer && !Number.isInteger(qty)) throw new PricingError(`La cantidad de ${label} debe ser un número entero.`);
}

/** Calcula precio unitario y subtotal de un renglón. Lanza PricingError si algo no cuadra. */
export function priceLine(p: ProductPricing, input: LineInput, opts: PriceOptions = {}): PricedLine {
  const modes = availableModes(p);
  if (!modes.includes(input.mode)) {
    throw new PricingError(`Este producto no se vende como "${MODE_LABELS[input.mode] ?? input.mode}".`);
  }
  const unit = p.unitLabel || "pza";

  switch (input.mode) {
    case "pieza": {
      requireQty(input.qty, true, "piezas");
      const unitPrice = round2(p.price!);
      return { mode: "pieza", qty: input.qty, unitPrice, subtotal: round2(unitPrice * input.qty), detail: unit };
    }
    case "kg": {
      requireQty(input.qty, false, "kilos");
      const qty = Math.round(input.qty * 1000) / 1000;
      const unitPrice = round2(p.price!);
      return { mode: "kg", qty, unitPrice, subtotal: round2(unitPrice * qty), detail: "kg" };
    }
    case "metro": {
      requireQty(input.qty, false, "metros");
      const qty = Math.round(input.qty * 1000) / 1000;
      const unitPrice = round2(p.price!);
      return { mode: "metro", qty, unitPrice, subtotal: round2(unitPrice * qty), detail: "m" };
    }
    case "tira": {
      requireQty(input.qty, true, "tiras");
      const bar = p.bars?.find((b) => input.barLengthM !== undefined && sameLength(b.lengthM, input.barLengthM));
      if (!bar || !positive(bar.price)) throw new PricingError("Elige un largo de tira válido.");
      const unitPrice = round2(bar.price);
      return {
        mode: "tira",
        qty: input.qty,
        barLengthM: bar.lengthM,
        unitPrice,
        subtotal: round2(unitPrice * input.qty),
        detail: `Tira de ${formatM(bar.lengthM)} m`,
      };
    }
    case "tramo": {
      requireQty(input.qty, true, "tramos");
      const minCut = positive(p.minCutM) ? p.minCutM : DEFAULT_MIN_CUT_M;
      const len = input.lengthM;
      if (!positive(len)) throw new PricingError("Captura el largo del tramo.");
      const lengthM = Math.round(len * 1000) / 1000;
      if (lengthM + 1e-9 < minCut) {
        throw new PricingError(`El tramo mínimo es de ${formatNumber(minCut * 100, 0)} cm.`);
      }
      const maxBar = Math.max(0, ...(p.bars ?? []).map((b) => b.lengthM));
      if (maxBar > 0 && lengthM > maxBar + 1e-9) {
        throw new PricingError(`El tramo no puede medir más que la tira más larga (${formatM(maxBar)} m).`);
      }
      const unitPrice = round2(lengthM * p.pricePerMeter!);
      return {
        mode: "tramo",
        qty: input.qty,
        lengthM,
        unitPrice,
        subtotal: round2(unitPrice * input.qty),
        detail: `Tramo de ${formatNumber(lengthM, 3)} m`,
      };
    }
    case "hoja": {
      requireQty(input.qty, true, "hojas");
      const valid = (p.sheets ?? []).filter((x) => positive(x.price));
      // Si solo hay un tamaño se toma ese; si hay varios, el vendedor elige (base × altura).
      const s =
        valid.length === 1 && input.widthM === undefined
          ? valid[0]
          : valid.find((x) => input.widthM !== undefined && input.heightM !== undefined && sameLength(x.widthM, input.widthM) && sameLength(x.heightM, input.heightM));
      if (!s) throw new PricingError("Elige el tamaño de la hoja.");
      const unitPrice = round2(s.price);
      const dims = positive(s.widthM) && positive(s.heightM) ? ` ${formatM(s.widthM)} × ${formatM(s.heightM)} m` : "";
      return {
        mode: "hoja",
        qty: input.qty,
        widthM: s.widthM,
        heightM: s.heightM,
        unitPrice,
        subtotal: round2(unitPrice * input.qty),
        detail: `Hoja completa${dims}`,
      };
    }
    case "m2": {
      requireQty(input.qty, true, "piezas");
      if (!positive(input.widthM) || !positive(input.heightM)) throw new PricingError("Captura base y altura.");
      const widthM = Math.round(input.widthM * 1000) / 1000;
      const heightM = Math.round(input.heightM * 1000) / 1000;
      const sized = (p.sheets ?? []).filter((x) => positive(x.widthM) && positive(x.heightM));
      if (sized.length) {
        const fits = sized.some(
          (s) =>
            (widthM <= s.widthM + 1e-9 && heightM <= s.heightM + 1e-9) ||
            (widthM <= s.heightM + 1e-9 && heightM <= s.widthM + 1e-9),
        );
        if (!fits) {
          const biggest = sized.reduce((a, b) => (a.widthM * a.heightM >= b.widthM * b.heightM ? a : b));
          throw new PricingError(
            `La medida no cabe en la hoja más grande (${formatM(biggest.widthM)} × ${formatM(biggest.heightM)} m).`,
          );
        }
      }
      const tier = opts.customerType ?? "particular";
      const rate = m2Rate(p, tier);
      const area = Math.round(widthM * heightM * 10000) / 10000;
      const unitPrice = round2(area * rate);
      return {
        mode: "m2",
        qty: input.qty,
        widthM,
        heightM,
        unitPrice,
        subtotal: round2(unitPrice * input.qty),
        detail: `${formatNumber(widthM, 3)} × ${formatNumber(heightM, 3)} m (${formatNumber(area, 4)} m²)${tier === "vidriero" && positive(p.pricePerM2Vidriero) ? " · precio vidriero" : ""}`,
      };
    }
  }
}

/** Precio por m² según el tipo de cliente (si falta uno, usa el otro). */
export function m2Rate(p: ProductPricing, tier: CustomerType): number {
  if (tier === "vidriero" && positive(p.pricePerM2Vidriero)) return p.pricePerM2Vidriero;
  if (positive(p.pricePerM2)) return p.pricePerM2;
  return p.pricePerM2Vidriero ?? 0;
}

export interface Totals {
  subtotal: number;
  commissionPct: number;
  commissionAmount: number;
  total: number;
}

/** Suma renglones y aplica la comisión solo cuando el pago es con terminal. */
export function computeTotals(lines: { subtotal: number }[], method: PaymentMethod | null, commissionPct: number): Totals {
  const subtotal = round2(lines.reduce((acc, l) => acc + l.subtotal, 0));
  if (method !== "terminal") return { subtotal, commissionPct: 0, commissionAmount: 0, total: subtotal };
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > MAX_COMMISSION_PCT) {
    throw new PricingError(`La comisión debe estar entre 0% y ${MAX_COMMISSION_PCT}%.`);
  }
  const pct = Math.round(commissionPct * 100) / 100;
  const commissionAmount = round2((subtotal * pct) / 100);
  return { subtotal, commissionPct: pct, commissionAmount, total: round2(subtotal + commissionAmount) };
}

/** Aplica un ajuste porcentual y redondea al múltiplo indicado (0 = solo centavos). */
export function adjustPrice(price: number, pct: number, roundTo: number): number {
  const raw = price * (1 + pct / 100);
  if (roundTo > 0) return round2(Math.round(raw / roundTo) * roundTo);
  return round2(raw);
}

/**
 * Identifica un renglón por producto + forma de venta + medidas (sin la cantidad).
 * Sirve para respetar el precio cotizado cuando se edita una cotización vigente.
 */
export function lineSignature(productId: string, l: { mode: string; barLengthM?: number | null; lengthM?: number | null; widthM?: number | null; heightM?: number | null }): string {
  const r = (n?: number | null) => (n == null ? "" : String(Math.round(n * 1000) / 1000));
  return [productId, l.mode, r(l.barLengthM), r(l.lengthM), r(l.widthM), r(l.heightM)].join("|");
}

/** Aplica un precio unitario fijo (el cotizado) a un renglón ya calculado. */
export function withUnitPrice<T extends { qty: number; unitPrice: number; subtotal: number }>(line: T, unitPrice: number): T {
  return { ...line, unitPrice, subtotal: round2(unitPrice * line.qty) };
}

/** Un pago o abono: `amount` baja el saldo; en terminal se cobra además la comisión sobre ese monto. */
export function paymentLine(amount: number, method: PaymentMethod, commissionPct: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new PricingError("El monto del pago debe ser mayor a 0.");
  const t = computeTotals([{ subtotal: amount }], method, commissionPct);
  return { amount: t.subtotal, method, commissionPct: t.commissionPct, commissionAmount: t.commissionAmount, received: t.total };
}
