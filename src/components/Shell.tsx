"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, Drawer, Kbd, SearchField } from "@heroui/react";
import { ROLE_LABELS } from "@/lib/roles";
import type { SessionUser } from "@/lib/session";
import { btn, cx } from "./ui";
import Icon, { type IconName } from "./Icon";
import Logo from "./Logo";
import { motion } from "framer-motion";
import { PILL_SPRING } from "./motion";
import ThemeToggle from "./ThemeToggle";
import AppFooter from "./AppFooter";
import { APP_VERSION } from "@/lib/brand";
import { TopProgress } from "./NavProgress";

export interface NavItem {
  href: string;
  label: string;
  /** Etiqueta corta para la barra inferior en celular. */
  short: string;
  icon: IconName;
  section: "General" | "Gestión" | "Otros";
  /** Aparece en la barra inferior del celular. */
  primary?: boolean;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Buscador global: lleva a la lista de precios filtrada. ⌘K / Ctrl+K lo enfoca. */
function GlobalSearch({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <SearchField
      variant="secondary"
      aria-label="Buscar producto"
      value={q}
      onChange={setQ}
      onSubmit={(v) => {
        if (!v.trim()) return;
        router.push(`/productos?q=${encodeURIComponent(v.trim())}`);
        setQ("");
        onDone?.();
      }}
      className="w-full"
    >
      <SearchField.Group className="h-11 rounded-xl">
        <SearchField.SearchIcon />
        <SearchField.Input ref={ref} placeholder="Buscar precio…" />
        <SearchField.ClearButton />
        <Kbd className="mr-2 hidden lg:inline-flex" aria-hidden>
          <Kbd.Abbr keyValue="command" />
          <Kbd.Content>K</Kbd.Content>
        </Kbd>
      </SearchField.Group>
    </SearchField>
  );
}

function NavList({ nav, pathname, onNavigate, pillId }: { nav: NavItem[]; pathname: string; onNavigate?: () => void; pillId: string }) {
  const sections = ["General", "Gestión", "Otros"] as const;
  return (
    <nav aria-label="Principal" className="flex flex-col gap-3.5">
      {sections.map((s) => {
        const items = nav.filter((n) => n.section === s);
        if (!items.length) return null;
        return (
          <div key={s}>
            <p className="mb-1 px-3 text-xs font-semibold tracking-wider text-muted uppercase">{s}</p>
            <ul className="flex flex-col gap-0.5">
              {items.map((n) => {
                const active = pathname === n.href || pathname.startsWith(n.href + "/");
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus",
                        active ? "text-foreground" : "text-muted hover:bg-default/50 hover:text-foreground",
                      )}
                    >
                      {active && <motion.span layoutId={pillId} transition={PILL_SPRING} className="absolute inset-0 rounded-xl bg-default" />}
                      <Icon name={n.icon} className={cx("relative size-5 transition-colors", active && "text-accent")} />
                      <span className="relative">{n.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Versión del sistema en la barra lateral / menú. */
function VersionTag() {
  return (
    <div className="flex items-center justify-between self-stretch px-3 text-xs text-muted">
      <span>Versión</span>
      <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent-soft-foreground tabular">{APP_VERSION}</span>
    </div>
  );
}

function UserCard({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-secondary p-2.5">
      <Avatar size="sm" color="accent">
        <Avatar.Fallback>{initials(user.name)}</Avatar.Fallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="truncate text-xs text-muted">{ROLE_LABELS[user.role]}</p>
      </div>
      <button
        onClick={onLogout}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-default hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Icon name="logout" />
      </button>
    </div>
  );
}

export default function Shell({ user, nav, children }: { user: SessionUser; nav: NavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const bottom = nav.filter((n) => n.primary).slice(0, 5);
  const canSell = nav.some((n) => n.href === "/mostrador");
  /** Pantallas que se ajustan al alto de la ventana (sin scroll de página). */
  const fitScreen = pathname === "/mostrador";

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-[100dvh] lg:flex lg:gap-2 lg:p-3">
      <TopProgress />
      {/* Sidebar de escritorio */}
      <aside className="no-print sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-[272px] shrink-0 flex-col gap-4 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] lg:flex">
        <Logo />
        <GlobalSearch />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavList nav={nav} pathname={pathname} pillId="nav-pill-side" />
        </div>
        <div className="flex flex-col gap-2">
          <VersionTag />
          <ThemeToggle withLabel />
          <UserCard user={user} onLogout={logout} />
        </div>
      </aside>

      {/* Barra superior en celular/tablet */}
      <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-1.5 border-b border-separator bg-background/85 px-3 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="flex size-11 items-center justify-center rounded-xl hover:bg-default outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Icon name="menu" />
        </button>
        <Logo compact />
        <ThemeToggle className="ml-auto shrink-0" />
        {canSell && (
          <Link href="/mostrador" aria-label="Nueva venta" className={btn("primary", "min-h-10 shrink-0 px-3 text-sm min-[400px]:px-4")}>
            <Icon name="plus" className="size-4" />
            <span className="max-[399px]:sr-only">Venta</span>
          </Link>
        )}
      </header>

      <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Drawer.Content placement="left">
          <Drawer.Dialog className="w-[300px] max-w-[85vw]" aria-label="Menú">
            <Drawer.CloseTrigger aria-label="Cerrar menú" />
            <Drawer.Header>
              <Drawer.Heading className="sr-only">Menú</Drawer.Heading>
              <Logo />
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-5">
              <GlobalSearch onDone={() => setOpen(false)} />
              <NavList nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} pillId="nav-pill-drawer" />
            </Drawer.Body>
            <Drawer.Footer className="flex flex-col gap-2">
              <VersionTag />
              <ThemeToggle withLabel />
              <UserCard user={user} onLogout={logout} />
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <main
        className={cx(
          "flex min-w-0 flex-1 flex-col px-3 pt-1 sm:px-5 lg:px-5 lg:pt-0",
          // El mostrador ocupa exactamente la pantalla: sin scroll de la ventana, cada panel se desplaza por dentro.
          // overflow-clip (no hidden) para no volverse contenedor de scroll y no desfasar el encabezado sticky.
          fitScreen
            ? "h-[calc(100dvh-var(--app-top)-var(--app-bottom))] overflow-clip lg:h-[calc(100dvh-1.5rem)]"
            : "min-h-[calc(100dvh-4rem)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:min-h-[calc(100dvh-1.5rem)] lg:pb-3",
        )}
      >
        <div className={cx("flex-1", fitScreen && "min-h-0")}>{children}</div>
        {!fitScreen && <AppFooter className="mx-auto mt-8 w-full max-w-[1400px]" />}
      </main>

      {/* Barra inferior en celular: lo que más se usa en mostrador a un toque */}
      <nav
        aria-label="Accesos rápidos"
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-separator bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${bottom.length}, minmax(0, 1fr))` }}>
          {bottom.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium outline-none transition-colors focus-visible:bg-default",
                    active ? "text-accent" : "text-muted hover:text-foreground",
                  )}
                >
                  <span className="relative flex h-7 w-12 items-center justify-center">
                    {active && <motion.span layoutId="bottom-pill" transition={PILL_SPRING} className="absolute inset-0 rounded-full bg-accent-soft" />}
                    <Icon name={n.icon} className="relative size-5" />
                  </span>
                  {n.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
