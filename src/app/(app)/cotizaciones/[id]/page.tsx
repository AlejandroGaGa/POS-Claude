import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/lib/models/Settings";
import { loadSaleFor } from "@/lib/saleAccess";
import { buildItems } from "@/lib/sales";
import { can } from "@/lib/roles";
import { formatMoney, formatNumber, round2, type CustomerType } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { Alert, Page, PageHeader, Section, btn } from "@/components/ui";
import Icon from "@/components/Icon";
import ConvertQuote from "@/components/ConvertQuote";
import { Customer } from "@/lib/models/Customer";
import CancelSale from "@/components/CancelSale";

export const metadata = { title: "Cotización" };

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editada?: string }> }) {
  const user = await requirePage("sales:create");
  await connectDB();
  const { id } = await params;
  const { editada } = await searchParams;
  const [quote, settings] = await Promise.all([loadSaleFor(user, id), getSettings()]);
  if (quote.kind !== "cotizacion" || quote.status !== "vigente") redirect(`/notas/${id}`);

  const expired = !!quote.validUntil && new Date(quote.validUntil).getTime() < Date.now();
  let subtotal = quote.subtotal;
  let repriceError = "";
  if (expired) {
    try {
      const items = await buildItems(
        quote.items.map((it) => ({
          productId: String(it.product),
          mode: it.mode,
          qty: it.qty,
          lengthM: it.lengthM ?? undefined,
          barLengthM: it.barLengthM ?? undefined,
          widthM: it.widthM ?? undefined,
          heightM: it.heightM ?? undefined,
        })),
        (quote.customerType ?? "particular") as CustomerType,
      );
      subtotal = round2(items.reduce((a, i) => a + i.subtotal, 0));
    } catch (e) {
      repriceError = (e as Error).message;
    }
  }
  const canCancel = can(user.role, "sales:viewAll") || String(quote.seller) === user.id;
  const cust = quote.customer ? await Customer.findById(quote.customer).select("preferential").lean() : null;
  const preferential = !!cust?.preferential;

  return (
    <Page>
      <PageHeader
        title={`Cotización ${quote.folio}`}
        subtitle={[fmtDate(quote.createdAt), quote.sellerName, quote.customerName].filter(Boolean).join(" · ")}
        back={{ href: "/cotizaciones", label: "Cotizaciones" }}
      >
        <Link href={`/mostrador?cotizacion=${id}`} className={btn("primary")}>
          <Icon name="edit" className="size-4" /> Agregar o quitar productos
        </Link>
        <Link href={`/notas/${id}`} className={btn("secondary")}>
          <Icon name="print" className="size-4" /> Ver / imprimir
        </Link>
        {canCancel && <CancelSale id={id} label="Cancelar cotización" />}
      </PageHeader>

      {editada && <Alert tone="ok">Cotización {quote.folio} actualizada.</Alert>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <Section
          title="Productos"
          description={`${quote.items.length} renglón(es)${quote.editedAt ? ` · editada ${fmtDate(quote.editedAt)} por ${quote.editedByName}` : ""}`}
          actions={
            <Link href={`/mostrador?cotizacion=${id}`} className={btn("ghost", "min-h-10 px-3 text-sm")}>
              <Icon name="edit" className="size-4" /> Editar
            </Link>
          }
        >
          <ul className="divide-y divide-separator">
            {quote.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="font-medium">{it.name}</p>
                  <p className="text-sm text-muted">
                    {it.code} · {it.detail} · {formatNumber(it.qty)} × {formatMoney(it.unitPrice)}
                  </p>
                </div>
                <p className="font-semibold whitespace-nowrap tabular">{formatMoney(it.subtotal)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex justify-between border-t border-separator pt-3 text-lg font-semibold tabular">
            <span>Subtotal cotizado</span>
            <span>{formatMoney(quote.subtotal)}</span>
          </p>
        </Section>

        <Section
          title="Cobrar"
          description={expired ? undefined : `Vigente hasta ${fmtDate(quote.validUntil, false)}: se respetan los precios cotizados.`}
          className="lg:sticky lg:top-[calc(var(--sticky-top)+0.75rem)]"
        >
          {expired ? (
            repriceError ? (
              <Alert>No se puede cobrar así: {repriceError}. Usa «Agregar o quitar productos» para corregirla.</Alert>
            ) : (
              <div className="flex flex-col gap-3">
                <Alert tone="warn">
                  Venció el {fmtDate(quote.validUntil, false)}. Se cobrará con los precios actuales
                  {subtotal !== quote.subtotal ? ` (subtotal nuevo ${formatMoney(subtotal)}).` : " (sin cambios)."}
                </Alert>
                <ConvertQuote id={id} subtotal={subtotal} defaultPct={settings.defaultCommissionPct} preferential={preferential} />
              </div>
            )
          ) : (
            <ConvertQuote id={id} subtotal={subtotal} defaultPct={settings.defaultCommissionPct} preferential={preferential} />
          )}
        </Section>
      </div>
    </Page>
  );
}
