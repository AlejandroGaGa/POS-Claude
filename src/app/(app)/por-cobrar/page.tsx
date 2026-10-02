import Link from "next/link";
import { Types } from "mongoose";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Sale } from "@/lib/models/Sale";
import { getSettings } from "@/lib/models/Settings";
import { can } from "@/lib/roles";
import { escapeRegex } from "@/lib/text";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import { formatMoney } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { FilterBar, Page, PageHeader, Pager, Stat } from "@/components/ui";
import { UrlSearch } from "@/components/UrlFilters";
import DataTable from "@/components/DataTable";
import PaymentDialog from "@/components/PaymentDialog";

export const metadata = { title: "Por cobrar" };

export default async function PorCobrarPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const user = await requirePage("sales:create");
  const sp = await searchParams;
  const page = parsePage(sp.pagina);
  await connectDB();
  const filter: Record<string, unknown> = { kind: "venta", status: { $ne: "cancelada" }, balance: { $gt: 0 } };
  if (!can(user.role, "sales:viewAll")) filter.seller = new Types.ObjectId(user.id);
  if (sp.q?.trim()) {
    const rx = new RegExp(escapeRegex(sp.q.trim()), "i");
    filter.$or = [{ folio: rx }, { customerName: rx }, { customerPhone: rx }];
  }
  const [list, all, settings] = await Promise.all([
    paginate(Sale.find(filter).sort({ createdAt: 1 }), Sale.countDocuments(filter), page),
    Sale.find(filter).select("balance customer createdAt").lean(),
    getSettings(),
  ]);
  const owed = all.reduce((a, s) => a + (s.balance ?? 0), 0);
  const customers = new Set(all.map((s) => String(s.customer ?? s._id))).size;
  const oldest = all.reduce<Date | null>((m, s) => (!m || s.createdAt < m ? s.createdAt : m), null);
  const days = oldest ? Math.floor((Date.now() - new Date(oldest).getTime()) / 86400000) : 0;

  return (
    <Page>
      <PageHeader title="Cuentas por cobrar" subtitle="Ventas de clientes preferenciales con saldo pendiente." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Saldo total" value={formatMoney(owed)} num={{ value: owed }} emphasis className="col-span-2 lg:col-span-1" />
        <Stat label="Clientes que deben" value={String(customers)} num={{ value: customers, money: false }} hint={`${all.length} nota(s)`} />
        <Stat label="Más antigua" value={oldest ? `${days} días` : "—"} hint={oldest ? fmtDate(oldest, false) : "Todo al corriente"} />
      </div>

      <FilterBar>
        <UrlSearch label="Buscar" placeholder="Folio, cliente o teléfono" />
      </FilterBar>

      <DataTable
        label="Cuentas por cobrar"
        emptyIcon="check"
        empty={{ title: "Nadie te debe", text: "Las ventas con pago parcial aparecerán aquí." }}
        aside="balance"
        columns={[
          { key: "folio", label: "Nota" },
          { key: "customer", label: "Cliente" },
          { key: "date", label: "Fecha" },
          { key: "total", label: "Total", align: "right" },
          { key: "paid", label: "Pagado", align: "right", hideOnMobile: true },
          { key: "balance", label: "Saldo", align: "right" },
          { key: "action", label: "", align: "right" },
        ]}
        rows={list.rows.map((s) => ({
          id: String(s._id),
          cells: {
            folio: (
              <Link href={`/notas/${String(s._id)}`} className="font-semibold tabular hover:underline">
                {s.folio}
              </Link>
            ),
            customer: s.customer ? (
              <Link href={`/clientes/${String(s.customer)}`} className="hover:underline">
                {s.customerName}
              </Link>
            ) : (
              s.customerName || "—"
            ),
            date: <span className="whitespace-nowrap text-muted">{fmtDate(s.createdAt, false)}</span>,
            total: formatMoney(s.total),
            paid: formatMoney(s.paid ?? 0),
            balance: <span className="text-warn">{formatMoney(s.balance ?? 0)}</span>,
            action: <PaymentDialog saleId={String(s._id)} folio={s.folio} balance={s.balance ?? 0} defaultPct={settings.defaultCommissionPct} label="Abonar" className="min-h-9 px-4 text-sm" />,
          },
        }))}
      />
      <Pager page={page} pageSize={PAGE_SIZE} total={list.total} path="/por-cobrar" query={{ q: sp.q }} />
    </Page>
  );
}
