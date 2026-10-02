import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/lib/models/Settings";
import { loadSaleFor } from "@/lib/saleAccess";
import { formatMoney, formatNumber, PAYMENT_LABELS, type PaymentMethod } from "@/lib/pricing";
import { fmtDate, STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import { Alert, Badge, btn } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import CancelSale from "@/components/CancelSale";
import { can } from "@/lib/roles";
import Icon from "@/components/Icon";
import WhatsAppSend, { PdfLink } from "@/components/WhatsAppSend";
import PaymentDialog from "@/components/PaymentDialog";
import { whatsappConfig } from "@/lib/whatsapp";

export const metadata = { title: "Nota" };

export default async function NotaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const user = await requirePage();
  await connectDB();
  const { id } = await params;
  const { nuevo } = await searchParams;
  const [sale, settings] = await Promise.all([loadSaleFor(user, id), getSettings()]);
  const isQuote = sale.kind === "cotizacion";
  const title = isQuote ? "Cotización" : "Nota de venta";

  const waText = [
    `${settings.businessName} — ${title} ${sale.folio}`,
    ...sale.items.map((it) => `• ${it.name} (${it.detail}) ${formatNumber(it.qty)} × ${formatMoney(it.unitPrice)} = ${formatMoney(it.subtotal)}`),
    sale.commissionAmount ? `Comisión terminal ${formatNumber(sale.commissionPct, 2)}%: ${formatMoney(sale.commissionAmount)}` : "",
    `Total: ${formatMoney(sale.total)}`,
    isQuote && sale.validUntil ? `Vigente hasta ${fmtDate(sale.validUntil, false)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const phone = (sale.customerPhone || "").replace(/\D/g, "");
  const waUrl = `https://wa.me/${phone.length === 10 ? "52" + phone : phone}?text=${encodeURIComponent(waText)}`;

  return (
    <main className="mx-auto max-w-3xl px-3 pb-6 sm:px-6">
      <div className="no-print sticky top-0 z-20 -mx-3 mb-4 flex flex-wrap items-center gap-2 bg-background/85 px-3 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <Link href="/mostrador" className={btn("secondary")}>
          <Icon name="back" /> Mostrador
        </Link>
        <Link href={isQuote ? "/cotizaciones" : "/ventas"} className={btn("ghost")}>
          {isQuote ? "Cotizaciones" : "Ventas"}
        </Link>
        <div className="ml-auto flex flex-wrap gap-2">
          {sale.status !== "cancelada" && (
            <WhatsAppSend
              id={String(sale._id)}
              folio={sale.folio}
              defaultPhone={sale.customerPhone || ""}
              enabled={whatsappConfig().enabled}
              waUrl={waUrl}
              lastSent={sale.whatsappSentAt ? { at: new Date(sale.whatsappSentAt).toISOString(), to: sale.whatsappSentTo || "", by: sale.whatsappSentByName || undefined } : null}
            />
          )}
          <PdfLink id={String(sale._id)} />
          {sale.kind === "venta" && sale.status === "vigente" && (sale.balance ?? 0) > 0 && (
            <PaymentDialog saleId={String(sale._id)} folio={sale.folio} balance={sale.balance ?? 0} defaultPct={settings.defaultCommissionPct} label="Abonar" />
          )}
          {sale.kind === "venta" && sale.status === "vigente" && can(user.role, "sales:cancel") && <CancelSale id={String(sale._id)} label="Cancelar venta" />}
          <PrintButton />
        </div>
      </div>

      {nuevo && (
        <div className="no-print mb-4">
          <Alert tone="ok">
            {isQuote ? "Cotización" : "Venta"} {sale.folio} guardada.
          </Alert>
        </div>
      )}

      {isQuote && sale.status === "vigente" && (
        <div className="no-print mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link href={`/cotizaciones/${String(sale._id)}`} className={btn("primary")}>
            Cobrar esta cotización
          </Link>
          <Link href={`/mostrador?cotizacion=${String(sale._id)}`} className={btn("secondary")}>
            <Icon name="edit" className="size-4" /> Agregar o quitar productos
          </Link>
        </div>
      )}

      <article className="print-area rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] sm:p-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div className="min-w-0">
            <p className="text-xl font-bold">{settings.businessName}</p>
            {settings.address && <p className="text-sm">{settings.address}</p>}
            {settings.phone && <p className="text-sm">Tel. {settings.phone}</p>}
            {settings.rfc && <p className="text-sm">RFC {settings.rfc}</p>}
          </div>
          <div className="w-full sm:w-auto sm:text-right">
            <h1 className="text-lg font-bold">{title}</h1>
            <p className="text-lg font-semibold tabular">{sale.folio}</p>
            <p className="text-sm">{fmtDate(sale.createdAt)}</p>
            {sale.status !== "vigente" || isQuote ? (
              <p className="mt-1">
                <Badge tone={STATUS_TONE[sale.status]}>{STATUS_LABEL[sale.status]}</Badge>
              </p>
            ) : null}
          </div>
        </header>

        <dl className="mb-4 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="inline font-semibold">Atendió: </dt>
            <dd className="inline">{sale.sellerName}</dd>
          </div>
          {sale.customerName && (
            <div>
              <dt className="inline font-semibold">Cliente: </dt>
              <dd className="inline">
                {sale.customer ? (
                  <Link href={`/clientes/${String(sale.customer)}`} className="hover:underline">
                    {sale.customerName}
                  </Link>
                ) : (
                  sale.customerName
                )}
              </dd>
            </div>
          )}
          {sale.customerType === "vidriero" && (
            <div>
              <dt className="inline font-semibold">Tipo de cliente: </dt>
              <dd className="inline">Vidriero</dd>
            </div>
          )}
          {sale.customerPhone && (
            <div>
              <dt className="inline font-semibold">Teléfono: </dt>
              <dd className="inline">{sale.customerPhone}</dd>
            </div>
          )}
          {isQuote && sale.validUntil && (
            <div>
              <dt className="inline font-semibold">Vigente hasta: </dt>
              <dd className="inline">{fmtDate(sale.validUntil, false)}</dd>
            </div>
          )}
          {sale.fromQuoteFolio && (
            <div>
              <dt className="inline font-semibold">De la cotización: </dt>
              <dd className="inline">{sale.fromQuoteFolio}</dd>
            </div>
          )}
          {sale.convertedToFolio && (
            <div>
              <dt className="inline font-semibold">Convertida en venta: </dt>
              <dd className="inline">{sale.convertedToFolio}</dd>
            </div>
          )}
        </dl>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-2 pr-2">
                Producto
              </th>
              <th scope="col" className="py-2 pr-2 text-right">
                Cant.
              </th>
              <th scope="col" className="hidden py-2 pr-2 text-right sm:table-cell">
                P. unit.
              </th>
              <th scope="col" className="py-2 text-right">
                Importe
              </th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-2 pr-2">
                  <span className="font-semibold">{it.name}</span>
                  <span className="block text-muted">
                    {it.code} · {it.detail}
                  </span>
                  <span className="block text-muted sm:hidden">P. unit. {formatMoney(it.unitPrice)}</span>
                </td>
                <td className="py-2 pr-2 text-right tabular">{formatNumber(it.qty)}</td>
                <td className="hidden py-2 pr-2 text-right tabular sm:table-cell">{formatMoney(it.unitPrice)}</td>
                <td className="py-2 text-right font-semibold tabular">{formatMoney(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 ml-auto flex max-w-xs flex-col gap-1 tabular">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(sale.subtotal)}</dd>
          </div>
          {sale.commissionAmount > 0 && (
            <div className="flex justify-between">
              <dt>{(sale.payments?.length ?? 0) > 1 || !sale.commissionPct ? "Comisiones de terminal" : `Comisión terminal (${formatNumber(sale.commissionPct, 2)}%)`}</dt>
              <dd>{formatMoney(sale.commissionAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-1 text-xl font-bold">
            <dt>Total</dt>
            <dd>{formatMoney(sale.total)}</dd>
          </div>
          {sale.paymentMethod && (
            <div className="flex justify-between text-sm">
              <dt>{isQuote ? "Pago previsto" : "Pagó con"}</dt>
              <dd>{PAYMENT_LABELS[sale.paymentMethod as PaymentMethod]}</dd>
            </div>
          )}
          {sale.cashReceived != null && (
            <>
              <div className="flex justify-between text-sm">
                <dt>Recibido</dt>
                <dd>{formatMoney(sale.cashReceived)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt>Cambio</dt>
                <dd>{formatMoney(sale.change ?? 0)}</dd>
              </div>
            </>
          )}
        </dl>

        {sale.kind === "venta" && (sale.payments?.length ?? 0) > 0 && (sale.paymentStatus === "parcial" || (sale.payments?.length ?? 0) > 1) && (
          <div className="mt-4 border-t border-line pt-3 text-sm">
            <p className="mb-1 font-semibold">Pagos</p>
            <ul className="flex flex-col gap-1">
              {sale.payments!.map((p, i) => (
                <li key={i} className="flex justify-between gap-3 tabular">
                  <span>
                    {fmtDate(p.at)} · {PAYMENT_LABELS[p.method as PaymentMethod]}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                  <span>
                    {formatMoney(p.amount)}
                    {p.commissionAmount ? ` + ${formatMoney(p.commissionAmount)} com.` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between text-base font-bold">
              <span>{(sale.balance ?? 0) > 0 ? "Saldo pendiente" : "Liquidada"}</span>
              <span className="tabular">{formatMoney(sale.balance ?? 0)}</span>
            </p>
          </div>
        )}
        {sale.notes && <p className="mt-4 text-sm">Notas: {sale.notes}</p>}
        {sale.status === "cancelada" && (
          <p className="mt-4 rounded-lg border border-bad bg-bad-soft p-2 text-sm text-bad">
            Cancelada el {fmtDate(sale.cancelledAt)} por {sale.cancelledByName}. Motivo: {sale.cancelReason}
          </p>
        )}
        {settings.ticketFooter && <p className="mt-6 border-t border-line pt-3 text-center text-sm">{settings.ticketFooter}</p>}
      </article>
    </main>
  );
}
