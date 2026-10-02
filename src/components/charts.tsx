"use client";
import { motion } from "framer-motion";
import { EASE_OUT } from "./motion";
import { formatMoney } from "@/lib/pricing";

/** Barras horizontales de una sola serie (color de acento, texto en tinta normal). */
export function HBars({ rows, label }: { rows: { name: string; value: number; extra?: string }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-muted">Sin datos en este periodo.</p>;
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.name} title={`${r.name}: ${formatMoney(r.value)}${r.extra ? ` · ${r.extra}` : ""}`}>
          <div className="mb-1 flex flex-wrap justify-between gap-x-2 text-sm">
            <span className="min-w-0 font-medium">{r.name}</span>
            <span className="font-semibold tabular">{formatMoney(r.value)}</span>
            {r.extra && <span className="w-full text-muted">{r.extra}</span>}
          </div>
          <div className="h-2 rounded-full bg-default">
            <motion.div
              className="h-2 rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.05 + i * 0.05 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Columnas por día con tooltip al pasar el mouse o enfocar con teclado. */
export function DailyColumns({ days }: { days: { day: string; total: number; count: number }[] }) {
  if (!days.length) return <p className="text-muted">Sin ventas en este periodo.</p>;
  const max = Math.max(1, ...days.map((d) => d.total));
  const fmtDay = (s: string) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`));
  const step = Math.ceil(days.length / 5);
  return (
    <div>
      <div className="flex h-52 items-end gap-[3px] border-b border-separator" role="list" aria-label="Ventas por día">
        {days.map((d, i) => (
          <div key={d.day} role="listitem" tabIndex={0} className="group relative flex h-full min-w-0 flex-1 items-end focus:outline-none" aria-label={`${fmtDay(d.day)}: ${formatMoney(d.total)}, ${d.count} venta(s)`}>
            <motion.div
              className="w-full origin-bottom rounded-t-md bg-accent/85 transition-colors group-hover:bg-accent group-focus:bg-accent"
              style={{ height: d.total > 0 ? `${Math.max(2, (d.total / max) * 100)}%` : 0 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: Math.min(0.4, i * 0.012) }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-xl bg-overlay px-3 py-1.5 text-sm whitespace-nowrap shadow-[var(--overlay-shadow)] group-hover:block group-focus:block">
              <span className="font-semibold">{fmtDay(d.day)}</span> · {formatMoney(d.total)} · {d.count} venta(s)
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px] text-xs text-muted">
        {days.map((d, i) => (
          <span key={d.day} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {i % step === 0 ? fmtDay(d.day) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
