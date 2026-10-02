"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { computeTotals, formatMoney, formatNumber, PAYMENT_LABELS, PAYMENT_METHODS, paymentLine, round2, type PaymentMethod } from "@/lib/pricing";
import { Alert, Button, Field, Input, cx } from "./ui";
import Icon from "./Icon";
import { motion } from "framer-motion";
import { AnimatedNumber, PILL_SPRING } from "./motion";

export default function ConvertQuote({ id, subtotal, defaultPct, preferential = false }: { id: string; subtotal: number; defaultPct: number; preferential?: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [pct, setPct] = useState(String(defaultPct));
  const [cash, setCash] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [partial, setPartial] = useState(false);
  const [payNow, setPayNow] = useState("");

  const pctNum = Number(pct.replace(",", "."));
  let totals = null;
  try {
    totals = computeTotals([{ subtotal }], method, method === "terminal" ? pctNum : 0);
  } catch {}
  const cashNum = Number(cash.replace(",", "."));
  const isPartial = preferential && partial;
  const payNum = Math.min(subtotal, Math.max(0, Number(payNow.replace(",", ".")) || 0));
  let nowReceived = totals?.total ?? 0;
  if (isPartial) {
    try {
      nowReceived = payNum > 0 ? paymentLine(payNum, method ?? "efectivo", method === "terminal" ? pctNum : 0).received : 0;
    } catch {
      nowReceived = 0;
    }
  }
  const change = method === "efectivo" && cash !== "" && totals ? round2(cashNum - nowReceived) : null;

  async function submit() {
    const creditOnly = isPartial && payNum === 0;
    if (!method && !creditOnly) return setError("Elige el método de pago.");
    if (isPartial && payNum >= subtotal) return setError("Si paga todo, desactiva «Pago parcial».");
    setBusy(true);
    setError("");
    const res = await fetch(`/api/sales/${id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: creditOnly ? null : method,
        commissionPct: method === "terminal" ? pctNum : 0,
        cashReceived: method === "efectivo" && cash !== "" ? cashNum : null,
        payNow: isPartial ? payNum : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      return setError(data.error);
    }
    router.push(`/notas/${data.id}?nuevo=1`);
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-muted">Método de pago</legend>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <label key={m} className={cx("relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-center text-sm font-semibold transition-[color,transform] duration-150 active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus [&>*:not(input)]:relative", method === m ? "border-accent text-accent-foreground" : "border-border hover:bg-surface-secondary")}>
              <input type="radio" name="cmethod" className="sr-only" checked={method === m} onChange={() => setMethod(m)} />
                {method === m && <motion.i layoutId="cq-pay" transition={PILL_SPRING} className="absolute -inset-px !absolute rounded-2xl bg-accent" />}
              <Icon name={m === "efectivo" ? "wallet" : m === "terminal" ? "card" : "cash"} className="size-5" />
              <span>{m === "terminal" ? "Terminal" : PAYMENT_LABELS[m]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {method === "terminal" && (
        <div className="rounded-2xl bg-warning-soft p-4 text-warning-soft-foreground">
          <Field label="Comisión por terminal (%)" htmlFor="cpct">
            <Input id="cpct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
          </Field>
        </div>
      )}
      {preferential && (
        <div className="flex flex-col gap-3 rounded-2xl bg-accent-soft/60 p-3.5">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-semibold">Pago parcial</span>
              <span className="text-muted">Cliente preferencial: puede dejar saldo.</span>
            </span>
            <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="size-5 accent-[var(--accent)]" />
          </label>
          {partial && (
            <Field label="Paga hoy" htmlFor="cq-paynow" hint={`Queda a deber ${formatMoney(round2(subtotal - payNum))}`}>
              <Input id="cq-paynow" inputMode="decimal" value={payNow} onChange={(e) => setPayNow(e.target.value)} placeholder="0.00" />
            </Field>
          )}
        </div>
      )}
      {method === "efectivo" && (
        <Field label="Efectivo recibido (opcional)" htmlFor="ccash">
          <Input id="ccash" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
        </Field>
      )}
      <dl className="flex flex-col gap-1 border-t border-dashed border-separator pt-3 tabular">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{formatMoney(subtotal)}</dd>
        </div>
        {method === "terminal" && totals && (
          <div className="flex justify-between">
            <dt>Comisión ({formatNumber(totals.commissionPct, 2)}%)</dt>
            <dd>{formatMoney(totals.commissionAmount)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <dt className="font-semibold">{isPartial ? "Paga hoy" : "Total a cobrar"}</dt>
          <dd className="font-display text-3xl">{totals ? <AnimatedNumber value={isPartial ? nowReceived : totals.total} /> : "—"}</dd>
        </div>
        {change !== null && Number.isFinite(change) && (
          <div className={cx("flex justify-between font-semibold", change < 0 ? "text-bad" : "text-ok")}>
            <dt>{change < 0 ? "Falta" : "Cambio"}</dt>
            <dd>{formatMoney(Math.abs(change))}</dd>
          </div>
        )}
      </dl>
      {error && <Alert>{error}</Alert>}
      <Button onClick={submit} loading={busy} disabled={(!method && !(isPartial && payNum === 0))} className="min-h-12 text-base">
        Cobrar y convertir en venta
      </Button>
    </div>
  );
}
