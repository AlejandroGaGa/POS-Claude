import { lineSignature, type LineInput } from "./pricing";

/** Lo mínimo que necesita la fusión de renglones del carrito. */
export interface MergeableLine {
  key: string;
  product: { _id: string };
  input: LineInput;
}

/**
 * Agrega (o reemplaza, si se editó) un renglón en el carrito. Si ya existe otro renglón del mismo
 * producto con la misma forma de venta y medida (misma tira, mismo tramo, misma hoja o corte),
 * suma la cantidad a ese renglón en lugar de crear uno nuevo. `reprice` recalcula el renglón
 * con la cantidad sumada; si falla, se conserva como renglón aparte.
 */
export function upsertLine<T extends MergeableLine>(cart: T[], line: T, reprice: (l: T) => T): { cart: T[]; mergedInto: string | null } {
  const sig = lineSignature(line.product._id, line.input);
  const twin = cart.find((x) => x.key !== line.key && lineSignature(x.product._id, x.input) === sig);
  if (twin) {
    const qty = Math.round((twin.input.qty + line.input.qty) * 1000) / 1000;
    try {
      const merged = reprice({ ...twin, input: { ...twin.input, qty } });
      // Si era una edición, el renglón editado desaparece porque ya quedó sumado al otro.
      return { cart: cart.filter((x) => x.key !== line.key).map((x) => (x.key === twin.key ? merged : x)), mergedInto: twin.key };
    } catch {
      /* cantidad inválida al sumar: se deja como renglón aparte */
    }
  }
  const exists = cart.some((x) => x.key === line.key);
  return { cart: exists ? cart.map((x) => (x.key === line.key ? line : x)) : [...cart, line], mergedInto: null };
}
