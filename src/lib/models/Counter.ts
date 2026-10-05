import { Schema, model, models, type Model } from "mongoose";

const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter: Model<{ _id: string; seq: number }> = models.Counter || model("Counter", CounterSchema);

/** Folio consecutivo atómico, p. ej. V-000123 / C-000045. */
export async function nextFolio(kind: "venta" | "cotizacion"): Promise<string> {
  const c = await Counter.findByIdAndUpdate(kind, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${kind === "venta" ? "V" : "C"}-${String(c!.seq).padStart(6, "0")}`;
}

/** Folio consecutivo de devoluciones y cambios, p. ej. D-000007. */
export async function nextReturnFolio(): Promise<string> {
  const c = await Counter.findByIdAndUpdate("devolucion", { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `D-${String(c!.seq).padStart(6, "0")}`;
}

/** Folio consecutivo de cortes de caja, p. ej. CC-000012. */
export async function nextCutFolio(): Promise<string> {
  const c = await Counter.findByIdAndUpdate("corte", { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `CC-${String(c!.seq).padStart(6, "0")}`;
}
