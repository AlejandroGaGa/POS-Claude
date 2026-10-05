"use client";
import Link from "next/link";
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { Chip, Table } from "@heroui/react";
import { Card, EmptyState } from "./ui";
import { Stagger } from "./motion";

export interface ProductRow {
  _id: string;
  code: string;
  name: string;
  category: string;
  line?: string;
  color?: string;
  unitLabel: string;
  prices: string[];
  updated: string;
  active: boolean;
  noPrice: boolean;
}

function Flags({ p }: { p: ProductRow }) {
  if (!p.active)
    return (
      <Chip size="sm" variant="soft" color="danger">
        <Chip.Label>De baja</Chip.Label>
      </Chip>
    );
  if (p.noPrice)
    return (
      <Chip size="sm" variant="soft" color="warning">
        <Chip.Label>Sin precio</Chip.Label>
      </Chip>
    );
  return null;
}

/** Lista de precios: tarjetas compactas en celular y tabla en pantallas medianas (mismo estilo que Ventas). */
export default function ProductsTable({ rows, editor }: { rows: ProductRow[]; editor: boolean }) {
  const router = useRouter();
  if (!rows.length)
    return (
      <Card>
        <EmptyState icon="box" title="No hay productos con estos filtros">
          Prueba con otra palabra o quita la categoría.
        </EmptyState>
      </Card>
    );

  return (
    <div data-results>
      <Stagger as="ul" className="flex flex-col gap-2 md:hidden" maxAnimated={10}>
        {rows.map((p) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-muted">
                  {p.code} · {p.category}
                </span>
                <Flags p={p} />
              </div>
              <p className="leading-snug font-semibold">{p.name}</p>
              {(p.line || p.color) && <p className="text-sm text-muted">{[p.line, p.color].filter(Boolean).join(" · ")}</p>}
              <div className="text-sm font-medium tabular">
                {p.prices.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
            </>
          );
          const cls = "flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-[var(--surface-shadow)]";
          return (
            <Fragment key={p._id}>
              {editor ? (
                <Link href={`/productos/${p._id}`} className={`${cls} outline-none transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--overlay-shadow)] focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.99]`}>
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
          <Table.Content aria-label="Productos" onRowAction={editor ? (key) => router.push(`/productos/${String(key)}`) : undefined}>
            <Table.Header>
              <Table.Column isRowHeader>Producto</Table.Column>
              <Table.Column>Código</Table.Column>
              <Table.Column>Categoría</Table.Column>
              <Table.Column>Precio</Table.Column>
              <Table.Column className="text-right">Actualizado</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((p) => (
                <Table.Row key={p._id} id={p._id} className={editor ? "cursor-pointer" : undefined}>
                  <Table.Cell>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Flags p={p} />
                    </span>
                    {(p.line || p.color) && <span className="block text-xs text-muted">{[p.line, p.color].filter(Boolean).join(" · ")}</span>}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-muted tabular">{p.code}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap">{p.category}</Table.Cell>
                  <Table.Cell className="tabular">
                    {p.prices.map((s) => (
                      <span key={s} className="block whitespace-nowrap">
                        {s}
                      </span>
                    ))}
                  </Table.Cell>
                  <Table.Cell className="text-right whitespace-nowrap text-muted">{p.updated}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
