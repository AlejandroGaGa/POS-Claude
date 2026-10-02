import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { AnimatedNumber } from "./motion";
import Link from "next/link";
import StickyHeader from "./StickyHeader";
import { PendingLink } from "./NavProgress";
import Icon from "./Icon";

/**
 * Primitivas ligeras con el mismo lenguaje visual que HeroUI (botones tipo píldora,
 * campos redondeados, tarjetas blancas sobre fondo cálido). Se usan en formularios
 * nativos; los componentes interactivos complejos usan HeroUI directamente.
 */

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm",
  secondary: "bg-surface text-foreground border border-border hover:bg-surface-secondary",
  danger: "bg-danger text-danger-foreground hover:bg-danger-hover",
  ghost: "bg-transparent text-foreground hover:bg-default",
};

export function btn(variant: Variant = "primary", extra = "") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full px-5 min-h-11 text-[15px] font-semibold transition-[background-color,color,transform,box-shadow] duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
    variants[variant],
    extra,
  );
}

/** Indicador giratorio pequeño (hereda el color del texto). */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cx("shrink-0 animate-spin", className)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Botón del sistema. Con `loading` muestra un indicador y queda deshabilitado,
 * sin cambiar su texto (la etiqueta no "salta" ni se reemplaza por "Cargando…").
 */
export function Button({ variant = "primary", className, loading = false, children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button {...props} disabled={disabled || loading} aria-busy={loading || undefined} className={btn(variant, cx(loading && "disabled:cursor-wait disabled:opacity-80", className))}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Campos: mismo aspecto que los de HeroUI (variante "secondary"): relleno gris, 44 px, redondeados. */
export const inputCls =
  "w-full min-h-11 rounded-xl border border-transparent bg-default px-3.5 text-base text-field-foreground placeholder:text-field-placeholder outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:bg-default-hover focus:border-accent focus:bg-surface focus-visible:ring-2 focus-visible:ring-focus/25 disabled:opacity-60 sm:text-sm";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={cx(inputCls, "cursor-pointer appearance-none pr-10", className)} />
      <Icon name="chevronDown" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(inputCls, "min-h-24 py-2.5", props.className)} />;
}

export function Checkbox({ label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-default/60 px-3.5 py-3 transition-colors hover:bg-default">
      <input type="checkbox" {...props} className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--accent)]" />
      <span className="min-w-0 text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

/** Contenedor de página: mismo ancho máximo y separación en todas las pantallas. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto flex w-full max-w-[1400px] flex-col gap-4", className)}>{children}</div>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] sm:p-5", className)}>{children}</section>;
}

/** Título de sección dentro de una tarjeta (serif, como la referencia). */
export function CardTitle({ children, className, as: Tag = "h2" }: { children: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return <Tag className={cx("font-display text-lg font-medium text-foreground sm:text-xl", className)}>{children}</Tag>;
}

/** Tarjeta con encabezado (título, descripción y acciones opcionales). */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cx("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children !== undefined && <div className={bodyClassName}>{children}</div>}
    </Card>
  );
}

/** Rejilla de campos: 1 columna en celular y más en pantallas anchas. */
export function FieldGrid({ children, cols = 3, className }: { children: ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 xl:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" }[cols];
  return <div className={cx("grid grid-cols-1 gap-x-4 gap-y-4", c, className)}>{children}</div>;
}

/** Tarjeta de filtros: periodo, búsqueda y selects con el mismo espaciado en todas las listas. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cx("flex flex-col gap-3 p-3 sm:p-4", className)}>{children}</Card>;
}

/** Paginación: "Mostrando 1–50 de 924" + anterior/siguiente. `query` son los demás filtros de la URL. */
export function Pager({ page, pageSize, total, path, query, param = "pagina" }: { page: number; pageSize: number; total: number; path: string; query: Record<string, string | undefined>; param?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const href = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== param) q.set(k, v);
    if (n > 1) q.set(param, String(n));
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (n: number, label: ReactNode, aria: string, disabled: boolean) =>
    disabled ? (
      <span aria-hidden className={btn("secondary", "pointer-events-none min-h-10 px-3 opacity-40")}>{label}</span>
    ) : (
      <PendingLink href={href(n)} aria-label={aria} className={btn("secondary", "min-h-10 px-3")}>
        {label}
      </PendingLink>
    );
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted tabular">
        Mostrando {from}–{to} de {total}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {link(page - 1, <Icon name="back" className="size-4" />, "Página anterior", page <= 1)}
          <span className="min-w-20 text-center text-sm font-medium tabular">
            {page} / {pages}
          </span>
          {link(page + 1, <Icon name="next" className="size-4" />, "Página siguiente", page >= pages)}
        </div>
      )}
    </nav>
  );
}

/** Barra de acciones de formulario fija abajo (sobre la barra inferior en celular). */
export function FormActions({ children, status, className }: { children: ReactNode; status?: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "no-print sticky bottom-[calc(var(--app-bottom)+0.75rem)] z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-surface/90 p-2.5 shadow-[var(--overlay-shadow)] backdrop-blur-md lg:bottom-3",
        !status && "sm:ml-auto sm:w-fit",
        className,
      )}
    >
      {status && <div className="min-w-0 flex-1 basis-full text-sm sm:basis-0">{status}</div>}
      <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">{children}</div>
    </div>
  );
}

/** Estado vacío uniforme. */
export function EmptyState({ icon = "info", title, children, className }: { icon?: Parameters<typeof Icon>[0]["name"]; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-2 rounded-2xl bg-surface-secondary px-6 py-10 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-surface text-muted">
        <Icon name={icon} />
      </span>
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "ok" | "warn" | "bad";
const tones: Record<Tone, string> = {
  neutral: "bg-default text-default-foreground",
  accent: "bg-accent-soft text-accent-soft-foreground",
  ok: "bg-success-soft text-success-soft-foreground",
  warn: "bg-warning-soft text-warning-soft-foreground",
  bad: "bg-danger-soft text-danger-soft-foreground",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap", tones[tone])}>{children}</span>;
}

export function Alert({ tone = "bad", children }: { tone?: "bad" | "ok" | "warn"; children: ReactNode }) {
  const icon = tone === "bad" ? "!" : tone === "ok" ? "✓" : "!";
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("flex items-start gap-3 rounded-2xl px-4 py-3 text-[15px]", tones[tone])}>
      <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-current/15 text-xs font-bold">
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Encabezado de página fijo (sticky): título, subtítulo y acciones.
 * En celular las acciones van en una sola fila deslizable para no crecer de alto.
 */
export function PageHeader({ title, subtitle, children, back }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <StickyHeader>
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0">
          {back && (
            <Link href={back.href} className="mb-0.5 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground">
              <Icon name="back" className="size-4" />
              {back.label}
            </Link>
          )}
          <h1 className="font-display truncate text-2xl leading-tight font-medium sm:text-[1.75rem]">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-muted sm:text-[15px]">{subtitle}</p>}
        </div>
        {children && <div className="no-scrollbar -mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:justify-end md:overflow-visible md:px-0">{children}</div>}
      </div>
    </StickyHeader>
  );
}

/** Tarjeta de indicador (KPI) con cifra serif grande. */
export function Stat({
  label,
  value,
  num,
  hint,
  className,
  emphasis,
}: {
  label: string;
  value: string;
  /** Si se da, la cifra cuenta animada hasta este valor. */
  num?: { value: number; money?: boolean; decimals?: number; suffix?: string };
  hint?: ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cx("rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] sm:p-5", className)}>
      <p className="text-sm text-muted">{label}</p>
      <p className={cx("font-display mt-2 tabular leading-none", emphasis ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl")}>
        {num ? (
          <>
            <AnimatedNumber value={num.value} money={num.money ?? true} decimals={num.decimals} countUp />
            {num.suffix}
          </>
        ) : (
          value
        )}
      </p>
      {hint && <div className="mt-2 text-sm text-muted">{hint}</div>}
    </div>
  );
}
