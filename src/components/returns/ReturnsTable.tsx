"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table } from "@heroui/react";
import { formatMoney } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { RETURN_OUTCOME_LABELS, RETURN_OUTCOME_TONE, type ReturnOutcome } from "@/lib/returns";
import { Badge, Card, EmptyState } from "../ui";

export interface ReturnRow {
  _id: string;
  folio: string;
  saleFolio?: string;
  quoteFolio?: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  userName?: string;
  reason: string;
  returnedTotal: number;
  newTotal: number;
  outcome: ReturnOutcome;
  chargeAmount: number;
  commissionAmount?: number;
  refundAmount: number;
  appliedToBalance?: number;
  returnedItems: { name?: string }[];
  newItems: { name?: string }[];
}

function names(list: { name?: string }[]) {
  const n = [...new Set(list.map((i) => i.name).filter(Boolean))] as string[];
  return n.length > 2 ? `${n.slice(0, 2).join(", ")} y ${n.length - 2} más` : n.join(", ");
}

/** Monto que movió la devolución, con signo legible. */
function Money({ r }: { r: ReturnRow }) {
  if (r.chargeAmount > 0) return <span className="text-ok">+ {formatMoney(r.chargeAmount + (r.commissionAmount ?? 0))}</span>;
  if (r.refundAmount > 0) return <span className="text-bad">− {formatMoney(r.refundAmount)}</span>;
  if ((r.appliedToBalance ?? 0) > 0) return <span>{formatMoney(r.appliedToBalance ?? 0)} a saldo</span>;
  return <span className="text-muted">{formatMoney(0)}</span>;
}

export default function ReturnsTable({ rows }: { rows: ReturnRow[] }) {
  const router = useRouter();
  if (!rows.length) {
    return (
      <Card>
        <EmptyState icon="undo" title="No hay devoluciones con estos filtros">
          Prueba con otro periodo o quita la búsqueda.
        </EmptyState>
      </Card>
    );
  }
  const href = (r: ReturnRow) => `/notas-devolucion/${r._id}`;
  return (
    <div data-results>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r._id}>
            <Link href={href(r)} className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-[var(--surface-shadow)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--overlay-shadow)] outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.99]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold tabular">
                  {r.folio}
                  <span className="ml-2 text-sm font-normal text-muted">{r.saleFolio || "sin nota"}</span>
                </span>
                <Badge tone={RETURN_OUTCOME_TONE[r.outcome]}>{RETURN_OUTCOME_LABELS[r.outcome]}</Badge>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 text-sm text-muted">
                  <p className="truncate text-base text-foreground">{r.customerName || "Mostrador"}</p>
                  <p className="truncate">Regresó: {names(r.returnedItems)}</p>
                  {r.newItems.length > 0 && <p className="truncate">Se llevó: {names(r.newItems)}</p>}
                  <p>
                    {fmtDate(r.createdAt)}
                    {r.userName ? ` · ${r.userName}` : ""}
                  </p>
                </div>
                <span className="font-display text-xl tabular">
                  <Money r={r} />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Table className="data-table hidden md:block">
        <Table.ScrollContainer>
          <Table.Content aria-label="Devoluciones" onRowAction={(key) => router.push(String(key))}>
            <Table.Header>
              <Table.Column isRowHeader>Folio</Table.Column>
              <Table.Column>Cliente</Table.Column>
              <Table.Column>Fecha</Table.Column>
              <Table.Column>Motivo</Table.Column>
              <Table.Column>Resultado</Table.Column>
              <Table.Column className="text-right">Dinero</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r._id} id={href(r)} className="cursor-pointer">
                  <Table.Cell className="whitespace-nowrap tabular">
                    <span className="font-semibold">{r.folio}</span>
                    <span className="block text-xs text-muted">
                      {r.saleFolio || "Sin nota"}
                      {r.quoteFolio ? ` · ${r.quoteFolio}` : ""}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {r.customerName || <span className="text-muted">Mostrador</span>}
                    <span className="block max-w-[16rem] truncate text-xs text-muted xl:max-w-[22rem]">
                      {names(r.returnedItems)}
                      {r.newItems.length ? ` → ${names(r.newItems)}` : ""}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <span className="text-muted">{fmtDate(r.createdAt)}</span>
                    {r.userName && <span className="block text-xs text-muted">por {r.userName}</span>}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block max-w-[12rem] truncate">{r.reason}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge tone={RETURN_OUTCOME_TONE[r.outcome]}>{RETURN_OUTCOME_LABELS[r.outcome]}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right font-semibold whitespace-nowrap tabular">
                    <Money r={r} />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
