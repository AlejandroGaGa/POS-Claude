import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/lib/models/Settings";
import { Return } from "@/lib/models/Return";
import { formatMoney, formatNumber, PAYMENT_LABELS, type PaymentMethod } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { RETURN_MODE_LABELS, RETURN_OUTCOME_LABELS, RETURN_OUTCOME_TONE, type ReturnMode, type ReturnOutcome } from "@/lib/returns";
import { Alert, Badge, btn } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import Icon from "@/components/Icon";

export const metadata = { title: "Nota de devolución" };

type Item = { name?: string | null; code?: string | null; detail?: string | null; qty: number; unitPrice: number; subtotal: number };

function Items({ title, items, total, sign }: { title: string; items: Item[]; total: number; sign: string }) {
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <h2 className="mb-1 font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="py-2 pr-2">Producto</th>
            <th scope="col" className="py-2 pr-2 text-right">Cant.</th>
            <th scope="col" className="hidden py-2 pr-2 text-right sm:table-cell">P. unit.</th>
            <th scope="col" className="py-2 text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-line align-top">
              <td className="py-2 pr-2">
                <span className="font-semibold">{it.name}</span>
                <span className="block text-muted">
                  {it.code} · {it.detail}
                </span>
              </td>
              <td className="py-2 pr-2 text-right tabular">{formatNumber(it.qty)}</td>
              <td className="hidden py-2 pr-2 text-right tabular sm:table-cell">{formatMoney(it.unitPrice)}</td>
              <td className="py-2 text-right font-semibold tabular">{formatMoney(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="pt-2 text-right font-semibold tabular">
              {sign} {formatMoney(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

export default async function NotaDevolucionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  await requirePage("returns:create");
  const { id } = await params;
  const { nuevo } = await searchParams;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();
  const [r, settings] = await Promise.all([Return.findById(id).lean(), getSettings()]);
  if (!r) notFound();
  const outcome = r.outcome as ReturnOutcome;
  const isExchange = r.newItems.length > 0;
  const title = isExchange ? "Nota de cambio" : "Nota de devolución";
  const row = (l: string, v: string, strong = false) => (
    <div className={strong ? "flex justify-between border-t border-line pt-1 text-xl font-bold" : "flex justify-between"}>
      <dt>{l}</dt>
      <dd className="tabular">{v}</dd>
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-3 pb-6 sm:px-6">
      <div className="no-print sticky top-0 z-20 -mx-3 mb-4 flex flex-wrap items-center gap-2 bg-background/85 px-3 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <Link href="/devoluciones" className={btn("secondary")}>
          <Icon name="back" /> Devoluciones
        </Link>
        {r.sale && (
          <Link href={`/notas/${String(r.sale)}`} className={btn("ghost")}>
            Ver venta {r.saleFolio}
          </Link>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href="/devoluciones/nueva" className={btn("ghost")}>
            <Icon name="plus" className="size-4" /> Otra devolución
          </Link>
          <PrintButton />
        </div>
      </div>

      {nuevo && (
        <div className="no-print mb-4">
          <Alert tone="ok">
            {isExchange ? "Cambio" : "Devolución"} {r.folio} registrado.
            {r.refundAmount > 0 && ` Entrega ${formatMoney(r.refundAmount)} en efectivo al cliente.`}
            {r.chargeAmount > 0 && ` Cobrado ${formatMoney(r.chargeAmount + (r.commissionAmount ?? 0))}.`}
          </Alert>
        </div>
      )}

      <article className="print-area rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] sm:p-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div className="min-w-0">
            <p className="text-xl font-bold">{settings.businessName}</p>
            {settings.address && <p className="text-sm">{settings.address}</p>}
            {settings.phone && <p className="text-sm">Tel. {settings.phone}</p>}
          </div>
          <div className="w-full sm:w-auto sm:text-right">
            <h1 className="text-lg font-bold">{title}</h1>
            <p className="text-lg font-semibold tabular">{r.folio}</p>
            <p className="text-sm">{fmtDate(r.createdAt)}</p>
            <p className="mt-1">
              <Badge tone={RETURN_OUTCOME_TONE[outcome]}>{RETURN_OUTCOME_LABELS[outcome]}</Badge>
            </p>
          </div>
        </header>

        <dl className="mb-4 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="inline font-semibold">Atendió: </dt>
            <dd className="inline">{r.userName}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Venta original: </dt>
            <dd className="inline">
              {r.saleFolio ? `${r.saleFolio}${r.saleDate ? ` (${fmtDate(r.saleDate, false)})` : ""}` : "Sin nota"}
              {r.quoteFolio ? ` · cotización ${r.quoteFolio}` : ""}
            </dd>
          </div>
          {r.customerName && (
            <div>
              <dt className="inline font-semibold">Cliente: </dt>
              <dd className="inline">
                {r.customer ? (
                  <Link href={`/clientes/${String(r.customer)}`} className="hover:underline">
                    {r.customerName}
                  </Link>
                ) : (
                  r.customerName
                )}
              </dd>
            </div>
          )}
          {r.customerPhone && (
            <div>
              <dt className="inline font-semibold">Teléfono: </dt>
              <dd className="inline">{r.customerPhone}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="inline font-semibold">Motivo: </dt>
            <dd className="inline">{r.reason}</dd>
          </div>
        </dl>

        <Items title={r.saleFolio ? "Regresa (al precio que pagó)" : "Regresa (a precio de lista)"} items={r.returnedItems as Item[]} total={r.returnedTotal} sign="−" />
        <Items title="Se lleva (precio actual)" items={r.newItems as Item[]} total={r.newTotal} sign="+" />

        <dl className="mt-4 ml-auto flex max-w-sm flex-col gap-1 tabular">
          <div className="flex justify-between text-sm">
            <dt>Forma</dt>
            <dd>{isExchange ? RETURN_MODE_LABELS[r.mode as ReturnMode] : r.mode === "cobrar_completo" ? "Sin reembolso" : "Regresar dinero"}</dd>
          </div>
          {r.chargeAmount > 0 && (
            <>
              {(r.commissionAmount ?? 0) > 0 && row(`Comisión terminal (${formatNumber(r.charge?.commissionPct ?? 0, 2)}%)`, formatMoney(r.commissionAmount ?? 0))}
              {row("Cobrado al cliente", formatMoney(r.chargeAmount + (r.commissionAmount ?? 0)), true)}
              {r.charge?.method && row("Pagó con", PAYMENT_LABELS[r.charge.method as PaymentMethod])}
              {r.charge?.cashReceived != null && (
                <>
                  {row("Recibido", formatMoney(r.charge.cashReceived))}
                  {row("Cambio", formatMoney(r.charge.change ?? 0))}
                </>
              )}
            </>
          )}
          {(r.appliedToBalance ?? 0) > 0 && row(`Abonado al saldo de ${r.saleFolio}`, formatMoney(r.appliedToBalance))}
          {r.refundAmount > 0 && row("Regresado en efectivo", formatMoney(r.refundAmount), true)}
          {(r.waivedAmount ?? 0) > 0 && row("Cortesía (no se cobró)", formatMoney(r.waivedAmount))}
          {(r.notRefundedAmount ?? 0) > 0 && row("No reembolsado", formatMoney(r.notRefundedAmount))}
          {r.chargeAmount <= 0 && r.refundAmount <= 0 && !(r.appliedToBalance > 0) && row("Movimiento de dinero", formatMoney(0), true)}
        </dl>

        {r.notes && <p className="mt-4 text-sm">Notas: {r.notes}</p>}
        <div className="mt-10 grid grid-cols-2 gap-6 text-center text-sm print:mt-16">
          <p className="border-t border-line pt-1">Firma del cliente</p>
          <p className="border-t border-line pt-1">Recibió</p>
        </div>
      </article>
    </main>
  );
}
