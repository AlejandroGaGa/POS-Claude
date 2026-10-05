/**
 * Ajustes de precio de una venta o cotización. Funciones puras (navegador y servidor).
 *
 * 1. «Cobrar de más» (oculto): se suma una cantidad extra y se reparte entre los productos
 *    subiendo sus precios unitarios (en pesos cerrados cuando se puede). En la nota NO aparece
 *    ningún renglón de ajuste: solo los precios ya repartidos.
 * 2. «Descuento especial» (visible): porcentaje sobre todo; en la nota sale como renglón.
 *
 * Cada renglón guarda:
 *  - listUnitPrice: precio de lista (interno, nunca se imprime)
 *  - shownUnitPrice / shownSubtotal: lo que se imprime en la nota (con el extra repartido, antes del descuento)
 *  - unitPrice / subtotal: lo que realmente paga (con extra y descuento) — base de cobros, saldos y devoluciones
 */
import { round2 } from "./pricing";

export const MAX_DISCOUNT_PCT = 90;

export interface AdjustOptions {
  /** Pesos de más a repartir en los precios (oculto). */
  extra?: number | null;
  /** Descuento especial en % (visible). */
  discountPct?: number | null;
}

export interface Adjusted<T> {
  lines: (T & { listUnitPrice: number; shownUnitPrice: number; shownSubtotal: number; unitPrice: number; subtotal: number })[];
  /** Suma a precio de lista. */
  baseSubtotal: number;
  /** Extra que quedó repartido (puede diferir unos centavos de lo pedido si no hay forma exacta). */
  extra: number;
  /** Suma de lo que se imprime (lista + extra). */
  shownSubtotal: number;
  discountPct: number;
  discountAmount: number;
  /** Lo que paga (antes de comisión de terminal). */
  subtotal: number;
}

type Line = { qty: number; unitPrice: number; subtotal: number };

const pos = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/** Redondeo «que no se note»: pesos cerrados; en precios menores a $10, a 50 centavos. */
function niceUnit(u: number): number {
  return u >= 10 ? Math.round(u) : Math.round(u * 2) / 2;
}

/** Reparte `extra` entre los renglones proporcionalmente a su importe. Devuelve los nuevos precios unitarios. */
function spreadExtra(lines: Line[], extra: number): number[] {
  const base = round2(lines.reduce((a, l) => a + l.subtotal, 0));
  if (extra <= 0 || base <= 0) return lines.map((l) => l.unitPrice);
  const factor = (base + extra) / base;
  const units = lines.map((l) => Math.max(l.unitPrice, niceUnit(l.unitPrice * factor)));
  const sum = () => round2(lines.reduce((a, l, i) => a + round2(units[i] * l.qty), 0));
  const target = round2(base + extra);
  let diff = round2(target - sum());
  if (Math.abs(diff) < 0.005) return units;

  // Cuadra la diferencia en un solo renglón, sin bajar ningún precio por debajo de la lista.
  const order = lines.map((l, i) => i).sort((a, b) => lines[b].subtotal - lines[a].subtotal);
  const fits = (i: number, step: number) => units[i] + step >= lines[i].unitPrice - 1e-9;
  // a) Un renglón de 1 pieza absorbe la diferencia exacta.
  let i = order.find((k) => lines[k].qty === 1 && fits(k, diff));
  if (i !== undefined) {
    units[i] = round2(units[i] + diff);
    return units;
  }
  // b) Un renglón donde la diferencia se reparte exacta por pieza (sin centavos sueltos).
  i = order.find((k) => {
    const step = round2(diff / lines[k].qty);
    return Math.abs(round2(step * lines[k].qty) - diff) < 0.005 && fits(k, step);
  });
  if (i !== undefined) {
    units[i] = round2(units[i] + diff / lines[i].qty);
    return units;
  }
  // c) Lo más cercano posible en el renglón más grande.
  i = order.find((k) => fits(k, round2(diff / lines[k].qty))) ?? order[0];
  units[i] = round2(units[i] + diff / lines[i].qty);
  diff = round2(target - sum());
  return units;
}

/** Aplica «cobrar de más» y descuento especial a renglones ya calculados con precio de lista. */
export function adjustLines<T extends Line & { listUnitPrice?: number }>(lines: T[], opts: AdjustOptions = {}): Adjusted<T> {
  const list = lines.map((l) => {
    const unit = l.listUnitPrice ?? l.unitPrice;
    return { ...l, unitPrice: unit, subtotal: round2(unit * l.qty) };
  });
  const baseSubtotal = round2(list.reduce((a, l) => a + l.subtotal, 0));
  const extraReq = round2(pos(opts.extra));
  const pct = Math.min(MAX_DISCOUNT_PCT, Math.round(pos(opts.discountPct) * 100) / 100);

  const units = spreadExtra(list, extraReq);
  const out = list.map((l, i) => {
    const shownUnitPrice = units[i];
    const shownSubtotal = round2(shownUnitPrice * l.qty);
    const unitPrice = pct ? round2(shownUnitPrice * (1 - pct / 100)) : shownUnitPrice;
    const subtotal = pct ? round2(shownSubtotal * (1 - pct / 100)) : shownSubtotal;
    return { ...l, listUnitPrice: l.unitPrice, shownUnitPrice, shownSubtotal, unitPrice, subtotal };
  });
  const shownSubtotal = round2(out.reduce((a, l) => a + l.shownSubtotal, 0));
  const subtotal = round2(out.reduce((a, l) => a + l.subtotal, 0));
  return {
    lines: out,
    baseSubtotal,
    extra: round2(shownSubtotal - baseSubtotal),
    shownSubtotal,
    discountPct: pct,
    discountAmount: round2(shownSubtotal - subtotal),
    subtotal,
  };
}

/** Lo que se imprime de un renglón guardado (ventas anteriores no traen los campos nuevos). */
export function shownLine(it: { unitPrice: number; subtotal: number; shownUnitPrice?: number | null; shownSubtotal?: number | null }) {
  return { unitPrice: it.shownUnitPrice ?? it.unitPrice, subtotal: it.shownSubtotal ?? it.subtotal };
}
