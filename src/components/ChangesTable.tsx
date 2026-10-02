"use client";
import { Table } from "@heroui/react";

export interface ChangeRow {
  key: string;
  product: string;
  code?: string;
  field: string;
  from: string;
  to: string;
}

/** Tabla de "antes → después" para vistas previas de cambios de precio (ajuste masivo e importación). */
export default function ChangesTable({ rows, label }: { rows: ChangeRow[]; label: string }) {
  return (
    <Table className="data-table data-table--scroll" variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label={label}>
          <Table.Header>
            <Table.Column isRowHeader>Producto</Table.Column>
            <Table.Column>Campo</Table.Column>
            <Table.Column className="text-right">Antes</Table.Column>
            <Table.Column className="text-right">Después</Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row key={r.key} id={r.key}>
                <Table.Cell>
                  <span className="font-medium">{r.product}</span>
                  {r.code && <span className="block text-xs text-muted">{r.code}</span>}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-muted">{r.field}</Table.Cell>
                <Table.Cell className="text-right whitespace-nowrap text-muted tabular">{r.from}</Table.Cell>
                <Table.Cell className="text-right font-semibold whitespace-nowrap tabular">{r.to}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
