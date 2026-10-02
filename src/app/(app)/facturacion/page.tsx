import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { BillingProfile } from "@/lib/models/BillingProfile";
import { escapeRegex } from "@/lib/text";
import { plain } from "@/lib/serialize";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import { FilterBar, Page, PageHeader, Pager } from "@/components/ui";
import { UrlSearch } from "@/components/UrlFilters";
import DataTable from "@/components/DataTable";
import { BillingRowActions, NewBillingButton, type BillingJSON } from "@/components/BillingForm";

export const metadata = { title: "Datos de facturación" };

export default async function FacturacionPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  await requirePage("customers:manage");
  const sp = await searchParams;
  const page = parsePage(sp.pagina);
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (sp.q?.trim()) {
    const rx = new RegExp(escapeRegex(sp.q.trim()), "i");
    filter.$or = [{ legalName: rx }, { rfc: rx }, { customerName: rx }, { email: rx }];
  }
  const { rows, total } = await paginate(BillingProfile.find(filter).sort({ legalName: 1 }), BillingProfile.countDocuments(filter), page);
  const list = plain<BillingJSON[]>(rows);

  return (
    <Page>
      <PageHeader title="Datos de facturación" subtitle="Razón social, RFC y régimen de tus clientes, listos para copiar al facturar.">
        <NewBillingButton />
      </PageHeader>

      <FilterBar>
        <UrlSearch label="Buscar" placeholder="Razón social, RFC, cliente o correo" />
      </FilterBar>

      <DataTable
        label="Datos de facturación"
        emptyIcon="invoice"
        empty={{ title: "Sin datos fiscales", text: "Agrega los datos de un cliente para tenerlos a la mano al facturar." }}
        columns={[
          { key: "legal", label: "Razón social" },
          { key: "rfc", label: "RFC" },
          { key: "customer", label: "Cliente" },
          { key: "regime", label: "Régimen / uso", hideOnMobile: true },
          { key: "zip", label: "C.P." },
          { key: "actions", label: "", align: "right" },
        ]}
        rows={list.map((b) => ({
          id: b._id,
          cells: {
            legal: (
              <span>
                <span className="font-medium">{b.legalName}</span>
                {b.email && <span className="block text-xs text-muted">{b.email}</span>}
              </span>
            ),
            rfc: <span className="tabular">{b.rfc}</span>,
            customer: (
              <Link href={`/clientes/${b.customer}`} className="text-accent hover:underline">
                {b.customerName}
              </Link>
            ),
            regime: <span className="text-xs text-muted">{[b.taxRegime, b.cfdiUse].filter(Boolean).join(" · ") || "—"}</span>,
            zip: b.zip || "—",
            actions: <BillingRowActions profile={b} />,
          },
        }))}
      />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} path="/facturacion" query={{ q: sp.q }} />
    </Page>
  );
}
