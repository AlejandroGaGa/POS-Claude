// Fechas del negocio en hora del centro de México (sin horario de verano desde 2022).
const TZ = process.env.NEXT_PUBLIC_TZ || "America/Mexico_City";
const OFFSET = process.env.NEXT_PUBLIC_TZ_OFFSET || "-06:00";

/** "YYYY-MM-DD" del día de hoy (o de la fecha dada) en la zona del negocio. */
export function dayStr(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function isDayStr(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Inicio del día (inclusive) como Date UTC. */
export function startOfDay(s: string): Date {
  return new Date(`${s}T00:00:00${OFFSET}`);
}

/** Rango [desde, hasta) para dos fechas "YYYY-MM-DD" inclusivas. */
export function range(from: string, to: string): { $gte: Date; $lt: Date } {
  const end = startOfDay(to);
  end.setUTCDate(end.getUTCDate() + 1);
  return { $gte: startOfDay(from), $lt: end };
}

export function addDays(s: string, days: number): string {
  const d = startOfDay(s);
  d.setUTCDate(d.getUTCDate() + days);
  return dayStr(d);
}
