import Link from "next/link";
import { Types } from "mongoose";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Sale } from "@/lib/models/Sale";
import { Customer } from "@/lib/models/Customer";
import { periodSummary } from "@/lib/cash";
import { can } from "@/lib/roles";
import { dayStr, range } from "@/lib/dates";
import { formatMoney } from "@/lib/pricing";
import { Page, PageHeader } from "@/components/ui";
import HomeTiles, { type Tile } from "@/components/HomeTiles";
import Icon, { type IconName } from "@/components/Icon";
import { AnimatedNumber } from "@/components/motion";

export const metadata = { title: "Inicio" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: process.env.NEXT_PUBLIC_TZ || "America/Mexico_City" }).format(new Date()));
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function Info({ href, icon, label, value, money = true, hint }: { href: string; icon: IconName; label: string; value: number; money?: boolean; hint: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--overlay-shadow)] focus-visible:ring-2 focus-visible:ring-focus sm:p-5"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-default text-foreground">
        <Icon name={icon} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted">{label}</span>
        <span className="font-display block text-2xl leading-tight tabular">
          <AnimatedNumber value={value} money={money} countUp />
        </span>
        <span className="block truncate text-sm text-muted">{hint}</span>
      </span>
      <Icon name="next" className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default async function InicioPage() {
  const user = await requirePage();
  await connectDB();
  const viewAll = can(user.role, "sales:viewAll");
  const canCut = can(user.role, "cash:cut");
  const canCash = can(user.role, "cash:move");
  const today = dayStr();

  const salesFilter: Record<string, unknown> = { kind: "venta", status: { $ne: "cancelada" }, createdAt: range(today, today) };
  const owedFilter: Record<string, unknown> = { kind: "venta", status: { $ne: "cancelada" }, balance: { $gt: 0 } };
  if (!viewAll) {
    salesFilter.seller = new Types.ObjectId(user.id);
    owedFilter.seller = new Types.ObjectId(user.id);
  }
  const [todaySales, quotes, owed, cash] = await Promise.all([
    Sale.find(salesFilter).select("total").lean(),
    Sale.countDocuments({ kind: "cotizacion", status: "vigente" }),
    Sale.find(owedFilter).select("balance").lean(),
    canCash ? periodSummary() : Promise.resolve(null),
  ]);
  const customers = cash ? 0 : await Customer.countDocuments({ active: true });
  const todayTotal = todaySales.reduce((a, s) => a + s.total, 0);
  const owedTotal = owed.reduce((a, s) => a + (s.balance ?? 0), 0);

  const tiles: Tile[] = [
    { key: "venta", title: "Nueva venta", hint: "Cotiza y cobra en el mostrador", icon: "cart", href: "/mostrador", primary: true },
    { key: "precios", title: "Consultar precios", hint: "Busca por nombre, código o color", icon: "search", href: "/productos" },
    { key: "cliente", title: "Registrar cliente", hint: "Nombre, teléfono y datos de factura", icon: "personPlus", action: "nuevo-cliente" },
    canCut
      ? { key: "corte", title: "Corte de caja", hint: "Cuenta el efectivo y cierra el día", icon: "calculator", href: "/caja/corte" }
      : canCash
        ? { key: "caja", title: "Caja", hint: "Registra entradas y gastos", icon: "vault", href: "/caja" }
        : { key: "cotizaciones", title: "Cotizaciones", hint: "Cobra o edita una cotización", icon: "doc", href: "/cotizaciones" },
  ];
  const firstName = user.name.split(" ")[0];
  const date = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: process.env.NEXT_PUBLIC_TZ || "America/Mexico_City" }).format(new Date());

  return (
    <Page>
      <PageHeader title={`${greeting()}, ${firstName}`} subtitle={`${date.charAt(0).toUpperCase()}${date.slice(1)} · ¿Qué quieres hacer?`} />

      <HomeTiles tiles={tiles} canCredit={can(user.role, "customers:credit")} />

      <section aria-label="Resumen de hoy" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Info href="/ventas" icon="cash" label={viewAll ? "Vendido hoy" : "Mis ventas de hoy"} value={todayTotal} hint={`${todaySales.length} venta(s)`} />
        <Info href="/cotizaciones" icon="doc" label="Cotizaciones pendientes" value={quotes} money={false} hint="Toca para cobrar o editar" />
        <Info href="/por-cobrar" icon="hourglass" label="Por cobrar" value={owedTotal} hint={`${owed.length} nota(s) con saldo`} />
        {cash ? (
          <Info href="/caja" icon="vault" label="Efectivo en caja" value={cash.expected} hint="Debe haber según el sistema" />
        ) : (
          <Info href="/clientes" icon="person" label="Clientes" value={customers} money={false} hint="Busca o registra clientes" />
        )}
      </section>
    </Page>
  );
}
