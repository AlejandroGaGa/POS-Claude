import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { CashMovement, CASH_BOX_LABELS } from "@/lib/models/Cash";
import { boxBalance, periodSummary } from "@/lib/cash";
import { can } from "@/lib/roles";
import { escapeRegex } from "@/lib/text";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/paginate";
import { formatMoney } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { Badge, Card, CardTitle, FilterBar, Page, PageHeader, Pager, btn } from "@/components/ui";
import { UrlSearch, UrlSelect } from "@/components/UrlFilters";
import DataTable from "@/components/DataTable";
import { CashButton } from "@/components/CashDialogs";
import { AnimatedNumber } from "@/components/motion";
import Icon from "@/components/Icon";

export const metadata = { title: "Caja" };

type SP = { caja?: string; tipo?: string; q?: string; pagina?: string };

function Line({ label, value, sign, strong }: { label: string; value: number; sign?: "+" | "−"; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t border-separator pt-2 font-semibold" : "flex justify-between text-sm"}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular">
        {sign && value > 0 ? `${sign} ` : ""}
        {formatMoney(value)}
      </dd>
    </div>
  );
}

export default async function CajaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePage("cash:move");
  const sp = await searchParams;
  const page = parsePage(sp.pagina);
  await connectDB();

  const filter: Record<string, unknown> = {};
  if (sp.caja === "caja" || sp.caja === "chica") filter.box = sp.caja;
  if (sp.tipo === "entrada" || sp.tipo === "salida") filter.type = sp.tipo;
  if (sp.q?.trim()) {
    const rx = new RegExp(escapeRegex(sp.q.trim()), "i");
    filter.$or = [{ concept: rx }, { description: rx }, { userName: rx }];
  }
  const [sum, chica, list] = await Promise.all([
    periodSummary(),
    boxBalance("chica"),
    paginate(CashMovement.find(filter).sort({ createdAt: -1 }), CashMovement.countDocuments(filter), page),
  ]);
  const canCut = can(user.role, "cash:cut");

  return (
    <Page>
      <PageHeader title="Caja" subtitle={`Periodo desde ${sum.lastCutFolio ? `el corte ${sum.lastCutFolio}` : "el inicio del día"} · ${fmtDate(sum.from)}`}>
        <CashButton type="entrada" chicaBalance={chica}>
          <Icon name="down" className="size-4" /> Entrada
        </CashButton>
        <CashButton type="salida" chicaBalance={chica}>
          <Icon name="up" className="size-4" /> Salida
        </CashButton>
        <CashButton type="traspaso" chicaBalance={chica}>
          <Icon name="transfer" className="size-4" /> Traspaso
        </CashButton>
        {canCut && (
          <Link href="/caja/corte" className={btn("primary")}>
            <Icon name="calculator" className="size-4" /> Hacer corte
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-muted">Efectivo que debe haber en caja</p>
              <p className="font-display mt-1 text-3xl tabular sm:text-4xl">
                <AnimatedNumber value={sum.expected} countUp />
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
              <Icon name="vault" />
            </span>
          </div>
          <dl className="flex flex-col gap-1.5">
            <Line label={sum.lastCutFolio ? `Fondo que dejó el corte ${sum.lastCutFolio}` : "Fondo inicial"} value={sum.openingFloat} />
            <Line label="Ventas en efectivo" value={sum.cashSales} sign="+" />
            <Line label="Abonos en efectivo" value={sum.cashPayments} sign="+" />
            {sum.returnCharges > 0 && <Line label="Diferencias de cambios" value={sum.returnCharges} sign="+" />}
            {sum.refunds > 0 && <Line label="Devoluciones en efectivo" value={sum.refunds} sign="−" />}
            <Line label="Entradas" value={sum.entries} sign="+" />
            <Line label="Salidas" value={sum.exits} sign="−" />
          </dl>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-muted">Caja chica</p>
              <p className="font-display mt-1 text-3xl tabular sm:text-4xl">
                <AnimatedNumber value={chica} countUp />
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-success-soft text-success-soft-foreground">
              <Icon name="wallet" />
            </span>
          </div>
          <p className="text-sm text-muted">Efectivo para gastos menores. Ponle fondo cada día y registra cada gasto.</p>
          <div className="mt-auto grid grid-cols-2 gap-2">
            <CashButton type="entrada" box="chica" chicaBalance={chica} className="min-h-10 px-3 text-sm">
              <Icon name="plus" className="size-4" /> Poner fondo
            </CashButton>
            <CashButton type="salida" box="chica" chicaBalance={chica} className="min-h-10 px-3 text-sm">
              <Icon name="minus" className="size-4" /> Gasto
            </CashButton>
          </div>
        </Card>

        <Card className="flex flex-col gap-3 md:col-span-2 xl:col-span-1">
          <CardTitle>Cobrado en el periodo</CardTitle>
          <dl className="flex flex-col gap-1.5">
            <Line label="Efectivo" value={sum.byMethod.efectivo} />
            <Line label="Transferencia" value={sum.byMethod.transferencia} />
            <Line label="Terminal (incluye comisión)" value={sum.byMethod.terminal} />
            <Line label="Total cobrado" value={sum.byMethod.efectivo + sum.byMethod.transferencia + sum.byMethod.terminal} strong />
          </dl>
          <p className="text-sm text-muted">
            {sum.salesCount} venta(s){sum.returnsCount > 0 ? ` · ${sum.returnsCount} devolución(es)` : ""}{sum.pendingCredit > 0 ? ` · ${formatMoney(sum.pendingCredit)} quedaron a crédito` : ""}
          </p>
          {canCut && (
            <Link href="/caja/cortes" className="mt-auto text-sm font-medium text-accent hover:underline">
              Ver cortes anteriores →
            </Link>
          )}
        </Card>
      </div>

      <FilterBar>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem] md:items-end">
          <UrlSearch label="Buscar" placeholder="Concepto, detalle o usuario" className="col-span-2 md:col-span-1" />
          <UrlSelect name="caja" label="Caja" options={[{ value: "", label: "Ambas" }, { value: "caja", label: "Mostrador" }, { value: "chica", label: "Caja chica" }]} />
          <UrlSelect name="tipo" label="Tipo" options={[{ value: "", label: "Todos" }, { value: "entrada", label: "Entradas" }, { value: "salida", label: "Salidas" }]} />
        </div>
      </FilterBar>

      <DataTable
        label="Movimientos de caja"
        emptyIcon="vault"
        empty={{ title: "Sin movimientos", text: "Registra entradas, salidas o el fondo de la caja chica." }}
        aside="amount"
        columns={[
          { key: "concept", label: "Concepto" },
          { key: "box", label: "Caja" },
          { key: "date", label: "Fecha" },
          { key: "user", label: "Registró", hideOnMobile: true },
          { key: "amount", label: "Cantidad", align: "right" },
        ]}
        rows={list.rows.map((m) => ({
          id: String(m._id),
          cells: {
            concept: (
              <span>
                <span className="flex items-center gap-2 font-medium">
                  <span className={m.type === "entrada" ? "flex size-6 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground" : "flex size-6 items-center justify-center rounded-full bg-danger-soft text-danger-soft-foreground"}>
                    <Icon name={m.type === "entrada" ? "down" : "up"} className="size-3.5" />
                  </span>
                  {m.concept}
                </span>
                {m.description && <span className="block pl-8 text-xs text-muted">{m.description}</span>}
              </span>
            ),
            box: <Badge tone={m.box === "chica" ? "ok" : "neutral"}>{CASH_BOX_LABELS[m.box as "caja" | "chica"]}</Badge>,
            date: <span className="whitespace-nowrap text-muted">{fmtDate(m.createdAt)}</span>,
            user: m.userName,
            amount: <span className={m.type === "entrada" ? "text-ok" : "text-bad"}>{m.type === "entrada" ? "+" : "−"} {formatMoney(m.amount)}</span>,
          },
        }))}
      />
      <Pager page={page} pageSize={PAGE_SIZE} total={list.total} path="/caja" query={{ caja: sp.caja, tipo: sp.tipo, q: sp.q }} />
    </Page>
  );
}
