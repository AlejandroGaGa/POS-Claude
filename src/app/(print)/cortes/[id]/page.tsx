import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { CashCut } from "@/lib/models/Cash";
import { getSettings } from "@/lib/models/Settings";
import { formatMoney } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { Alert, btn } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import Icon from "@/components/Icon";
import { SiacMark } from "@/components/Logo";

export const metadata = { title: "Corte de caja" };

export default async function CutPrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  await requirePage("cash:cut");
  const { id } = await params;
  const { nuevo } = await searchParams;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();
  const [c, settings] = await Promise.all([CashCut.findById(id).lean(), getSettings()]);
  if (!c) notFound();
  const row = (l: string, v: number, opts: { sign?: string; strong?: boolean } = {}) => (
    <div className={opts.strong ? "flex justify-between border-t border-line pt-1.5 font-bold" : "flex justify-between"}>
      <dt>{l}</dt>
      <dd className="tabular">
        {opts.sign && v > 0 ? `${opts.sign} ` : ""}
        {formatMoney(v)}
      </dd>
    </div>
  );
  return (
    <main className="mx-auto max-w-xl px-3 pb-6 sm:px-6">
      <div className="no-print sticky top-0 z-20 -mx-3 mb-4 flex flex-wrap items-center gap-2 bg-background/85 px-3 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <Link href="/caja" className={btn("secondary")}>
          <Icon name="back" /> Caja
        </Link>
        <Link href="/caja/cortes" className={btn("ghost")}>
          Cortes
        </Link>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>
      {nuevo && (
        <div className="no-print mb-4">
          <Alert tone="ok">Corte {c.folio} guardado.</Alert>
        </div>
      )}
      <article className="print-area flex flex-col gap-4 rounded-3xl bg-surface p-5 text-[15px] shadow-[var(--surface-shadow)] sm:p-6">
        <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <SiacMark title="SIAC" className="mb-2 h-9 w-auto text-[var(--brand-ink)]" />
            <p className="text-base font-bold">{settings.businessName}</p>
            <p className="text-sm">Corte de caja</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular">{c.folio}</p>
            <p className="text-sm">{fmtDate(c.to)}</p>
          </div>
        </header>
        <p className="text-sm">
          Periodo: {fmtDate(c.from)} → {fmtDate(c.to)} · Hizo el corte: {c.userName}
        </p>
        <dl className="flex flex-col gap-1.5">
          {row("Fondo inicial", c.openingFloat)}
          {row("Ventas en efectivo", c.cashSales, { sign: "+" })}
          {row("Abonos en efectivo", c.cashPayments, { sign: "+" })}
          {(c.returnCharges ?? 0) > 0 && row("Diferencias de cambios", c.returnCharges ?? 0, { sign: "+" })}
          {(c.refunds ?? 0) > 0 && row("Devoluciones en efectivo", c.refunds ?? 0, { sign: "−" })}
          {row("Entradas", c.entries, { sign: "+" })}
          {row("Salidas", c.exits, { sign: "−" })}
          {row("Efectivo esperado", c.expected, { strong: true })}
          {row("Efectivo contado", c.counted)}
          <div className="flex justify-between font-bold">
            <dt>{Math.abs(c.difference) < 0.01 ? "Diferencia" : c.difference < 0 ? "Faltante" : "Sobrante"}</dt>
            <dd className="tabular">{formatMoney(Math.abs(c.difference))}</dd>
          </div>
          {row("Retiro", c.withdrawn)}
          {row("Fondo para el siguiente periodo", c.leftFloat, { strong: true })}
        </dl>
        <dl className="flex flex-col gap-1.5 border-t border-dashed border-line pt-3 text-sm">
          <p className="font-semibold">Cobrado por método ({c.salesCount} venta(s))</p>
          {row("Efectivo", c.byMethod?.efectivo ?? 0)}
          {row("Transferencia", c.byMethod?.transferencia ?? 0)}
          {row("Terminal", c.byMethod?.terminal ?? 0)}
          {c.commissions > 0 && row("Comisiones de terminal", c.commissions)}
        </dl>
        {c.notes && <p className="text-sm">Notas: {c.notes}</p>}
        <div className="mt-6 grid grid-cols-2 gap-6 pt-6 text-center text-sm">
          <p className="border-t border-line pt-1">Entregó</p>
          <p className="border-t border-line pt-1">Recibió</p>
        </div>
      </article>
    </main>
  );
}
