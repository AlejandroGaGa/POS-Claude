"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chip, Table } from "@heroui/react";
import { formatMoney, PAYMENT_LABELS, type PaymentMethod } from "@/lib/pricing";
import { fmtDate, STATUS_LABEL } from "@/lib/labels";
import Icon from "./Icon";
import { Card, EmptyState } from "./ui";
import { Stagger } from "./motion";
import { Fragment } from "react";

export interface SaleRow {
  _id: string;
  folio: string;
  kind: "venta" | "cotizacion";
  status: string;
  createdAt: string;
  customerName?: string;
  sellerName?: string;
  paymentMethod?: PaymentMethod | null;
  commissionAmount: number;
  total: number;
  items: { name?: string }[];
  validUntil?: string;
  balance?: number;
  paymentStatus?: string | null;
}

/** "Cabezal 2", Riel superior y 2 más" — resumen corto de lo que lleva. */
function itemsText(r: SaleRow) {
  const names = [...new Set(r.items.map((i) => i.name).filter(Boolean))] as string[];
  if (!names.length) return `${r.items.length} renglón(es)`;
  const head = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${head} y ${names.length - 2} más` : head;
}

const PAY_ICON = { efectivo: "wallet", transferencia: "cash", terminal: "card" } as const;

function StatusChip({ r, now }: { r: SaleRow; now: number }) {
  const expired = r.kind === "cotizacion" && r.status === "vigente" && r.validUntil && new Date(r.validUntil).getTime() < now;
  if (expired) return <Chip size="sm" variant="soft" color="warning"><Chip.Label>Vencida</Chip.Label></Chip>;
  if (r.status === "cancelada") return <Chip size="sm" variant="soft" color="danger"><Chip.Label>Cancelada</Chip.Label></Chip>;
  if (r.status === "convertida") return <Chip size="sm" variant="soft" color="accent"><Chip.Label>Cobrada</Chip.Label></Chip>;
  if (r.kind === "venta" && (r.balance ?? 0) > 0)
    return (
      <Chip size="sm" variant="soft" color="warning">
        <Chip.Label>Debe {formatMoney(r.balance ?? 0)}</Chip.Label>
      </Chip>
    );
  return (
    <Chip size="sm" variant="soft" color="success">
      <Chip.Label>{r.kind === "venta" ? "Pagada" : STATUS_LABEL[r.status]}</Chip.Label>
    </Chip>
  );
}

function Payment({ r }: { r: SaleRow }) {
  if (!r.paymentMethod) return <span className="text-muted">{r.paymentStatus === "parcial" ? "A crédito" : "—"}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={PAY_ICON[r.paymentMethod]} className="size-4 text-muted" />
      {PAYMENT_LABELS[r.paymentMethod].replace(" (tarjeta)", "")}
      {r.commissionAmount > 0 && <span className="text-muted">+{formatMoney(r.commissionAmount)}</span>}
    </span>
  );
}

/** Lista de ventas/cotizaciones: tarjetas en celular, tabla HeroUI en pantallas medianas. */
export default function SalesTable({ rows, showSeller, quoteMode = false }: { rows: SaleRow[]; showSeller: boolean; quoteMode?: boolean }) {
  const router = useRouter();
  if (!rows.length) {
    return (
      <Card>
        <EmptyState icon={quoteMode ? "doc" : "cash"} title="No hay registros con estos filtros">
          Prueba con otro periodo o quita la búsqueda.
        </EmptyState>
      </Card>
    );
  }
  const now = Date.now();
  const hrefOf = (r: SaleRow) => (quoteMode && r.status === "vigente" ? `/cotizaciones/${r._id}` : `/notas/${r._id}`);

  return (
    <div data-results>
      {/* Celular */}
      <Stagger as="ul" className="flex flex-col gap-2 md:hidden" maxAnimated={10}>
        {rows.map((r) => (
          <Fragment key={r._id}>
            <Link href={hrefOf(r)} className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-[var(--surface-shadow)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--overlay-shadow)] outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.99]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold tabular">{r.folio}</span>
                <StatusChip r={r} now={now} />
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 text-sm text-muted">
                  <p className="truncate text-base text-foreground">{r.customerName || "Mostrador"}</p>
                  <p className="truncate">{itemsText(r)}</p>
                  <p>{fmtDate(r.createdAt)}</p>
                  {showSeller && r.sellerName && <p>Atendió: {r.sellerName}</p>}
                  {!quoteMode && (
                    <p className="mt-0.5">
                      <Payment r={r} />
                    </p>
                  )}
                </div>
                <span className="font-display text-xl tabular">{formatMoney(r.total)}</span>
              </div>
            </Link>
          </Fragment>
        ))}
      </Stagger>

      {/* Tablet / escritorio */}
      <Table className="data-table hidden md:block">
        <Table.ScrollContainer>
          <Table.Content aria-label={quoteMode ? "Cotizaciones" : "Ventas"} onRowAction={(key) => router.push(String(key))}>
            <Table.Header>
              <Table.Column isRowHeader>Folio</Table.Column>
              <Table.Column>Cliente</Table.Column>
              <Table.Column>Fecha</Table.Column>
              <Table.Column>{quoteMode ? "Vigencia" : "Pago"}</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column className="text-right">Total</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r._id} id={hrefOf(r)} className="cursor-pointer">
                  <Table.Cell className="font-semibold whitespace-nowrap tabular">{r.folio}</Table.Cell>
                  <Table.Cell>
                    {r.customerName || <span className="text-muted">Mostrador</span>}
                    <span className="block max-w-[15rem] truncate text-xs text-muted xl:max-w-[22rem]">{itemsText(r)}</span>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <span className="text-muted">{fmtDate(r.createdAt)}</span>
                    {showSeller && r.sellerName && <span className="block text-xs text-muted">por {r.sellerName}</span>}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">{quoteMode ? <span className="text-muted">Hasta {fmtDate(r.validUntil, false)}</span> : <Payment r={r} />}</Table.Cell>
                  <Table.Cell>
                    <StatusChip r={r} now={now} />
                  </Table.Cell>
                  <Table.Cell className="text-right font-semibold whitespace-nowrap tabular">{formatMoney(r.total)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
