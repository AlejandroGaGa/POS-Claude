import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { addDays, dayStr, isDayStr } from "@/lib/dates";
import { getPeriodTotal, getStats } from "@/lib/stats";
import { Sale } from "@/lib/models/Sale";
import { Product } from "@/lib/models/Product";
import { availableModes, formatMoney, formatNumber, PAYMENT_LABELS, type PaymentMethod, type ProductPricing } from "@/lib/pricing";
import { plain } from "@/lib/serialize";
import { Card, CardTitle, FilterBar, Page, PageHeader, Stat, btn, cx } from "@/components/ui";
import { DailyColumns, HBars } from "@/components/charts";
import DateRangeFilter from "@/components/DateRangeFilter";
import TopProductsTable from "@/components/dash/TopProductsTable";
import QuoteTicket, { type QuoteTicketData } from "@/components/dash/QuoteTicket";
import Icon from "@/components/Icon";
import { FadeUp, Reveal, Stagger } from "@/components/motion";

export const metadata = { title: "Tablero" };

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: process.env.NEXT_PUBLIC_TZ || "America/Mexico_City" }).format(new Date()));
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default async function TableroPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const user = await requirePage("stats:view");
  const sp = await searchParams;
  const today = dayStr();
  const hasta = isDayStr(sp.hasta) ? sp.hasta : today;
  const desde = isDayStr(sp.desde) && sp.desde <= hasta ? sp.desde : addDays(hasta, -29);
  const n = daysBetween(desde, hasta);
  await connectDB();

  const [st, prevTotal, pendingQuotes, products] = await Promise.all([
    getStats(desde, hasta),
    getPeriodTotal(addDays(desde, -n), addDays(desde, -1)),
    Sale.find({ kind: "cotizacion", status: "vigente" }).sort({ createdAt: -1 }).limit(4).lean(),
    Product.find({ active: true }).select("unitType price pricePerMeter bars pricePerM2 pricePerM2Vidriero sheets").lean(),
  ]);
  const noPrice = products.filter((p) => availableModes(p as unknown as ProductPricing).length === 0).length;
  const delta = prevTotal > 0 ? ((st.total - prevTotal) / prevTotal) * 100 : null;

  // Días sin ventas también se grafican para que la serie sea continua.
  const map = new Map(st.byDay.map((d) => [d._id, d]));
  const days: { day: string; total: number; count: number }[] = [];
  for (let d = desde, i = 0; d <= hasta && i < 400; d = addDays(d, 1), i++) days.push({ day: d, total: map.get(d)?.total ?? 0, count: map.get(d)?.count ?? 0 });

  const top = st.topProducts[0];
  const firstName = user.name.split(" ")[0];

  return (
    <Page>
      <PageHeader title="Tablero" subtitle={`${greeting()}, ${firstName}. Así va el negocio.`}>
        <Link href="/mostrador" className={btn("primary", "max-md:hidden")}>
          <Icon name="plus" className="size-4" /> Nueva venta
        </Link>
      </PageHeader>

      <FilterBar>
        <DateRangeFilter desde={desde} hasta={hasta} label="Periodo del tablero" />
      </FilterBar>

      {/* Resumen del periodo (banner oscuro) */}
      <FadeUp>
      <section
        aria-label="Resumen del periodo"
        className="relative overflow-hidden rounded-3xl p-5 text-[color:var(--hero-fg)] sm:p-6"
        style={{ background: "linear-gradient(120deg, var(--hero-from), var(--hero-to))" }}
      >
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/20 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <p className="font-display flex items-center gap-2 text-lg">
            <Icon name="sparkles" className="size-5" /> Resumen del periodo
          </p>
          <p className="text-sm text-[color:var(--hero-fg-soft)]">{n === 1 ? "1 día" : `${n} días`}</p>
        </div>
        <p className="relative mt-3 max-w-4xl text-[17px] leading-relaxed text-[color:var(--hero-fg-soft)]">
          Llevas <strong className="text-[color:var(--hero-fg)]">{formatMoney(st.total)}</strong> en {st.count} venta(s)
          {delta !== null && (
            <>
              {", "}
              <span className={cx("font-semibold", delta >= 0 ? "text-emerald-300" : "text-rose-300")}>
                {delta >= 0 ? "▲" : "▼"} {formatNumber(Math.abs(delta), 0)}%
              </span>{" "}
              contra el periodo anterior
            </>
          )}
          .{top && (
            <>
              {" "}
              Lo que más deja es <span className="font-semibold text-amber-200">{top.name}</span>.
            </>
          )}{" "}
          {st.quotes.pending > 0 ? `Tienes ${st.quotes.pending} cotización(es) por cobrar.` : "No hay cotizaciones pendientes."}
          {noPrice > 0 && ` ${noPrice} producto(s) siguen sin precio.`}
        </p>
      </section>
      </FadeUp>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <FadeUp className="col-span-2 sm:col-span-1">
        <Stat
          label="Vendido"
          value={formatMoney(st.total)}
          num={{ value: st.total }}
          emphasis
          className="h-full"
          hint={
            delta !== null ? (
              <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", delta >= 0 ? "bg-success-soft text-success-soft-foreground" : "bg-danger-soft text-danger-soft-foreground")}>
                <Icon name={delta >= 0 ? "up" : "down"} className="size-3.5" />
                {formatNumber(Math.abs(delta), 0)}% vs. anterior
              </span>
            ) : (
              "Sin periodo anterior para comparar"
            )
          }
        />
        </FadeUp>
        <FadeUp delay={0.04}>
          <Stat label="Ventas" value={formatNumber(st.count)} num={{ value: st.count, money: false }} className="h-full" hint={[st.cancelled ? `${st.cancelled} cancelada(s)` : "Sin cancelaciones", st.returns.count ? `${st.returns.count} devolución(es): ${formatMoney(st.returns.refunded)} regresado` : ""].filter(Boolean).join(" · ")} />
        </FadeUp>
        <FadeUp delay={0.08}>
          <Stat label="Ticket promedio" value={formatMoney(st.avg)} num={{ value: st.avg }} className="h-full" />
        </FadeUp>
        <FadeUp delay={0.12} className="col-span-2 sm:col-span-1">
        <Stat
          label="Cotizaciones cobradas"
          value={`${formatNumber(st.quotes.rate * 100, 0)}%`}
          num={{ value: st.quotes.rate * 100, money: false, suffix: "%" }}
          hint={`${st.quotes.converted} de ${st.quotes.count}`}
          className="h-full"
        />
        </FadeUp>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Reveal delay={0.1}><Card>
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <CardTitle>Ventas por día</CardTitle>
              <span className="hidden text-sm text-muted sm:inline">Pasa el cursor por una barra para ver el detalle</span>
            </div>
            <DailyColumns days={days} />
          </Card></Reveal>

          <Reveal delay={0.14}><Card>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <CardTitle>Productos más vendidos</CardTitle>
              <Link href={`/ventas?desde=${desde}&hasta=${hasta}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                Ver ventas
              </Link>
            </div>
            <TopProductsTable rows={st.topProducts} grandTotal={st.byCategory.reduce((a, c) => a + c.total, 0)} />
          </Card></Reveal>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Reveal delay={0.18} className="h-full"><Card className="h-full">
              <CardTitle className="mb-4">Por método de pago</CardTitle>
              <HBars
                label="Ventas por método de pago"
                rows={st.byMethod.map((m) => ({
                  name: PAYMENT_LABELS[m._id as PaymentMethod] ?? m._id,
                  value: m.total,
                  extra: `${m.count} venta(s)${m.commission ? ` · comisión ${formatMoney(m.commission)}` : ""}`,
                }))}
              />
              {st.commission > 0 && <p className="mt-4 text-sm text-muted">Comisiones de terminal cobradas: {formatMoney(st.commission)}</p>}
            </Card></Reveal>
            <Reveal delay={0.22} className="h-full"><Card className="h-full">
              <CardTitle className="mb-4">Por vendedor</CardTitle>
              <HBars label="Ventas por vendedor" rows={st.bySeller.map((s) => ({ name: s._id || "—", value: s.total, extra: `${s.count} venta(s)` }))} />
            </Card></Reveal>
          </div>
        </div>

        {/* Rail de cotizaciones pendientes */}
        <aside aria-label="Cotizaciones pendientes" className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] sm:p-5 xl:sticky xl:top-[calc(var(--sticky-top)+0.75rem)] xl:self-start">
          <div className="flex items-center justify-between">
            <CardTitle>Por cobrar</CardTitle>
            <Link href="/mostrador" aria-label="Nueva cotización" className="flex size-10 items-center justify-center rounded-full hover:bg-default">
              <Icon name="plus" />
            </Link>
          </div>
          {pendingQuotes.length === 0 ? (
            <p className="rounded-2xl bg-surface-secondary p-6 text-center text-muted">No hay cotizaciones pendientes.</p>
          ) : (
            <Stagger className="flex flex-col gap-3">
              {plain<QuoteTicketData[]>(pendingQuotes).map((q) => (
                <QuoteTicket key={q._id} q={q} compact />
              ))}
            </Stagger>
          )}
          <Link href="/cotizaciones" className={btn("secondary", "w-full")}>
            Ver todas las cotizaciones
          </Link>
          <div className="mt-2 border-t border-separator pt-4">
            <CardTitle as="h3" className="mb-3">
              Por categoría
            </CardTitle>
            <HBars label="Ventas por categoría" rows={st.byCategory.map((c) => ({ name: c._id || "Sin categoría", value: c.total }))} />
          </div>
        </aside>
      </div>
    </Page>
  );
}
