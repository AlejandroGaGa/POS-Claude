/**
 * Devoluciones y cambios. Funciones puras: se usan igual en el navegador (para mostrar la
 * diferencia al instante) y en el servidor (que recalcula todo antes de guardar).
 *
 * - Lo devuelto se acredita al precio que el cliente PAGÓ (el de la nota original), no al de hoy.
 * - Lo nuevo que se lleva entra a precio ACTUAL.
 * - La comisión de terminal de la venta original no se regresa (fue un cargo del banco).
 */
import { round2 } from "./pricing";

/** Cómo se resuelve la diferencia entre lo devuelto y lo nuevo. */
export const RETURN_MODES = ["diferencia", "cortesia", "cobrar_completo"] as const;
export type ReturnMode = (typeof RETURN_MODES)[number];

export const RETURN_MODE_LABELS: Record<ReturnMode, string> = {
  diferencia: "Con diferencia",
  cortesia: "Cambio sin diferencia (cortesía)",
  cobrar_completo: "Cobrar lo nuevo completo",
};

export const RETURN_MODE_HINTS: Record<ReturnMode, string> = {
  diferencia: "Se descuenta lo devuelto de lo nuevo: se cobra o se regresa solo la diferencia.",
  cortesia: "Se cambia el producto y no se cobra ni se regresa nada.",
  cobrar_completo: "Lo devuelto no se acredita: se cobra lo nuevo completo y no se regresa dinero.",
};

/** Resultado final de la devolución, para buscar y reportar «cómo se devolvió». */
export const RETURN_OUTCOMES = ["cobro", "reembolso", "abono_saldo", "parejo", "cortesia", "sin_reembolso"] as const;
export type ReturnOutcome = (typeof RETURN_OUTCOMES)[number];

export const RETURN_OUTCOME_LABELS: Record<ReturnOutcome, string> = {
  cobro: "Se cobró diferencia",
  reembolso: "Se regresó efectivo",
  abono_saldo: "Se abonó al saldo",
  parejo: "Cambio parejo",
  cortesia: "Cortesía",
  sin_reembolso: "Sin reembolso",
};

export const RETURN_OUTCOME_TONE: Record<ReturnOutcome, "ok" | "warn" | "accent" | "bad" | "neutral"> = {
  cobro: "ok",
  reembolso: "bad",
  abono_saldo: "accent",
  parejo: "neutral",
  cortesia: "warn",
  sin_reembolso: "neutral",
};

export interface SettleInput {
  /** Valor de lo devuelto (a precio pagado). */
  returnedTotal: number;
  /** Valor de lo nuevo que se lleva (a precio actual). */
  newTotal: number;
  mode: ReturnMode;
  /** Saldo pendiente de la venta original (cliente preferencial). Lo que se le deba se abona ahí primero. */
  balance?: number;
}

export interface Settlement {
  /** nuevo − devuelto. Positivo: el cliente debe; negativo: se le debe al cliente. */
  difference: number;
  /** Lo que se le cobra al cliente (sin comisión de terminal). */
  charge: number;
  /** Lo que se le regresa en efectivo de la caja. */
  refund: number;
  /** Lo que se descuenta del saldo pendiente de la venta original en vez de regresarlo. */
  appliedToBalance: number;
  /** Lo que absorbe el negocio (cortesía cuando lo nuevo vale más). */
  waived: number;
  /** Lo que el cliente deja sin que se le regrese (cortesía a favor del negocio o «cobrar completo»). */
  notRefunded: number;
  outcome: ReturnOutcome;
}

const pos = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/** Calcula cuánto se cobra, cuánto se regresa y qué queda registrado. */
export function settleReturn({ returnedTotal, newTotal, mode, balance }: SettleInput): Settlement {
  const ret = round2(pos(returnedTotal));
  const nuevo = round2(pos(newTotal));
  const difference = round2(nuevo - ret);
  const empty = { charge: 0, refund: 0, appliedToBalance: 0, waived: 0, notRefunded: 0 };

  if (mode === "cobrar_completo") {
    return { difference, ...empty, charge: nuevo, notRefunded: ret, outcome: nuevo > 0 ? "cobro" : "sin_reembolso" };
  }
  if (mode === "cortesia") {
    return {
      difference,
      ...empty,
      waived: difference > 0 ? difference : 0,
      notRefunded: difference < 0 ? -difference : 0,
      outcome: Math.abs(difference) < 0.005 ? "parejo" : "cortesia",
    };
  }
  // Con diferencia
  if (difference > 0.005) return { difference, ...empty, charge: difference, outcome: "cobro" };
  if (difference < -0.005) {
    const owed = -difference;
    const appliedToBalance = round2(Math.min(owed, pos(balance)));
    const refund = round2(owed - appliedToBalance);
    return { difference, ...empty, appliedToBalance, refund, outcome: refund > 0 ? "reembolso" : "abono_saldo" };
  }
  return { difference: 0, ...empty, outcome: "parejo" };
}

/** Valor de una parte de un renglón vendido: precio unitario pagado × cantidad devuelta. */
export function returnedLineValue(unitPrice: number, qty: number): number {
  return round2(unitPrice * qty);
}

/** Cantidad que todavía se puede devolver de un renglón. */
export function returnableQty(sold: number, alreadyReturned: number | null | undefined): number {
  return Math.max(0, Math.round((sold - (alreadyReturned ?? 0)) * 1000) / 1000);
}

/** "v123" / "V-000123" → "V-000123". null si no parece folio. */
export function normalizeFolio(q: string): { prefix: "V" | "C" | "D"; folio: string } | null {
  const m = q.trim().match(/^([vcd])\s*-?\s*0*(\d{1,9})$/i);
  if (!m) return null;
  const prefix = m[1].toUpperCase() as "V" | "C" | "D";
  return { prefix, folio: `${prefix}-${m[2].padStart(6, "0")}` };
}
