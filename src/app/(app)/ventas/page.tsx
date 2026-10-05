import Link from "next/link";
import { Types } from "mongoose";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Sale } from "@/lib/models/Sale";
import { User } from "@/lib/models/User";
import { can } from "@/lib/roles";
import { dayStr, isDayStr, range } from "@/lib/dates";
import { formatMoney, PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/pricing";
import { plain } from "@/lib/serialize";
import { FilterBar, Page, PageHeader, Pager, Stat, btn } from "@/components/ui";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import DateRangeFilter from "@/components/DateRangeFilter";
import { UrlSearch, UrlSelect } from "@/components/UrlFilters";
import Icon from "@/components/Icon";
import SalesTable, { type SaleRow } from "@/components/SalesTable";

export const metadata = { title: "Ventas" };

type SP = { desde?: string; hasta?: string; pago?: string; vendedor?: string; estado?: string; q?: string; pagina?: string };

export default async function VentasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePage("sales:create");
  const viewAll = can(user.role, "sales:viewAll");
  const sp = await searchParams;
  const today = dayStr();
  const desde = isDayStr(sp.desde) ? sp.desde : today;
  const hasta = isDayStr(sp.hasta) ? sp.hasta : desde > today ? desde : today;

  await connectDB();
  const filter: Record<string, unknown> = { kind: "venta", createdAt: range(desde, hasta) };
  if (!viewAll) filter.seller = new Types.ObjectId(user.id);
  else if (sp.vendedor && Types.ObjectId.isValid(sp.vendedor)) filter.seller = new Types.ObjectId(sp.vendedor);
  if (sp.pago && (PAYMENT_METHODS as readonly string[]).includes(sp.pago)) filter.paymentMethod = sp.pago;
  if (sp.estado === "cancelada") filter.status = "cancelada";
  else if (sp.estado === "saldo") {
    filter.status = { $ne: "cancelada" };
    filter.balance = { $gt: 0 };
  } else if (sp.estado !== "todas") filter.status = { $ne: "cancelada" };
  const page = parsePage(sp.pagina);
  if (sp.q?.trim()) {
    const rx = new RegExp(sp.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ folio: rx }, { fromQuoteFolio: rx }, { customerName: rx }, { customerPhone: rx }];
  }

  // Página de ventas (MongoDB skip/limit) + proyección ligera de todo el filtro para los totales.
  const [list, light, sellers] = await Promise.all([
    paginate(Sale.find(filter).sort({ createdAt: -1 }), Sale.countDocuments(filter), page),
    Sale.find(filter).select("total paymentMethod status").lean(),
    viewAll ? User.find().select("name").sort({ name: 1 }).lean() : Promise.resolve([]),
  ]);
  const rows = list.rows;
  const valid = light.filter((r) => r.status !== "cancelada");
  const sum = (arr: { total: number }[]) => arr.reduce((a, r) => a + r.total, 0);
  const byMethod = PAYMENT_METHODS.map((m) => ({ m, total: sum(valid.filter((r) => r.paymentMethod === m)) }));

  const payOpts = [{ value: "", label: "Todos" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_LABELS[m] }))];
  const sellerOpts = [{ value: "", label: "Todos" }, ...sellers.map((x) => ({ value: String(x._id), label: x.name }))];
  const statusOpts = [
    { value: "", label: "Pagadas" },
    { value: "saldo", label: "Con saldo" },
    { value: "cancelada", label: "Canceladas" },
    { value: "todas", label: "Todas" },
  ];

  return (
    <Page>
      <PageHeader title={viewAll ? "Ventas" : "Mis ventas"} subtitle="Toca una venta para ver o imprimir su nota.">
        <Link href="/mostrador" className={btn("primary", "max-md:hidden")}>
          <Icon name="plus" className="size-4" /> Nueva venta
        </Link>
      </PageHeader>

      <FilterBar>
        <DateRangeFilter desde={desde} hasta={hasta} label="Periodo de ventas" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:items-end">
          <UrlSearch label="Buscar" placeholder="Folio, cliente o teléfono" className="col-span-2 md:col-span-1" />
          <UrlSelect name="pago" label="Pago" options={payOpts} />
          <UrlSelect name="estado" label="Estado" options={statusOpts} />
          {viewAll && <UrlSelect name="vendedor" label="Vendedor" options={sellerOpts} className="col-span-2 md:col-span-1" />}
        </div>
      </FilterBar>

      <div data-results className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Stat label="Total" value={formatMoney(sum(valid))} num={{ value: sum(valid) }} emphasis className="col-span-2 lg:col-span-1" />
        <Stat label="Ventas" value={String(valid.length)} num={{ value: valid.length, money: false }} />
        {byMethod.map((b) => (
          <Stat key={b.m} label={PAYMENT_LABELS[b.m]} value={formatMoney(b.total)} num={{ value: b.total }} />
        ))}
      </div>

      <SalesTable rows={plain<SaleRow[]>(rows)} showSeller={viewAll} />
      <Pager page={page} pageSize={PAGE_SIZE} total={list.total} path="/ventas" query={{ desde: sp.desde, hasta: sp.hasta, pago: sp.pago, vendedor: sp.vendedor, estado: sp.estado, q: sp.q }} />
    </Page>
  );
}
