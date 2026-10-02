import Link from "next/link";
import { Types } from "mongoose";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Customer } from "@/lib/models/Customer";
import { Sale } from "@/lib/models/Sale";
import { can } from "@/lib/roles";
import { escapeRegex } from "@/lib/text";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import { formatMoney } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { Badge, FilterBar, Page, PageHeader, Pager } from "@/components/ui";
import { UrlSearch, UrlSelect } from "@/components/UrlFilters";
import DataTable from "@/components/DataTable";
import { CustomerFormButton } from "@/components/CustomerForm";
import Icon from "@/components/Icon";

export const metadata = { title: "Clientes" };

type SP = { q?: string; tipo?: string; pagina?: string };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePage("customers:manage");
  const sp = await searchParams;
  const page = parsePage(sp.pagina);
  await connectDB();

  const filter: Record<string, unknown> = { active: true };
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    const digits = q.replace(/\D/g, "");
    filter.$or = [{ name: new RegExp(escapeRegex(q), "i") }, { email: new RegExp(escapeRegex(q), "i") }, ...(digits.length >= 3 ? [{ phoneKey: new RegExp(digits) }] : [])];
  }
  if (sp.tipo === "preferencial") filter.preferential = true;
  if (sp.tipo === "saldo") {
    const ids = await Sale.distinct("customer", { kind: "venta", status: { $ne: "cancelada" }, balance: { $gt: 0 } });
    filter._id = { $in: ids.filter(Boolean) };
  }

  const { rows, total } = await paginate(Customer.find(filter).sort({ name: 1 }), Customer.countDocuments(filter), page);
  const ids = rows.map((r) => r._id as Types.ObjectId);
  const sales = await Sale.find({ customer: { $in: ids }, kind: "venta", status: { $ne: "cancelada" } }).select("customer balance total createdAt").lean();
  const stats = new Map<string, { balance: number; total: number; count: number; last?: Date }>();
  for (const s of sales) {
    const k = String(s.customer);
    const st = stats.get(k) ?? { balance: 0, total: 0, count: 0 };
    st.balance += s.balance ?? 0;
    st.total += s.total;
    st.count++;
    if (!st.last || s.createdAt > st.last) st.last = s.createdAt;
    stats.set(k, st);
  }

  return (
    <Page>
      <PageHeader title="Clientes" subtitle="Se registran solos al vender o cotizar con nombre; aquí los buscas y editas.">
        <CustomerFormButton canCredit={can(user.role, "customers:credit")}>
          <Icon name="plus" className="size-4" /> Nuevo cliente
        </CustomerFormButton>
      </PageHeader>

      <FilterBar>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
          <UrlSearch label="Buscar" placeholder="Nombre, teléfono o correo" />
          <UrlSelect
            name="tipo"
            label="Mostrar"
            options={[
              { value: "", label: "Todos" },
              { value: "preferencial", label: "Preferenciales" },
              { value: "saldo", label: "Con saldo pendiente" },
            ]}
          />
        </div>
      </FilterBar>

      <DataTable
        label="Clientes"
        emptyIcon="person"
        empty={{ title: "No hay clientes con estos filtros", text: "Registra uno nuevo o cambia la búsqueda." }}
        aside="balance"
        columns={[
          { key: "name", label: "Cliente" },
          { key: "phone", label: "Teléfono" },
          { key: "type", label: "Tipo" },
          { key: "sales", label: "Compras", align: "right" },
          { key: "last", label: "Última compra", align: "right", hideOnMobile: true },
          { key: "balance", label: "Saldo", align: "right" },
        ]}
        rows={rows.map((c) => {
          const st = stats.get(String(c._id));
          return {
            id: String(c._id),
            href: `/clientes/${String(c._id)}`,
            cells: {
              name: (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.preferential && <Badge tone="accent">Preferencial</Badge>}
                </span>
              ),
              phone: c.phone ? <span className="tabular">{c.phone}</span> : <span className="text-muted">—</span>,
              type: c.customerType === "vidriero" ? "Vidriero" : "Particular",
              sales: st ? `${st.count} · ${formatMoney(st.total)}` : "—",
              last: st?.last ? <span className="text-muted">{fmtDate(st.last, false)}</span> : "—",
              balance: st?.balance ? <span className="text-warn">{formatMoney(st.balance)}</span> : <span className="text-muted">{formatMoney(0)}</span>,
            },
          };
        })}
      />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} path="/clientes" query={{ q: sp.q, tipo: sp.tipo }} />
      <p className="text-sm text-muted">
        ¿Buscas datos fiscales? Están en <Link href="/facturacion" className="font-medium text-accent hover:underline">Datos de facturación</Link>.
      </p>
    </Page>
  );
}
