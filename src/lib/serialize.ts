/** Convierte documentos lean de Mongo (ObjectId, Date) en JSON plano para client components. */
export function plain<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc));
}
