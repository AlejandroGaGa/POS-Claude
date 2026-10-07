"use client";
import { Chip, Table } from "@heroui/react";
import { formatMoney, formatNumber } from "@/lib/pricing";

export interface TopRow {
  code: string;
  name: string;
  category: string;
  total: number;
  lines: number;
}

const CAT_COLOR: Record<string, "accent" | "success" | "warning" | "default"> = {
  Aluminio: "accent",
  Vidrio: "success",
  Espejos: "success",
};

/** Tabla de productos más vendidos: tabla HeroUI en escritorio, lista compacta en celular. */
export default function TopProductsTable({ rows, grandTotal }: { rows: TopRow[]; grandTotal: number }) {
  if (!rows.length) return <p className="rounded-2xl bg-surface-secondary p-6 text-center text-muted">Aún no hay ventas en este periodo.</p>;
  const pct = (v: number) => (grandTotal ? `${formatNumber((v / grandTotal) * 100, 0)}%` : "—");
  return (
    <>
      <ul className="flex flex-col divide-y divide-separator md:hidden">
        {rows.map((r, i) => (
          <li key={`${r.code}|${r.name}`} className="flex items-center gap-3 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-default text-sm font-semibold tabular">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              <p className="text-sm text-muted">
                {r.category} · {r.lines} renglón(es)
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular">{formatMoney(r.total)}</p>
              <p className="text-sm text-muted tabular">{pct(r.total)}</p>
            </div>
          </li>
        ))}
      </ul>
      <Table className="hidden md:block" variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Productos más vendidos">
            <Table.Header>
              <Table.Column isRowHeader>Producto</Table.Column>
              <Table.Column>Categoría</Table.Column>
              <Table.Column className="text-right">Renglones</Table.Column>
              <Table.Column className="text-right">Importe</Table.Column>
              <Table.Column className="text-right">% del total</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={`${r.code}|${r.name}`} id={`${r.code}|${r.name}`}>
                  <Table.Cell>
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-xs text-muted">{r.code}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft" color={CAT_COLOR[r.category] ?? "default"}>
                      <Chip.Label>{r.category || "—"}</Chip.Label>
                    </Chip>
                  </Table.Cell>
                  <Table.Cell className="text-right tabular">{r.lines}</Table.Cell>
                  <Table.Cell className="text-right font-semibold tabular">{formatMoney(r.total)}</Table.Cell>
                  <Table.Cell className="text-right tabular text-muted">{pct(r.total)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </>
  );
}
