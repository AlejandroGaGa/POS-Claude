"use client";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Table } from "@heroui/react";
import { Card, EmptyState, cx } from "./ui";
import { Stagger } from "./motion";
import type { IconName } from "./Icon";

export interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Se oculta en la tarjeta de celular (ya va en el título o no es esencial). */
  hideOnMobile?: boolean;
  className?: string;
}

export interface Row {
  id: string;
  href?: string;
  cells: Record<string, ReactNode>;
}

/**
 * Tabla estándar del sistema: tarjetas en celular y tabla HeroUI (encabezado fijo) desde tablet.
 * La primera columna es el título de la tarjeta; `aside` (opcional) va a la derecha del título.
 */
export default function DataTable({
  columns,
  rows,
  label,
  empty,
  emptyIcon = "info",
  aside,
  plain = false,
}: {
  columns: Column[];
  rows: Row[];
  label: string;
  empty: { title: string; text?: string };
  emptyIcon?: IconName;
  /** Columna que se muestra junto al título en celular (p. ej. el monto). */
  aside?: string;
  /** Sin tarjeta contenedora en el estado vacío (cuando ya va dentro de una Section). */
  plain?: boolean;
}) {
  const router = useRouter();
  if (!rows.length) {
    const e = (
      <EmptyState icon={emptyIcon} title={empty.title}>
        {empty.text}
      </EmptyState>
    );
    return plain ? e : <Card>{e}</Card>;
  }
  const [first, ...rest] = columns;
  const restMobile = rest.filter((c) => !c.hideOnMobile && c.key !== aside);

  return (
    <div data-results>
      <Stagger as="ul" className="flex flex-col gap-2 md:hidden" maxAnimated={10}>
        {rows.map((r) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 font-medium">{r.cells[first.key]}</div>
                {aside && <div className="shrink-0 text-right font-semibold tabular">{r.cells[aside]}</div>}
              </div>
              {restMobile.length > 0 && (
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                  {restMobile.map((c) =>
                    r.cells[c.key] === undefined || r.cells[c.key] === null || r.cells[c.key] === "" ? null : (
                      <Fragment key={c.key}>
                        <dt className="text-muted">{c.label}</dt>
                        <dd className="min-w-0 text-right">{r.cells[c.key]}</dd>
                      </Fragment>
                    ),
                  )}
                </dl>
              )}
            </>
          );
          const cls = "flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-[var(--surface-shadow)]";
          return (
            <Fragment key={r.id}>
              {r.href ? (
                <Link href={r.href} className={cx(cls, "outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.99]")}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </Fragment>
          );
        })}
      </Stagger>

      <Table className="data-table hidden md:block">
        <Table.ScrollContainer>
          <Table.Content
            aria-label={label}
            onRowAction={(key) => {
              const r = rows.find((x) => x.id === String(key));
              if (r?.href) router.push(r.href);
            }}
          >
            <Table.Header>
              {columns.map((c, i) => (
                <Table.Column key={c.key} isRowHeader={i === 0} className={cx(c.align === "right" && "text-right", c.className)}>
                  {c.label}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r.id} id={r.id} className={r.href ? "cursor-pointer" : undefined}>
                  {columns.map((c) => (
                    <Table.Cell key={c.key} className={cx(c.align === "right" && "text-right whitespace-nowrap tabular", c.className)}>
                      {r.cells[c.key]}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
