import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Product } from "@/lib/models/Product";
import { can } from "@/lib/roles";
import { productSearchFilter } from "@/lib/productSearch";
import { priceSummary } from "@/lib/productSummary";
import { availableModes, type ProductPricing } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { FilterBar, Page, PageHeader, Pager, btn } from "@/components/ui";
import { UrlSearch, UrlSelect } from "@/components/UrlFilters";
import ProductsTable, { type ProductRow } from "@/components/ProductsTable";
import Icon from "@/components/Icon";

const PAGE_SIZE = 50;

export const metadata = { title: "Productos" };

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; inactivos?: string; pagina?: string }> }) {
  const user = await requirePage("products:view");
  const editor = can(user.role, "products:edit");
  const sp = await searchParams;
  await connectDB();

  const filter: Record<string, unknown> = {};
  if (!(editor && sp.inactivos === "1")) filter.active = true;
  if (sp.categoria) filter.category = sp.categoria;
  const search = productSearchFilter(sp.q);
  if (search.length) filter.$and = search;
  const page = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);
  const [products, total, categories] = await Promise.all([
    Product.find(filter)
      .sort({ category: 1, group: 1, name: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Product.countDocuments(filter),
    Product.distinct("category", { active: true }),
  ]);
  const rows: ProductRow[] = products.map((p) => ({
    _id: String(p._id),
    code: p.code,
    name: p.name,
    category: p.category,
    line: p.line ?? "",
    color: p.color ?? "",
    unitLabel: p.unitLabel ?? "",
    prices: priceSummary(p as unknown as ProductPricing),
    updated: fmtDate(p.updatedAt, false),
    active: p.active,
    noPrice: availableModes(p as unknown as ProductPricing).length === 0,
  }));

  return (
    <Page>
      <PageHeader title={editor ? "Productos y precios" : "Lista de precios"} subtitle={editor ? "Toca un producto para cambiar su precio." : "Consulta precios por tira, metro, hoja o pieza."}>
        {editor && (
          <>
            <Link href="/productos/nuevo" className={btn()}>
              <Icon name="plus" className="size-4" /> Nuevo producto
            </Link>
            <Link href="/productos/ajuste" className={btn("secondary")}>
              Subir/bajar precios
            </Link>
            <Link href="/productos/importar" className={btn("secondary")}>
              <Icon name="upload" className="size-4" /> Importar
            </Link>
          </>
        )}
        <a href="/api/products/export" className={btn("secondary")}>
          <Icon name="download" className="size-4" /> CSV
        </a>
      </PageHeader>

      <FilterBar>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end lg:grid-cols-[minmax(0,1fr)_14rem_14rem]">
          <UrlSearch label="Buscar" placeholder="Nombre, código, línea o color" />
          <UrlSelect name="categoria" label="Categoría" options={[{ value: "", label: "Todas" }, ...(categories as string[]).sort().map((c) => ({ value: c, label: c }))]} />
          {editor && (
            <UrlSelect
              name="inactivos"
              label="Mostrar"
              options={[
                { value: "", label: "Activos" },
                { value: "1", label: "Incluir dados de baja" },
              ]}
            />
          )}
        </div>
      </FilterBar>

      <ProductsTable rows={rows} editor={editor} />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} path="/productos" query={{ q: sp.q, categoria: sp.categoria, inactivos: sp.inactivos }} />
    </Page>
  );
}
