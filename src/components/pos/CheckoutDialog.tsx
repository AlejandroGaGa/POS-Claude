"use client";
import { Modal } from "@heroui/react";
import { formatMoney, formatNumber, PAYMENT_METHODS, type PaymentMethod, type Totals } from "@/lib/pricing";
import { Alert, Button, Input, cx } from "../ui";
import Icon from "../Icon";

const METHOD_UI: Record<PaymentMethod, { label: string; icon: "wallet" | "cash" | "card" }> = {
  efectivo: { label: "Efectivo", icon: "wallet" },
  transferencia: { label: "Transferencia", icon: "cash" },
  terminal: { label: "Tarjeta", icon: "card" },
};

/** Billetes con los que suele pagar el cliente, arriba del total: «Exacto», $500, $1,000… */
export function cashSuggestions(total: number): number[] {
  if (!(total > 0)) return [];
  const out = new Set<number>([Math.round(total * 100) / 100]);
  for (const step of [50, 100, 200, 500, 1000]) {
    const v = Math.ceil(total / step) * step;
    if (v > total) out.add(v);
    if (out.size >= 4) break;
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

export interface CheckoutProps {
  open: boolean;
  onClose: () => void;
  isQuote: boolean;
  totals: Totals | null;
  method: PaymentMethod | null;
  setMethod: (m: PaymentMethod) => void;
  pct: string;
  setPct: (v: string) => void;
  cash: string;
  setCash: (v: string) => void;
  canPartial: boolean;
  creditLimit?: number;
  partial: boolean;
  setPartial: (v: boolean) => void;
  payNow: string;
  setPayNow: (v: string) => void;
  balanceLeft: number;
  dueNow: number;
  commissionNow: number;
  changeDue: number | null;
  error: string;
  saving: boolean;
  onConfirm: () => void;
}

/**
 * Paso 2 de la venta: cobrar. Una sola pregunta a la vez y en grande:
 * ¿cómo paga? → (efectivo) ¿con cuánto paga? → cambio → Cobrar.
 */
export default function CheckoutDialog(p: CheckoutProps) {
  const creditOnly = p.partial && (Number(p.payNow.replace(",", ".")) || 0) === 0;
  const ready = !!p.totals && (!!p.method || creditOnly) && !(p.method === "efectivo" && p.changeDue !== null && p.changeDue < 0);
  const suggestions = cashSuggestions(p.dueNow);

  return (
    <Modal.Backdrop isOpen={p.open} onOpenChange={(o) => !o && p.onClose()}>
      <Modal.Container placement="auto" scroll="inside">
        <Modal.Dialog aria-labelledby="checkout-title" className="w-full sm:max-w-lg">
          <Modal.CloseTrigger aria-label="Cerrar cobro" />
          <Modal.Header>
            <Modal.Heading id="checkout-title" className="font-display text-2xl">
              {p.isQuote ? "Cobrar cotización" : "Cobrar venta"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-5 text-foreground">
            {/* Total a cobrar, siempre visible y grande */}
            <div className="rounded-2xl bg-default p-4 text-center" aria-live="polite">
              <p className="text-base font-medium text-muted">{p.partial ? "Paga hoy" : "Total a cobrar"}</p>
              <p className="font-display text-5xl leading-tight tabular">{formatMoney(p.dueNow)}</p>
              {p.commissionNow > 0 && <p className="text-base">Incluye comisión de tarjeta: {formatMoney(p.commissionNow)}</p>}
              {p.partial && <p className="text-base font-semibold text-warn">Queda a deber {formatMoney(p.balanceLeft)}</p>}
              {p.method === "efectivo" && p.changeDue !== null && Number.isFinite(p.changeDue) && (
                <p className={cx("mt-2 flex items-baseline justify-center gap-3 rounded-xl px-3 py-2", p.changeDue < 0 ? "bg-danger-soft text-danger-soft-foreground" : "bg-success-soft text-success-soft-foreground")}>
                  <span className="text-xl font-semibold">{p.changeDue < 0 ? "Le falta" : "Su cambio"}</span>
                  <span className="font-display text-4xl tabular">{formatMoney(Math.abs(p.changeDue))}</span>
                </p>
              )}
            </div>

            <fieldset>
              <legend className="mb-2 text-lg font-semibold">¿Cómo paga?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PAYMENT_METHODS.map((m) => {
                  const on = p.method === m;
                  return (
                    <label
                      key={m}
                      className={cx(
                        "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 text-lg font-semibold transition-colors sm:min-h-20 sm:flex-col sm:justify-center sm:gap-1 sm:px-1 sm:text-center sm:text-base has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-focus",
                        on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface hover:bg-default",
                      )}
                    >
                      <input type="radio" name="checkout-method" value={m} checked={on} onChange={() => p.setMethod(m)} className="sr-only" />
                      <Icon name={METHOD_UI[m].icon} className="size-7" />
                      {METHOD_UI[m].label}
                      {on && <span className="sr-only">(elegido)</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {p.method === "efectivo" && (
              <div className="flex flex-col gap-3">
                <label htmlFor="checkout-cash" className="text-lg font-semibold">
                  ¿Con cuánto paga? <span className="text-base font-normal text-muted">(opcional)</span>
                </label>
                <div className={cx("grid gap-2", suggestions.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
                  {suggestions.map((v, i) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => p.setCash(String(v))}
                      aria-pressed={Number(p.cash) === v}
                      className={cx(
                        "min-h-14 rounded-2xl border-2 px-2 text-lg font-semibold tabular focus-visible:ring-4 focus-visible:ring-focus",
                        Number(p.cash) === v ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-default",
                      )}
                    >
                      {i === 0 ? "Exacto" : formatMoney(v).replace(".00", "")}
                    </button>
                  ))}
                </div>
                <Input id="checkout-cash" inputMode="decimal" value={p.cash} onChange={(e) => p.setCash(e.target.value)} placeholder="Otra cantidad" className="h-14 !text-2xl font-semibold" />
              </div>
            )}

            {p.method === "terminal" && (
              <div className="flex flex-col gap-2 rounded-2xl bg-warning-soft p-4 text-warning-soft-foreground">
                <label htmlFor="checkout-pct" className="text-lg font-semibold">
                  Comisión de la tarjeta (%)
                </label>
                <Input id="checkout-pct" inputMode="decimal" value={p.pct} onChange={(e) => p.setPct(e.target.value)} className="h-14 !text-2xl font-semibold" />
                <p className="text-base">Avísale al cliente que con tarjeta se cobra {formatNumber(Number(p.pct.replace(",", ".")) || 0, 2)}% más.</p>
              </div>
            )}

            {p.canPartial && (
              <div className="flex flex-col gap-3 rounded-2xl bg-accent-soft p-4 text-accent-soft-foreground">
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                  <span>
                    <span className="block text-lg font-semibold">Deja a cuenta (pago parcial)</span>
                    <span className="text-base">Cliente preferencial{p.creditLimit ? `, límite ${formatMoney(p.creditLimit)}` : ""}.</span>
                  </span>
                  <input type="checkbox" checked={p.partial} onChange={(e) => p.setPartial(e.target.checked)} className="size-7 shrink-0 accent-[var(--accent)]" />
                </label>
                {p.partial && (
                  <>
                    <label htmlFor="checkout-paynow" className="text-base font-semibold">
                      ¿Cuánto paga hoy? (0 = todo a crédito)
                    </label>
                    <Input id="checkout-paynow" inputMode="decimal" value={p.payNow} onChange={(e) => p.setPayNow(e.target.value)} placeholder="0.00" className="h-14 !text-2xl font-semibold" />
                  </>
                )}
              </div>
            )}

            {p.error && <Alert>{p.error}</Alert>}
          </Modal.Body>
          <Modal.Footer className="grid grid-cols-[auto_1fr] gap-2">
            <Button type="button" variant="secondary" onClick={p.onClose} className="min-h-16 px-4 !text-lg">
              <Icon name="back" className="size-5" /> Regresar
            </Button>
            <Button type="button" onClick={p.onConfirm} loading={p.saving} disabled={!ready || p.saving} className="min-h-16 !text-xl">
              <Icon name="check" className="size-6" /> {p.method || creditOnly ? `Cobrar ${formatMoney(p.dueNow)}` : "Elige cómo paga"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
