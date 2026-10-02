import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { CashCut } from "@/lib/models/Cash";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import { formatMoney } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { Page, PageHeader, Pager, btn } from "@/components/ui";
import DataTable from "@/components/DataTable";
import Link from "next/link";
import Icon from "@/components/Icon";

export const metadata = { title: "Cortes de caja" };

export default async function CortesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await requirePage("cash:cut");
  const page = parsePage((await searchParams).pagina);
  await connectDB();
  const { rows, total } = await paginate(CashCut.find().sort({ to: -1 }), CashCut.countDocuments(), page);
  return (
    <Page>
      <PageHeader title="Cortes de caja" subtitle="Historial de cortes con su diferencia." back={{ href: "/caja", label: "Caja" }}>
        <Link href="/caja/corte" className={btn("primary")}>
          <Icon name="calculator" className="size-4" /> Hacer corte
        </Link>
      </PageHeader>
      <DataTable
        label="Cortes de caja"
        emptyIcon="calculator"
        empty={{ title: "Aún no hay cortes", text: "Haz el primero al cerrar el día." }}
        aside="counted"
        columns={[
          { key: "folio", label: "Corte" },
          { key: "period", label: "Periodo" },
          { key: "expected", label: "Esperado", align: "right" },
          { key: "counted", label: "Contado", align: "right" },
          { key: "diff", label: "Diferencia", align: "right" },
          { key: "left", label: "Fondo que quedó", align: "right", hideOnMobile: true },
        ]}
        rows={rows.map((c) => ({
          id: String(c._id),
          href: `/cortes/${String(c._id)}`,
          cells: {
            folio: (
              <span>
                <span className="font-semibold tabular">{c.folio}</span>
                <span className="block text-xs text-muted">por {c.userName}</span>
              </span>
            ),
            period: <span className="text-sm text-muted md:whitespace-nowrap">{fmtDate(c.from)} → {fmtDate(c.to)}</span>,
            expected: formatMoney(c.expected),
            counted: formatMoney(c.counted),
            diff: <span className={Math.abs(c.difference) < 0.01 ? "text-ok" : c.difference < 0 ? "text-bad" : "text-warn"}>{Math.abs(c.difference) < 0.01 ? "Cuadra" : formatMoney(c.difference)}</span>,
            left: formatMoney(c.leftFloat),
          },
        }))}
      />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} path="/caja/cortes" query={{}} />
    </Page>
  );
}
