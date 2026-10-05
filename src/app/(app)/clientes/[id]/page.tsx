import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Customer } from "@/lib/models/Customer";
import { BillingProfile } from "@/lib/models/BillingProfile";
import { Sale } from "@/lib/models/Sale";
import { Return } from "@/lib/models/Return";
import { getSettings } from "@/lib/models/Settings";
import { can } from "@/lib/roles";
import { plain } from "@/lib/serialize";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import { formatMoney } from "@/lib/pricing";
import { Badge, Page, PageHeader, Pager, Section, Stat, btn } from "@/components/ui";
import SalesTable, { type SaleRow } from "@/components/SalesTable";
import CustomerActions from "@/components/CustomerActions";
import { BillingList, type BillingJSON } from "@/components/BillingForm";
import type { CustomerJSON } from "@/components/CustomerForm";
import PaymentDialog from "@/components/PaymentDialog";
import Icon from "@/components/Icon";
import ReturnsTable, { type ReturnRow } from "@/components/returns/ReturnsTable";

export const metadata = { title: "Cliente" };

export default async function ClientePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const user = await requirePage("customers:manage");
  const { id } = await params;
  const page = parsePage((await searchParams).pagina);
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();
  const customer = await Customer.findById(id).lean();
  if (!customer) notFound();

  const saleFilter = { customer: customer._id };
  const [list, billing, all, settings, returns] = await Promise.all([
    paginate(Sale.find(saleFilter).sort({ createdAt: -1 }), Sale.countDocuments(saleFilter), page),
    BillingProfile.find({ customer: customer._id }).sort({ createdAt: 1 }).lean(),
    Sale.find({ ...saleFilter, kind: "venta", status: { $ne: "cancelada" } }).select("total balance folio").lean(),
    getSettings(),
    Return.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const bought = all.reduce((a, s) => a + s.total, 0);
  const owed = all.filter((s) => (s.balance ?? 0) > 0);
  const balance = owed.reduce((a, s) => a + (s.balance ?? 0), 0);
  const canCredit = can(user.role, "customers:credit");
  const c = plain<CustomerJSON>(customer);

  return (
    <Page>
      <PageHeader
        title={customer.name}
        subtitle={[customer.phone, customer.email, customer.customerType === "vidriero" ? "Vidriero" : "Particular"].filter(Boolean).join(" · ")}
        back={{ href: "/clientes", label: "Clientes" }}
      >
        <Link href={`/mostrador?cliente=${id}`} className={btn("primary")}>
          <Icon name="cart" className="size-4" /> Vender
        </Link>
        <CustomerActions customer={c} canCredit={canCredit} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Comprado" value={formatMoney(bought)} num={{ value: bought }} emphasis className="col-span-2 lg:col-span-1" />
        <Stat label="Ventas" value={String(all.length)} num={{ value: all.length, money: false }} />
        <Stat label="Saldo pendiente" value={formatMoney(balance)} num={{ value: balance }} hint={owed.length ? `${owed.length} nota(s) con saldo` : "Al corriente"} />
        <Stat
          label="Crédito"
          value={customer.preferential ? (customer.creditLimit ? formatMoney(customer.creditLimit) : "Sin límite") : "No"}
          hint={customer.preferential ? "Puede pagar en parcialidades" : canCredit ? "Edítalo para hacerlo preferencial" : "Pide al encargado autorizarlo"}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {owed.length > 0 && (
            <Section title="Notas con saldo" description="Registra abonos conforme el cliente pague.">
              <ul className="divide-y divide-separator">
                {owed.map((s) => (
                  <li key={String(s._id)} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <Link href={`/notas/${String(s._id)}`} className="min-w-0 font-medium hover:underline">
                      {s.folio}
                      <span className="block text-sm font-normal text-muted">
                        Total {formatMoney(s.total)} · saldo <span className="text-warn">{formatMoney(s.balance ?? 0)}</span>
                      </span>
                    </Link>
                    <PaymentDialog saleId={String(s._id)} folio={s.folio} balance={s.balance ?? 0} defaultPct={settings.defaultCommissionPct} label="Abonar" className="min-h-10" />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {returns.length > 0 && (
            <Section
              title="Devoluciones y cambios"
              description="Las 10 más recientes"
              actions={
                <Link href={`/devoluciones?q=${encodeURIComponent(customer.name)}`} className={btn("ghost", "min-h-10 px-3 text-sm")}>
                  Ver todas
                </Link>
              }
            >
              <ReturnsTable rows={plain<ReturnRow[]>(returns)} />
            </Section>
          )}
          <Section title="Historial" description={`${list.total} venta(s) y cotización(es)`}>
            <div className="flex flex-col gap-3">
              <SalesTable rows={plain<SaleRow[]>(list.rows)} showSeller />
              <Pager page={page} pageSize={PAGE_SIZE} total={list.total} path={`/clientes/${id}`} query={{}} />
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--sticky-top)+0.75rem)]">
          <Section title="Datos" actions={customer.preferential ? <Badge tone="accent">Preferencial</Badge> : undefined}>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Teléfono</dt>
              <dd className="tabular">{customer.phone || "—"}</dd>
              <dt className="text-muted">Correo</dt>
              <dd className="truncate">{customer.email || "—"}</dd>
              <dt className="text-muted">Dirección</dt>
              <dd>{customer.address || "—"}</dd>
              <dt className="text-muted">Vidrio</dt>
              <dd>{customer.customerType === "vidriero" ? "Precio vidriero" : "Precio particular"}</dd>
              {customer.notes && (
                <>
                  <dt className="text-muted">Notas</dt>
                  <dd>{customer.notes}</dd>
                </>
              )}
            </dl>
          </Section>
          <Section title="Datos de facturación" description="Razones sociales para facturarle.">
            <BillingList profiles={plain<BillingJSON[]>(billing)} customer={{ _id: id, name: customer.name }} />
          </Section>
        </div>
      </div>
    </Page>
  );
}
