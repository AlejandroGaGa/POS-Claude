import type { Query } from "mongoose";

export const PAGE_SIZE = 25;

/** Lee ?pagina= de la URL (1 por defecto). */
export function parsePage(v: string | string[] | null | undefined): number {
  const n = Number.parseInt(String(Array.isArray(v) ? v[0] : (v ?? "1")), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 1;
}

/**
 * Paginación con MongoDB: skip/limit sobre la consulta ya ordenada + countDocuments del mismo filtro.
 * Para el volumen de un negocio (miles de registros) es lo más simple y rápido; si una lista creciera
 * a cientos de miles convendría paginar por cursor (_id / fecha).
 */
export async function paginate<T>(
  query: Query<T[], unknown>,
  count: Promise<number> | Query<number, unknown>,
  page: number,
  pageSize = PAGE_SIZE,
): Promise<{ rows: T[]; total: number; page: number; pageSize: number; pages: number }> {
  const [rows, total] = await Promise.all([query.skip((page - 1) * pageSize).limit(pageSize).lean<T[]>().exec() as Promise<T[]>, count]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return { rows, total, page, pageSize, pages };
}
