"use client";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@heroui/react";
import { adjustLines, MAX_DISCOUNT_PCT } from "@/lib/adjust";
import { formatMoney, formatNumber } from "@/lib/pricing";
import { Button, Input, cx } from "../ui";
import Icon from "../Icon";
import type { CartLine } from "./AddItemDialog";

const EXTRA_CHIPS = [10, 20, 50, 100];
const PCT_CHIPS = [3, 5, 10, 15];

function num(v: string): number {
  const x = Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(x) && x > 0 ? x : 0;
}

type Tab = "extra" | "descuento";

/**
 * «Ajustar precio» de la venta, en dos pestañas que no se combinan:
 * - Cobrar de más: pesos extra que se reparten en los precios (no aparece en la nota).
 * - Descuento especial: % que sí aparece en la nota como renglón.
 * Al aplicar una, la otra se quita.
 */
export default function AdjustDialog({
  open,
  onClose,
  cart,
  extra,
  discount,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  extra: number;
  discount: number;
  onApply: (extra: number, discount: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("extra");
  const [ex, setEx] = useState("");
  const [pct, setPct] = useState("");
  useEffect(() => {
    if (open) {
      setTab(discount > 0 ? "descuento" : "extra");
      setEx(extra ? String(extra) : "");
      setPct(discount ? String(discount) : "");
    }
  }, [open, extra, discount]);

  const exNum = tab === "extra" ? num(ex) : 0;
  const pctNum = tab === "descuento" ? Math.min(MAX_DISCOUNT_PCT, num(pct)) : 0;
  const prev = useMemo(() => adjustLines(cart.map((l) => l.priced), { extra: exNum, discountPct: pctNum }), [cart, exNum, pctNum]);
  const other = tab === "extra" ? discount > 0 : extra > 0;
  const chip = (on: boolean) =>
    cx(
      "min-h-12 rounded-xl border-2 px-2 text-lg font-semibold tabular focus-visible:ring-4 focus-visible:ring-focus",
      on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface hover:bg-default",
    );

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Container placement="auto" scroll="inside">
        <Modal.Dialog aria-labelledby="adj-title" className="w-full sm:max-w-xl">
          <Modal.CloseTrigger aria-label="Cerrar" />
          <Modal.Header>
            <Modal.Heading id="adj-title" className="font-display text-2xl">
              Ajustar precio
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-5 text-foreground">
            <div role="tablist" aria-label="Tipo de ajuste" className="grid grid-cols-2 gap-1 rounded-2xl bg-default p-1">
              {(
                [
                  ["extra", "Cobrar de más", "No sale en la nota"],
                  ["descuento", "Descuento especial", "Sí sale en la nota"],
                ] as const
              ).map(([t, label, hint]) => (
                <button
                  key={t}
                  id={`adj-tab-${t}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  aria-controls={`adj-panel-${t}`}
                  onClick={() => setTab(t)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      const next = t === "extra" ? "descuento" : "extra";
                      setTab(next);
                      document.getElementById(`adj-tab-${next}`)?.focus();
                    }
                  }}
                  tabIndex={tab === t ? 0 : -1}
                  className={cx(
                    "flex min-h-16 flex-col items-center justify-center rounded-xl px-2 text-center focus-visible:ring-4 focus-visible:ring-focus",
                    tab === t ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
                  )}
                >
                  <span className="text-lg font-semibold">{label}</span>
                  <span className="text-sm">{hint}</span>
                </button>
              ))}
            </div>

            {other && (
              <p className="rounded-xl bg-warning-soft px-3 py-2 text-base text-warning-soft-foreground">
                {tab === "extra" ? `Ya hay un descuento de ${formatNumber(discount, 2)}%.` : `Ya hay un ajuste de +${formatMoney(extra)}.`} Al aplicar este, el otro se quita: no se combinan.
              </p>
            )}

            {tab === "extra" ? (
            <section id="adj-panel-extra" role="tabpanel" aria-labelledby="adj-tab-extra" className="flex flex-col gap-2">
              <label id="adj-extra-l" htmlFor="adj-extra" className="text-lg font-semibold">
                ¿Cuánto más quieres cobrar?
              </label>
              <p className="text-base text-muted">Se reparte entre los precios de los productos. En la nota no aparece ningún renglón de ajuste.</p>
              <div className="grid grid-cols-4 gap-2">
                {EXTRA_CHIPS.map((v) => (
                  <button key={v} type="button" onClick={() => setEx(String(v))} aria-pressed={exNum === v} className={chip(exNum === v)}>
                    +${v}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-semibold text-muted">
                  +$
                </span>
                <Input id="adj-extra" inputMode="decimal" value={ex} onChange={(e) => setEx(e.target.value)} placeholder="0" className="h-14 pl-14 !text-2xl font-semibold" />
              </div>
            </section>
            ) : (
            <section id="adj-panel-descuento" role="tabpanel" aria-labelledby="adj-tab-descuento" className="flex flex-col gap-2">
              <label id="adj-pct-l" htmlFor="adj-pct" className="text-lg font-semibold">
                ¿Qué porcentaje de descuento?
              </label>
              <p className="text-base text-muted">Para compras grandes. Sí aparece en la nota como «Descuento especial».</p>
              <div className="grid grid-cols-4 gap-2">
                {PCT_CHIPS.map((v) => (
                  <button key={v} type="button" onClick={() => setPct(String(v))} aria-pressed={pctNum === v} className={chip(pctNum === v)}>
                    {v}%
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input id="adj-pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="0" className="h-14 pr-12 !text-2xl font-semibold" />
                <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-2xl font-semibold text-muted">
                  %
                </span>
              </div>
            </section>
            )}

            {/* Vista previa: así quedará la nota */}
            <section aria-label="Así queda la nota" className="flex flex-col gap-2 rounded-2xl bg-default p-4">
              <p className="text-base font-semibold">Así queda la nota</p>
              <ul className="flex flex-col gap-1.5 text-base">
                {prev.lines.map((l, i) => (
                  <li key={cart[i].key} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{cart[i].product.name}</span>
                      <span className="text-sm text-muted tabular">
                        {formatNumber(l.qty)} × {formatMoney(l.shownUnitPrice)}
                        {l.shownUnitPrice !== l.listUnitPrice && <> · lista {formatMoney(l.listUnitPrice)}</>}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular">{formatMoney(l.shownSubtotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-1 flex flex-col gap-1 border-t border-separator pt-2 tabular">
                {prev.extra > 0 && (
                  <div className="flex justify-between text-sm text-muted">
                    <dt>Precio de lista {formatMoney(prev.baseSubtotal)} · de más (no se imprime)</dt>
                    <dd>+{formatMoney(prev.extra)}</dd>
                  </div>
                )}
                {prev.discountAmount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <dt>Subtotal</dt>
                      <dd>{formatMoney(prev.shownSubtotal)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold text-ok">
                      <dt>Descuento especial {formatNumber(prev.discountPct, 2)}%</dt>
                      <dd>−{formatMoney(prev.discountAmount)}</dd>
                    </div>
                  </>
                )}
                <div className="flex items-baseline justify-between pt-1">
                  <dt className="text-lg font-semibold">Total</dt>
                  <dd className="font-display text-3xl">{formatMoney(prev.subtotal)}</dd>
                </div>
                {exNum > 0 && Math.abs(prev.extra - exNum) >= 0.01 && (
                  <p className="text-sm text-muted">Para que los precios queden redondos se repartieron {formatMoney(prev.extra)}.</p>
                )}
              </dl>
            </section>
          </Modal.Body>
          <Modal.Footer className="grid grid-cols-[auto_1fr] gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onApply(0, 0);
                onClose();
              }}
              className="min-h-14 px-4 !text-lg"
            >
              Quitar ajustes
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApply(exNum, pctNum);
                onClose();
              }}
              className="min-h-14 !text-lg"
            >
              <Icon name="check" className="size-5" /> Aplicar
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
