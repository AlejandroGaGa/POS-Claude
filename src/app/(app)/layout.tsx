import { requirePage } from "@/lib/auth";
import { can } from "@/lib/roles";
import Shell, { type NavItem } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  const nav: NavItem[] = [
    { href: "/inicio", label: "Inicio", short: "Inicio", icon: "home", section: "General", primary: true },
    can(user.role, "stats:view") && { href: "/tablero", label: "Tablero", short: "Tablero", icon: "chart", section: "General" },
    { href: "/mostrador", label: "Mostrador", short: "Vender", icon: "cart", section: "General", primary: true },
    { href: "/cotizaciones", label: "Cotizaciones", short: "Cotizar", icon: "doc", section: "General", primary: true },
    { href: "/ventas", label: can(user.role, "sales:viewAll") ? "Ventas" : "Mis ventas", short: "Ventas", icon: "cash", section: "General", primary: true },
    can(user.role, "returns:create") && { href: "/devoluciones", label: "Devoluciones y cambios", short: "Devolver", icon: "undo", section: "General" },
    { href: "/clientes", label: "Clientes", short: "Clientes", icon: "person", section: "General" },
    { href: "/por-cobrar", label: "Por cobrar", short: "Cobrar", icon: "hourglass", section: "General" },
    can(user.role, "cash:move") && { href: "/caja", label: "Caja", short: "Caja", icon: "vault", section: "Gestión" },
    { href: "/facturacion", label: "Datos de facturación", short: "Facturación", icon: "invoice", section: "Gestión" },
    { href: "/productos", label: can(user.role, "products:edit") ? "Productos y precios" : "Lista de precios", short: "Precios", icon: "box", section: "Gestión", primary: true },
    can(user.role, "users:manage") && { href: "/usuarios", label: "Usuarios", short: "Usuarios", icon: "users", section: "Gestión" },
    can(user.role, "settings:edit") && { href: "/ajustes", label: "Ajustes", short: "Ajustes", icon: "gear", section: "Otros" },
  ].filter(Boolean) as NavItem[];

  return (
    <Shell user={user} nav={nav}>
      {children}
    </Shell>
  );
}
