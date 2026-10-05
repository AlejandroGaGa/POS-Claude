import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { periodSummary } from "@/lib/cash";
import { formatMoney } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { Page, PageHeader, Section } from "@/components/ui";
import CutForm from "@/components/CutForm";

export const metadata = { title: "Corte de caja" };
export const dynamic = "force-dynamic";

export default async function CortePage() {
  await requirePage("cash:cut");
  await connectDB();
  const s = await periodSummary();
  const rows: [string, number, string?][] = [
    [s.lastCutFolio ? `Fondo que dejó el corte ${s.lastCutFolio}` : "Fondo inicial", s.openingFloat],
    ["Ventas en efectivo", s.cashSales, "+"],
    ["Abonos en efectivo", s.cashPayments, "+"],
    ...(s.returnCharges > 0 ? ([["Diferencias de cambios", s.returnCharges, "+"]] as [string, number, string][]) : []),
    ...(s.refunds > 0 ? ([["Devoluciones en efectivo", s.refunds, "−"]] as [string, number, string][]) : []),
    ["Entradas de caja", s.entries, "+"],
    ["Salidas de caja", s.exits, "−"],
  ];
  return (
    <Page>
      <PageHeader title="Corte de caja" subtitle={`Del ${fmtDate(s.from)} a ahora`} back={{ href: "/caja", label: "Caja" }} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <CutForm expected={s.expected} />
        <Section title="Lo que debe haber" className="xl:sticky xl:top-[calc(var(--sticky-top)+0.75rem)]">
          <dl className="flex flex-col gap-2 tabular">
            {rows.map(([l, v, sign]) => (
              <div key={l} className="flex justify-between text-sm">
                <dt className="text-muted">{l}</dt>
                <dd>
                  {sign && v > 0 ? `${sign} ` : ""}
                  {formatMoney(v)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-separator pt-2 font-semibold">
              <dt>Efectivo esperado</dt>
              <dd>{formatMoney(s.expected)}</dd>
            </div>
          </dl>
          <dl className="mt-4 flex flex-col gap-2 border-t border-dashed border-separator pt-4 text-sm tabular">
            <p className="font-medium">Otros cobros (no van en el efectivo)</p>
            <div className="flex justify-between">
              <dt className="text-muted">Transferencias</dt>
              <dd>{formatMoney(s.byMethod.transferencia)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Terminal</dt>
              <dd>{formatMoney(s.byMethod.terminal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Ventas en el periodo</dt>
              <dd>{s.salesCount}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </Page>
  );
}
