"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CUSTOMER_LABELS,
  CUSTOMER_TYPES,
  formatMoney,
  formatNumber,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  paymentLine,
  round2,
  type CustomerType,
  type PaymentMethod,
} from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { RETURN_MODE_HINTS, RETURN_MODE_LABELS, returnableQty, returnedLineValue, settleReturn, type ReturnMode } from "@/lib/returns";
import type { CartLine } from "../pos/AddItemDialog";
import ProductPicker from "./ProductPicker";
import { Alert, Badge, Button, Field, Input, Section, Textarea, cx } from "../ui";
import Icon from "../Icon";

export interface ReturnSale {
  _id: string;
  folio: string;
  fromQuoteFolio?: string;
  createdAt: string;
  customer?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerType?: CustomerType;
  sellerName?: string;
  balance?: number;
  commissionAmount?: number;
  items: { name?: string; code?: string; detail?: string; mode: string; qty: number; returnedQty?: number; unitPrice: number; subtotal: number }[];
}

const REASONS = ["Medida equivocada", "Color equivocado", "Producto equivocado", "Le sobró material", "Defecto o dañado", "Ya no lo necesita"];
const INTEGER_MODES = new Set(["pieza", "tira", "tramo", "hoja", "m2"]);
const CUT_MODES = new Set(["tramo", "m2"]);

function n(v: string): number {
  if (!v || v.trim() === "") return 0;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) ? x : NaN;
}

function LineList({ lines, onRemove, empty }: { lines: CartLine[]; onRemove: (key: string) => void; empty: string }) {
  if (!lines.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-separator">
      {lines.map((l) => (
        <li key={l.key} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-medium">{l.product.name}</p>
            <p className="text-sm text-muted">
              {l.priced.detail} · {formatNumber(l.priced.qty)} × {formatMoney(l.priced.unitPrice)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-semibold tabular">{formatMoney(l.priced.subtotal)}</span>
            <button type="button" onClick={() => onRemove(l.key)} aria-label={`Quitar ${l.product.name}`} className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-default hover:text-bad focus-visible:ring-2 focus-visible:ring-focus">
              <Icon name="trash" className="size-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Registro de una devolución o cambio.
 * 1) Qué regresa (de la nota, a precio pagado; o sin nota, a precio de lista).
 * 2) Qué se lleva a cambio (opcional, a precio actual).
 * 3) Cómo se resuelve: con diferencia (cobrar o regresar), cortesía o cobrar lo nuevo completo.
 */
export default function ReturnForm({ sale, defaultPct }: { sale: ReturnSale | null; defaultPct: number }) {
  const router = useRouter();
  const [retQty, setRetQty] = useState<Record<number, string>>({});
  const [retLines, setRetLines] = useState<CartLine[]>([]);
  const [newLines, setNewLines] = useState<CartLine[]>([]);
  const [customerType, setCustomerType] = useState<CustomerType>(sale?.customerType ?? "particular");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [mode, setMode] = useState<ReturnMode>("diferencia");
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [pct, setPct] = useState(String(defaultPct));
  const [cash, setCash] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Lo devuelto
  const saleRows = useMemo(
    () =>
      (sale?.items ?? []).map((it, index) => {
        const max = returnableQty(it.qty, it.returnedQty);
        const raw = retQty[index] ?? "";
        const qty = n(raw);
        const bad = raw !== "" && (!Number.isFinite(qty) || qty < 0 || qty > max + 1e-9 || (INTEGER_MODES.has(it.mode) && !Number.isInteger(qty)));
        const value = !bad && qty > 0 ? (Math.abs(qty - it.qty) < 1e-9 ? it.subtotal : returnedLineValue(it.unitPrice, qty)) : 0;
        return { it, index, max, raw, qty: bad ? 0 : qty, bad, value };
      }),
    [sale, retQty],
  );
  const anyBad = saleRows.some((r) => r.bad);
  const returnedTotal = round2(sale ? saleRows.reduce((a, r) => a + r.value, 0) : retLines.reduce((a, l) => a + l.priced.subtotal, 0));
  const hasReturned = sale ? saleRows.some((r) => r.qty > 0) : retLines.length > 0;
  const newTotal = round2(newLines.reduce((a, l) => a + l.priced.subtotal, 0));
  const isExchange = newLines.length > 0;
  const effMode: ReturnMode = !isExchange && mode === "cortesia" ? "diferencia" : mode;
  const st = settleReturn({ returnedTotal, newTotal, mode: effMode, balance: sale?.balance ?? 0 });

  let pay: ReturnType<typeof paymentLine> | null = null;
  try {
    if (st.charge > 0) pay = paymentLine(st.charge, method, method === "terminal" ? n(pct) : 0);
  } catch {}
  const cashNum = n(cash);
  const change = st.charge > 0 && method === "efectivo" && cash !== "" && pay ? round2(cashNum - pay.received) : null;

  const modes: { m: ReturnMode; label: string; hint: string }[] = isExchange
    ? (["diferencia", "cortesia", "cobrar_completo"] as ReturnMode[]).map((m) => ({ m, label: RETURN_MODE_LABELS[m], hint: RETURN_MODE_HINTS[m] }))
    : [
        { m: "diferencia", label: "Regresar dinero", hint: "Se le regresa en efectivo lo que pagó por lo devuelto." },
        { m: "cobrar_completo", label: "Sin reembolso", hint: "Se recibe el producto y queda registrado, pero no se regresa dinero." },
      ];

  function setAll(index: number, max: number) {
    setRetQty((s) => ({ ...s, [index]: String(max) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!hasReturned) return setError("Indica qué regresa el cliente.");
    if (anyBad) return setError("Revisa las cantidades a devolver.");
    if (reason.trim().length < 3) return setError("Escribe el motivo de la devolución.");
    if (st.charge > 0 && !pay) return setError("Revisa la comisión de terminal.");
    if (change !== null && change < 0) return setError("El efectivo recibido no alcanza.");
    setBusy(true);
    const body = {
      saleId: sale?._id ?? null,
      returned: sale ? saleRows.filter((r) => r.qty > 0).map((r) => ({ index: r.index, qty: r.qty })) : [],
      returnedLines: sale ? [] : retLines.map((l) => ({ productId: l.product._id, ...l.input })),
      newItems: newLines.map((l) => ({ productId: l.product._id, ...l.input })),
      mode: effMode,
      paymentMethod: st.charge > 0 ? method : null,
      commissionPct: method === "terminal" ? n(pct) : 0,
      cashReceived: st.charge > 0 && method === "efectivo" && cash !== "" ? cashNum : null,
      customerType,
      customerName,
      customerPhone,
      reason,
      notes,
    };
    const res = await fetch("/api/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error || "No se pudo registrar la devolución.");
    }
    router.push(`/notas-devolucion/${data.id}?nuevo=1`);
  }

  const balance = sale?.balance ?? 0;

  return (
    // Las columnas dependen del ancho real del formulario (no de la ventana): con el menú lateral abierto
    // en una pantalla mediana el resumen baja en vez de apretar la lista de productos.
    <div className="@container">
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,1fr)_380px] @4xl:items-start @5xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="@container flex min-w-0 flex-col gap-4">
        {/* 1. Lo que regresa */}
        {sale ? (
          <Section
            title="1. ¿Qué regresa?"
            description={`Venta ${sale.folio}${sale.fromQuoteFolio ? ` (de ${sale.fromQuoteFolio})` : ""} · ${fmtDate(sale.createdAt)}${sale.customerName ? ` · ${sale.customerName}` : ""}. Se acredita al precio que pagó.`}
          >
            <ul className="divide-y divide-separator">
              {saleRows.map(({ it, index, max, raw, bad, value }) => (
                <li key={index} className={cx("flex flex-col gap-2 py-3 first:pt-0 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:gap-4", max <= 0 && "opacity-55")}>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {it.name}{" "}
                      {CUT_MODES.has(it.mode) && max > 0 && (
                        <Badge tone="warn">Corte a medida</Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {[it.code, it.detail].filter(Boolean).join(" · ")} · {formatNumber(it.qty)} × {formatMoney(it.unitPrice)}
                      {(it.returnedQty ?? 0) > 0 && ` · ya devolvió ${formatNumber(it.returnedQty ?? 0)}`}
                    </p>
                  </div>
                  {max > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 @2xl:shrink-0 @2xl:flex-nowrap">
                      <label htmlFor={`rq-${index}`} className="sr-only">
                        Cantidad a devolver de {it.name}
                      </label>
                      <div className="w-24 shrink-0">
                      <Input
                        id={`rq-${index}`}
                        inputMode={INTEGER_MODES.has(it.mode) ? "numeric" : "decimal"}
                        placeholder="0"
                        value={raw}
                        onChange={(e) => {
                          // Piezas cerradas: solo enteros (se quitan puntos, comas y letras al escribir o pegar).
                          const v = INTEGER_MODES.has(it.mode) ? e.target.value.replace(/\D/g, "") : e.target.value;
                          setRetQty((s) => ({ ...s, [index]: v }));
                        }}
                        className={cx("text-center text-lg font-semibold", bad && "border-bad")}
                        aria-invalid={bad || undefined}
                        aria-describedby={`rq-${index}-max`}
                      />
                      </div>
                      <span id={`rq-${index}-max`} className="w-16 text-sm text-muted">
                        de {formatNumber(max)}
                      </span>
                      <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => setAll(index, max)}>
                        Todo
                      </Button>
                      <span className="ml-auto w-24 text-right font-semibold tabular @2xl:ml-0">{value ? formatMoney(value) : ""}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted">Ya se devolvió completo</span>
                  )}
                </li>
              ))}
            </ul>
            {(sale.commissionAmount ?? 0) > 0 && <p className="text-sm text-muted">La comisión de terminal que pagó en la venta no se regresa.</p>}
          </Section>
        ) : (
          <Section title="1. ¿Qué regresa? (sin nota)" description="Se toma el precio de lista actual. Captura el producto como en el mostrador.">
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="mr-2 text-sm font-medium">Tipo de cliente</legend>
              {CUSTOMER_TYPES.map((t) => (
                <label key={t} className={cx("flex min-h-10 cursor-pointer items-center rounded-xl border px-3 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus", customerType === t ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-surface-secondary")}>
                  <input type="radio" name="ret-ctype" className="sr-only" checked={customerType === t} onChange={() => setCustomerType(t)} disabled={retLines.length > 0 || newLines.length > 0} />
                  {CUSTOMER_LABELS[t]}
                </label>
              ))}
            </fieldset>
            <ProductPicker id="ret-picker" customerType={customerType} onAdd={(l) => setRetLines((s) => [...s, l])} />
            <LineList lines={retLines} onRemove={(k) => setRetLines((s) => s.filter((x) => x.key !== k))} empty="Aún no agregas lo que regresa." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Cliente (opcional)" htmlFor="ret-cname">
                <Input id="ret-cname" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre" autoComplete="off" />
              </Field>
              <Field label="Teléfono (opcional)" htmlFor="ret-cphone">
                <Input id="ret-cphone" inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="10 dígitos" autoComplete="off" />
              </Field>
            </div>
          </Section>
        )}

        {/* 2. Lo que se lleva */}
        <Section title="2. ¿Se lleva algo a cambio?" description="Opcional. Lo nuevo entra a precio actual.">
          <ProductPicker id="new-picker" customerType={customerType} onAdd={(l) => setNewLines((s) => [...s, l])} />
          <LineList lines={newLines} onRemove={(k) => setNewLines((s) => s.filter((x) => x.key !== k))} empty="Nada: es solo devolución." />
        </Section>

        {/* Motivo */}
        <Section title="3. Motivo">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Motivos frecuentes">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cx("min-h-10 rounded-full border px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-focus", reason === r ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-default")}>
                {r}
              </button>
            ))}
          </div>
          <Field label="Motivo" htmlFor="ret-reason">
            <Input id="ret-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej. pidió 6.10 m y era de 4.60 m" maxLength={200} />
          </Field>
          <Field label="Notas (opcional)" htmlFor="ret-notes">
            <Textarea id="ret-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </Field>
        </Section>
      </div>

      {/* Resumen y cobro */}
      <Section title="Diferencia" className="@4xl:sticky @4xl:top-[calc(var(--sticky-top)+0.75rem)]">
        <dl className="flex flex-col gap-1.5 tabular">
          <div className="flex justify-between">
            <dt className="text-muted">Devuelve</dt>
            <dd>{formatMoney(returnedTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Se lleva</dt>
            <dd>{formatMoney(newTotal)}</dd>
          </div>
          {isExchange && hasReturned && (
            <div className="flex justify-between border-t border-separator pt-1.5 text-sm text-muted">
              <dt>{st.difference >= 0 ? "Diferencia a favor del negocio" : "Diferencia a favor del cliente"}</dt>
              <dd>{formatMoney(Math.abs(st.difference))}</dd>
            </div>
          )}
        </dl>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">¿Cómo se resuelve?</legend>
          {modes.map(({ m, label, hint }) => (
            <label key={m} className={cx("flex min-h-11 cursor-pointer flex-col rounded-xl border px-3.5 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus", effMode === m ? "border-accent bg-accent-soft" : "border-border hover:bg-default")}>
              <span className="flex items-center gap-2 font-semibold">
                <input type="radio" name="ret-mode" checked={effMode === m} onChange={() => setMode(m)} className="size-4 accent-[var(--accent)]" />
                {label}
              </span>
              <span className="pl-6 text-sm text-muted">{hint}</span>
            </label>
          ))}
        </fieldset>

        {/* Resultado */}
        <div
          aria-live="polite"
          className={cx(
            "rounded-2xl p-4",
            st.charge > 0 ? "bg-success-soft text-success-soft-foreground" : st.refund > 0 ? "bg-danger-soft text-danger-soft-foreground" : "bg-default",
          )}
        >
          {!hasReturned ? (
            <p className="text-sm">Indica qué regresa para calcular.</p>
          ) : st.charge > 0 ? (
            <>
              <p className="text-sm font-medium">Cobrar al cliente</p>
              <p className="font-display text-3xl tabular">{formatMoney(pay?.received ?? st.charge)}</p>
              {pay && pay.commissionAmount > 0 && <p className="text-sm">Incluye {formatMoney(pay.commissionAmount)} de comisión</p>}
            </>
          ) : st.refund > 0 ? (
            <>
              <p className="text-sm font-medium">Regresar en efectivo de la caja</p>
              <p className="font-display text-3xl tabular">{formatMoney(st.refund)}</p>
              {st.appliedToBalance > 0 && <p className="text-sm">Antes se abonan {formatMoney(st.appliedToBalance)} a lo que debía.</p>}
            </>
          ) : st.appliedToBalance > 0 ? (
            <>
              <p className="text-sm font-medium">Se abona a lo que debe</p>
              <p className="font-display text-3xl tabular">{formatMoney(st.appliedToBalance)}</p>
              <p className="text-sm">Saldo después: {formatMoney(round2(balance - st.appliedToBalance))}. No sale dinero de la caja.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">{st.outcome === "parejo" ? "Cambio parejo" : st.outcome === "cortesia" ? "Cortesía" : "Sin reembolso"}</p>
              <p className="font-display text-3xl tabular">{formatMoney(0)}</p>
              <p className="text-sm">
                {st.waived > 0
                  ? `El negocio absorbe ${formatMoney(st.waived)}.`
                  : st.notRefunded > 0
                    ? `No se regresan ${formatMoney(st.notRefunded)}.`
                    : "No se cobra ni se regresa nada."}
              </p>
            </>
          )}
          {st.charge > 0 && st.notRefunded > 0 && <p className="text-sm">Lo devuelto ({formatMoney(st.notRefunded)}) no se acredita.</p>}
        </div>

        {st.charge > 0 && (
          <div className="flex flex-col gap-3">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Paga con</legend>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <label key={m} className={cx("flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus", method === m ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-surface-secondary")}>
                    <input type="radio" name="ret-method" className="sr-only" checked={method === m} onChange={() => setMethod(m)} />
                    {m === "terminal" ? "Terminal" : PAYMENT_LABELS[m]}
                  </label>
                ))}
              </div>
            </fieldset>
            {method === "terminal" && (
              <Field label="Comisión de terminal (%)" htmlFor="ret-pct">
                <Input id="ret-pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
              </Field>
            )}
            {method === "efectivo" && (
              <Field label="Efectivo recibido (opcional)" htmlFor="ret-cash">
                <Input id="ret-cash" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
              </Field>
            )}
            {change !== null && Number.isFinite(change) && (
              <p className={cx("flex justify-between font-semibold tabular", change < 0 ? "text-bad" : "text-ok")}>
                <span>{change < 0 ? "Falta" : "Cambio"}</span>
                <span>{formatMoney(Math.abs(change))}</span>
              </p>
            )}
          </div>
        )}

        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy} disabled={!hasReturned || anyBad} className="w-full">
          <Icon name="undo" className="size-4" /> {isExchange ? "Registrar cambio" : "Registrar devolución"}
        </Button>
      </Section>
    </form>
    </div>
  );
}
