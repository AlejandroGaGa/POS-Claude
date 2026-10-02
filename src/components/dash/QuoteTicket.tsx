import Link from "next/link";
import { formatMoney, formatNumber } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { cx } from "../ui";
import Icon from "../Icon";

export interface QuoteTicketData {
  _id: string;
  folio: string;
  customerName?: string;
  sellerName?: string;
  total: number;
  createdAt: string;
  validUntil?: string;
  customerType?: string;
  items: { name: string; qty: number; detail?: string }[];
}

/** Cotización pendiente con look de "ticket" (bordes dentados como la referencia). */
export default function QuoteTicket({ q, compact = false }: { q: QuoteTicketData; compact?: boolean }) {
  const expired = q.validUntil ? new Date(q.validUntil).getTime() < Date.now() : false;
  const shown = compact ? q.items.slice(0, 3) : q.items;
  return (
    <Link
      href={`/cotizaciones/${q._id}`}
      className="group block rounded-2xl bg-surface-secondary p-1 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-focus hover:-translate-y-0.5"
    >
      <div
        className="rounded-xl bg-surface px-4 pt-4 pb-3"
        style={{
          maskImage: "radial-gradient(circle at 8px 0, transparent 5px, #000 5.5px)",
          maskSize: "16px 100%",
          maskRepeat: "repeat-x",
          WebkitMaskImage: "radial-gradient(circle at 8px 0, transparent 5px, #000 5.5px)",
          WebkitMaskSize: "16px 100%",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display truncate text-lg">{q.customerName || "Mostrador"}</p>
            <p className="text-sm text-muted tabular">{q.folio}</p>
          </div>
          <span
            className={cx(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              expired ? "bg-warning-soft text-warning-soft-foreground" : "bg-accent text-accent-foreground",
            )}
          >
            {expired ? "Vencida" : "Vigente"}
          </span>
        </div>
        <ul className="mt-3 flex flex-col gap-2 border-t border-dashed border-separator pt-3">
          {shown.map((it, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{it.name}</p>
                {it.detail && <p className="truncate text-sm text-muted">{it.detail}</p>}
              </div>
              <span className="text-sm font-semibold tabular">×{formatNumber(it.qty)}</span>
            </li>
          ))}
          {compact && q.items.length > 3 && <li className="text-sm text-muted">+{q.items.length - 3} más</li>}
        </ul>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
        <span className="flex items-center gap-1.5 text-muted">
          <Icon name="clock" className="size-4" />
          {fmtDate(q.createdAt)}
        </span>
        <span className="font-semibold tabular">{formatMoney(q.total)}</span>
      </div>
    </Link>
  );
}
