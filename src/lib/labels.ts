export const STATUS_LABEL: Record<string, string> = { vigente: "Vigente", convertida: "Convertida", cancelada: "Cancelada" };
export const STATUS_TONE: Record<string, "ok" | "accent" | "bad"> = { vigente: "ok", convertida: "accent", cancelada: "bad" };

export function fmtDate(d: string | Date | null | undefined, withTime = true) {
  if (!d) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: process.env.NEXT_PUBLIC_TZ || "America/Mexico_City",
  }).format(new Date(d));
}
