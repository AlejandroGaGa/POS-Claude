import type { LineInput, ProductPricing } from "./pricing";
import type { ProductJSON } from "./types";

/**
 * Producto fuera de catálogo: algo que se vende en una nota con el nombre y el precio que
 * captura el vendedor, sin darlo de alta. Vive solo en esa venta o cotización: no aparece en
 * la lista de precios ni en las búsquedas.
 *
 * En el carrito se maneja como un producto «de mentiras» (con `custom: true` y un `_id` que
 * empieza con "custom:"), para que cantidades, totales y ajustes funcionen igual que con el
 * catálogo. Al guardar viaja al servidor como `{ custom: { name, price, unitLabel } }`.
 */
export const CUSTOM_MODES = ["pieza", "kg", "metro"] as const;
export type CustomMode = (typeof CUSTOM_MODES)[number];
export const CUSTOM_MODE_LABELS: Record<CustomMode, string> = { pieza: "Pieza", kg: "Kilo", metro: "Metro" };
/** Categoría con la que quedan en la nota y en las estadísticas. */
export const CUSTOM_CATEGORY = "Fuera de catálogo";
export const CUSTOM_ID_PREFIX = "custom:";
export const CUSTOM_MAX_PRICE = 1_000_000;

export interface CustomItem {
  name: string;
  /** Precio por pieza, kilo o metro. */
  price: number;
  /** Solo por pieza: cómo se le dice a la unidad (pza, caja, juego…). */
  unitLabel?: string;
}

export const isCustomMode = (mode: string): mode is CustomMode => (CUSTOM_MODES as readonly string[]).includes(mode);
export const isCustomProduct = (p: { _id: string; custom?: boolean }) => !!p.custom || p._id.startsWith(CUSTOM_ID_PREFIX);

/** Campos de precio equivalentes: el renglón se calcula con las mismas reglas que un producto del catálogo. */
export function customPricing(item: CustomItem, mode: CustomMode): ProductPricing {
  return { unitType: mode, unitLabel: mode === "pieza" ? item.unitLabel?.trim() || "pza" : mode === "kg" ? "kg" : "m", price: item.price };
}

/** El producto «de mentiras» que va en el carrito. `id` lo distingue de otros renglones fuera de catálogo. */
export function customProduct(item: CustomItem, mode: CustomMode, id: string): ProductJSON {
  return { _id: `${CUSTOM_ID_PREFIX}${id}`, code: "", name: item.name.trim(), category: CUSTOM_CATEGORY, active: true, custom: true, ...customPricing(item, mode) };
}

/** Un renglón del carrito tal como se manda al servidor: del catálogo (por id) o fuera de catálogo (con sus datos). */
export function lineToPayload(line: { product: ProductJSON; input: LineInput }) {
  const p = line.product;
  return isCustomProduct(p) ? { custom: { name: p.name, price: p.price ?? 0, unitLabel: p.unitLabel }, ...line.input } : { productId: p._id, ...line.input };
}

/** Un renglón guardado que no viene del catálogo → sus datos, para volver a calcularlo o editarlo. */
export function customFromStored(it: { name?: string | null; mode: string; detail?: string | null; unitPrice: number; listUnitPrice?: number | null }): CustomItem {
  return { name: it.name || "Producto", price: it.listUnitPrice ?? it.unitPrice, unitLabel: it.mode === "pieza" ? it.detail || undefined : undefined };
}
