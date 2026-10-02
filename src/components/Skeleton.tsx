import type { CSSProperties } from "react";
import { cx } from "./ui";

/**
 * Skeletons: siluetas con brillo que imitan la pantalla mientras llega la información.
 * Mismas medidas que los componentes reales para que nada "salte" al cargar.
 */

export function Sk({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cx("skeleton", className)} style={style} />;
}

/** Contenedor accesible: anuncia "Cargando" una sola vez a lectores de pantalla. */
export function SkPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy className={cx("mx-auto flex w-full max-w-[1400px] flex-col gap-4", className)}>
      <span className="sr-only">Cargando contenido</span>
      {children}
    </div>
  );
}

function SkCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] sm:p-5", className)}>{children}</div>;
}

export function SkHeader({ actions = 1, back = false }: { actions?: number; back?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2">
        {back && <Sk className="h-3.5 w-20" />}
        <Sk className="h-7 w-48 sm:w-64" />
        <Sk className="h-4 w-64 max-w-full sm:w-96" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Sk key={i} className={cx("h-11 rounded-full", i === actions - 1 ? "w-36" : "w-28")} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SkField({ className }: { className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <Sk className="h-3.5 w-20" />
      <Sk className="h-11 rounded-xl" />
    </div>
  );
}

export function SkFilters({ fields = 2, dates = false }: { fields?: number; dates?: boolean }) {
  return (
    <SkCard className="flex flex-col gap-3 p-3 sm:p-4">
      {dates && (
        <div className="flex flex-col gap-3 md:flex-row md:justify-between">
          <div className="flex gap-2">
            {[16, 16, 18, 20].map((w, i) => (
              <Sk key={i} className="h-11 rounded-full" style={{ width: `${w * 4}px` }} />
            ))}
          </div>
          <Sk className="h-11 w-full rounded-xl md:w-[19rem]" />
        </div>
      )}
      {fields > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(var(--n),minmax(0,1fr))]" style={{ ["--n" as string]: Math.max(1, fields - 1) }}>
          {Array.from({ length: fields }, (_, i) => (
            <SkField key={i} className={i > 0 ? "max-md:hidden" : undefined} />
          ))}
        </div>
      )}
    </SkCard>
  );
}

export function SkStats({ n = 4 }: { n?: number }) {
  return (
    <div className={cx("grid grid-cols-2 gap-3 sm:gap-4", n >= 5 ? "lg:grid-cols-5" : n === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
      {Array.from({ length: n }, (_, i) => (
        <SkCard key={i} className={cx("flex flex-col gap-3", i === 0 && "col-span-2 lg:col-span-1")}>
          <Sk className="h-3.5 w-20" />
          <Sk className="h-8 w-32" />
          <Sk className="h-3 w-24" />
        </SkCard>
      ))}
    </div>
  );
}

/** Tabla: tarjetas en celular y renglones en escritorio, como DataTable. */
export function SkTable({ rows = 8, cols = 5, inCard = false }: { rows?: number; cols?: number; inCard?: boolean }) {
  const widths = ["w-32", "w-40", "w-24", "w-20", "w-16", "w-24", "w-20"];
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: Math.min(rows, 5) }, (_, i) => (
          <SkCard key={i} className={cx("flex flex-col gap-2.5", inCard && "bg-surface-secondary shadow-none")}>
            <div className="flex justify-between gap-3">
              <Sk className="h-4 w-28" />
              <Sk className="h-4 w-16" />
            </div>
            <Sk className="h-3.5 w-3/4" />
            <Sk className="h-3.5 w-1/2" />
          </SkCard>
        ))}
      </div>
      <div className="hidden md:block">
        <div className="flex gap-6 px-3.5 py-3">
          {Array.from({ length: cols }, (_, c) => (
            <Sk key={c} className={cx("h-3", c === cols - 1 ? "ml-auto w-14" : "w-16")} />
          ))}
        </div>
        <div className={cx("overflow-hidden rounded-3xl", inCard ? "bg-surface-secondary" : "bg-surface shadow-[var(--surface-shadow)]")}>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex items-center gap-6 border-b border-separator px-3.5 py-4 last:border-b-0">
              {Array.from({ length: cols }, (_, c) =>
                c === 0 ? (
                  <div key={c} className="flex w-44 flex-col gap-1.5">
                    <Sk className="h-4 w-32" />
                    <Sk className="h-3 w-24" />
                  </div>
                ) : (
                  <Sk key={c} className={cx("h-4", c === cols - 1 ? "ml-auto w-20" : widths[(c + r) % widths.length])} />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function SkSection({ fields = 4, cols = 2, title = true, className }: { fields?: number; cols?: number; title?: boolean; className?: string }) {
  return (
    <SkCard className={cx("flex flex-col gap-4", className)}>
      {title && (
        <div className="flex flex-col gap-2">
          <Sk className="h-5 w-40" />
          <Sk className="h-3.5 w-56 max-w-full" />
        </div>
      )}
      <div className={cx("grid grid-cols-1 gap-4", cols === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : "")}>
        {Array.from({ length: fields }, (_, i) => (
          <SkField key={i} />
        ))}
      </div>
    </SkCard>
  );
}

export function SkList({ items = 4, className }: { items?: number; className?: string }) {
  return (
    <SkCard className={cx("flex flex-col gap-4", className)}>
      <Sk className="h-5 w-36" />
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Sk className="h-4 w-32" />
            <Sk className="h-3 w-24" />
          </div>
          <Sk className="h-4 w-16" />
        </div>
      ))}
    </SkCard>
  );
}

/** Tarjetas de producto del mostrador. */
export function SkProductCards({ n = 6, className }: { n?: number; className?: string }) {
  return (
    <div aria-hidden className={cx("grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3", className)}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex min-h-28 flex-col gap-2 rounded-2xl bg-surface p-4 shadow-[var(--surface-shadow)]">
          <Sk className="h-3 w-28" />
          <Sk className="h-4 w-3/4" />
          <Sk className="h-3 w-1/2" />
          <Sk className="mt-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkPos() {
  return (
    <SkPage>
      <SkHeader actions={0} />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-5">
        <div className="flex flex-col gap-4">
          <Sk className="h-14 rounded-2xl" />
          <div className="flex gap-2 overflow-hidden">
            {[16, 20, 22, 26, 18, 22, 20].map((w, i) => (
              <Sk key={i} className="h-10 shrink-0 rounded-full" style={{ width: `${w * 4}px` }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex min-h-24 flex-col justify-between gap-3 rounded-2xl bg-surface p-4 shadow-[var(--surface-shadow)]">
                <Sk className="size-10 rounded-xl" />
                <div className="flex flex-col gap-1.5">
                  <Sk className="h-4 w-24" />
                  <Sk className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <SkCard className="hidden flex-col gap-4 lg:flex">
          <Sk className="h-7 w-40" />
          <Sk className="h-28 rounded-2xl" />
          <Sk className="h-24 rounded-2xl" />
          <Sk className="h-12 rounded-2xl" />
          <div className="grid grid-cols-3 gap-2">
            <Sk className="h-16 rounded-2xl" />
            <Sk className="h-16 rounded-2xl" />
            <Sk className="h-16 rounded-2xl" />
          </div>
          <Sk className="h-9 w-full" />
          <div className="flex gap-2">
            <Sk className="h-12 flex-1 rounded-full" />
            <Sk className="h-12 flex-1 rounded-full" />
          </div>
        </SkCard>
      </div>
    </SkPage>
  );
}

/** Documento imprimible (nota / corte). */
export function SkDocument() {
  return (
    <div role="status" aria-busy className="mx-auto flex max-w-3xl flex-col gap-4 px-3 py-3 sm:px-6">
      <span className="sr-only">Cargando documento</span>
      <div className="flex gap-2">
        <Sk className="h-11 w-32 rounded-full" />
        <Sk className="h-11 w-24 rounded-full" />
        <Sk className="ml-auto h-11 w-28 rounded-full" />
      </div>
      <SkCard className="flex flex-col gap-5 sm:p-6">
        <div className="flex justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Sk className="h-6 w-48" />
            <Sk className="h-3.5 w-36" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Sk className="h-5 w-28" />
            <Sk className="h-5 w-24" />
          </div>
        </div>
        <Sk className="h-3.5 w-2/3" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex justify-between gap-4 border-b border-separator pb-3">
            <div className="flex flex-col gap-1.5">
              <Sk className="h-4 w-44" />
              <Sk className="h-3 w-28" />
            </div>
            <Sk className="h-4 w-20" />
          </div>
        ))}
        <div className="ml-auto flex w-56 flex-col gap-2">
          <Sk className="h-4" />
          <Sk className="h-6" />
        </div>
      </SkCard>
    </div>
  );
}
