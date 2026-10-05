import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Return } from "@/lib/models/Return";
import { addDays, dayStr, isDayStr, range } from "@/lib/dates";
import { formatMoney } from "@/lib/pricing";
import { normalizeFolio, RETURN_OUTCOME_LABELS, RETURN_OUTCOMES } from "@/lib/returns";
import { escapeRegex, looseRegex } from "@/lib/text";
import { plain } from "@/lib/serialize";
import { FilterBar, Page, PageHeader, Pager, Stat, btn } from "@/components/ui";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import DateRangeFilter from "@/components/DateRangeFilter";
import { UrlSearch, UrlSelect } from "@/components/UrlFilters";
import Icon from "@/components/Icon";
import ReturnsTable, { type ReturnRow } from "@/components/returns/ReturnsTable";

export const metadata = { title: "Devoluciones" };

type SP = { desde?: string; hasta?: string; resultado?: string; q?: string; pagina?: string };

export default async function DevolucionesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePage("returns:create");
  const sp = await searchParams;
  const today = dayStr();
  const desde = isDayStr(sp.desde) ? sp.desde : addDays(today, -29);
  const hasta = isDayStr(sp.hasta) ? sp.hasta : desde > today ? desde : today;
  const q = sp.q?.trim() ?? "";

  await connectDB();
  // Con búsqueda se busca en todas las fechas: lo normal es buscar una devolución vieja por folio o cliente.
  const filter: Record<string, unknown> = q ? {} : { createdAt: range(desde, hasta) };
  if (sp.resultado && (RETURN_OUTCOMES as readonly string[]).includes(sp.resultado)) filter.outcome = sp.resultado;
  if (q) {
    const f = normalizeFolio(q);
    if (f) filter.$or = [{ folio: f.folio }, { saleFolio: f.folio }, { quoteFolio: f.folio }];
    else {
      const rx = looseRegex(q);
      const plainRx = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { folio: plainRx },
        { saleFolio: plainRx },
        { quoteFolio: plainRx },
        { customerName: rx },
        { customerPhone: rx },
        { reason: rx },
        { "returnedItems.name": rx },
        { "newItems.name": rx },
      ];
    }
  }
  const page = parsePage(sp.pagina);
  const [list, light] = await Promise.all([
    paginate(Return.find(filter).sort({ createdAt: -1 }), Return.countDocuments(filter), page),
    Return.find(filter).select("returnedTotal refundAmount chargeAmount waivedAmount").lean(),
  ]);
  const sum = (k: "returnedTotal" | "refundAmount" | "chargeAmount" | "waivedAmount") => light.reduce((a, r) => a + (r[k] ?? 0), 0);

  const outcomeOpts = [{ value: "", label: "Todas" }, ...RETURN_OUTCOMES.map((o) => ({ value: o, label: RETURN_OUTCOME_LABELS[o] }))];

  return (
    <Page>
      <PageHeader title="Devoluciones y cambios" subtitle="Cada devolución queda registrada con lo que regresó, lo que se llevó y cómo se resolvió.">
        <Link href="/devoluciones/nueva" className={btn("primary")}>
          <Icon name="undo" className="size-4" /> Nueva devolución
        </Link>
      </PageHeader>

      <FilterBar>
        {!q && <DateRangeFilter desde={desde} hasta={hasta} label="Periodo" />}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:items-end">
          <UrlSearch label="Buscar (en todas las fechas)" placeholder="Folio D-/V-/C-, cliente, teléfono o producto" className="col-span-2" />
          <UrlSelect name="resultado" label="Cómo se resolvió" options={outcomeOpts} className="col-span-2 md:col-span-1" />
        </div>
      </FilterBar>

      <div data-results className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Devoluciones" value={String(light.length)} num={{ value: light.length, money: false }} hint={`${formatMoney(sum("returnedTotal"))} en producto`} />
        <Stat label="Regresado en efectivo" value={formatMoney(sum("refundAmount"))} num={{ value: sum("refundAmount") }} />
        <Stat label="Cobrado por diferencias" value={formatMoney(sum("chargeAmount"))} num={{ value: sum("chargeAmount") }} />
        <Stat label="Cortesías" value={formatMoney(sum("waivedAmount"))} num={{ value: sum("waivedAmount") }} hint="Lo que absorbió el negocio" />
      </div>

      <ReturnsTable rows={plain<ReturnRow[]>(list.rows)} />
      <Pager page={page} pageSize={PAGE_SIZE} total={list.total} path="/devoluciones" query={{ desde: sp.desde, hasta: sp.hasta, resultado: sp.resultado, q: sp.q }} />
    </Page>
  );
}
