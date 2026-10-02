import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Sale } from "@/lib/models/Sale";
import { plain } from "@/lib/serialize";
import { formatMoney } from "@/lib/pricing";
import { FilterBar, Page, PageHeader, Pager, btn } from "@/components/ui";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import SalesTable, { type SaleRow } from "@/components/SalesTable";
import { UrlSearch, UrlSelect } from "@/components/UrlFilters";
import Icon from "@/components/Icon";

export const metadata = { title: "Cotizaciones" };

export default async function CotizacionesPage({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string; pagina?: string }> }) {
  await requirePage("sales:create");
  const sp = await searchParams;
  await connectDB();
  const estado = sp.estado ?? "vigente";
  const filter: Record<string, unknown> = { kind: "cotizacion" };
  if (["vigente", "convertida", "cancelada"].includes(estado)) filter.status = estado;
  if (sp.q?.trim()) {
    const rx = new RegExp(sp.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ folio: rx }, { customerName: rx }, { customerPhone: rx }];
  }
  const page = parsePage(sp.pagina);
  const [list, light] = await Promise.all([
    paginate(Sale.find(filter).sort({ createdAt: -1 }), Sale.countDocuments(filter), page),
    estado === "vigente" ? Sale.find(filter).select("total").lean() : Promise.resolve([] as { total: number }[]),
  ]);
  const rows = list.rows;
  const pendingTotal = light.reduce((a, r) => a + r.total, 0);

  return (
    <Page>
      <PageHeader
        title="Cotizaciones"
        subtitle={
          estado === "vigente" && list.total
            ? `${list.total} pendiente(s) por ${formatMoney(pendingTotal)}. Toca una para cobrarla o editarla.`
            : "Las cotizaciones se cobran en un toque cuando el cliente regresa."
        }
      >
        <Link href="/mostrador" className={btn("primary", "max-md:hidden")}>
          <Icon name="plus" className="size-4" /> Nueva cotización
        </Link>
      </PageHeader>

      <FilterBar>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
          <UrlSearch label="Buscar" placeholder="Folio, cliente o teléfono" />
          <UrlSelect
            name="estado"
            label="Estado"
            options={[
              { value: "", label: "Pendientes" },
              { value: "convertida", label: "Cobradas" },
              { value: "cancelada", label: "Canceladas" },
              { value: "todas", label: "Todas" },
            ]}
          />
        </div>
      </FilterBar>

      <SalesTable rows={plain<SaleRow[]>(rows)} showSeller quoteMode />
      <Pager page={page} pageSize={PAGE_SIZE} total={list.total} path="/cotizaciones" query={{ estado: sp.estado, q: sp.q }} />
    </Page>
  );
}
