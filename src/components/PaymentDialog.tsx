"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@heroui/react";
import { formatMoney, PAYMENT_LABELS, PAYMENT_METHODS, paymentLine, round2, type PaymentMethod } from "@/lib/pricing";
import { Alert, Button, Field, Input, cx } from "./ui";
import Icon from "./Icon";

/** Registrar un abono a una venta con saldo. */
export default function PaymentDialog({
  saleId,
  folio,
  balance,
  defaultPct,
  label = "Registrar abono",
  className,
  variant = "primary",
}: {
  saleId: string;
  folio: string;
  balance: number;
  defaultPct: number;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [pct, setPct] = useState(String(defaultPct));
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setAmount(String(balance));
      setCash("");
      setNote("");
      setError("");
    }
  }, [open, balance]);

  const amt = Number(amount.replace(",", "."));
  let line: ReturnType<typeof paymentLine> | null = null;
  try {
    line = paymentLine(amt, method, method === "terminal" ? Number(pct.replace(",", ".")) : 0);
  } catch {}
  const cashNum = Number(cash.replace(",", "."));
  const change = method === "efectivo" && cash !== "" && line ? round2(cashNum - line.received) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!line) return setError("Captura un monto válido.");
    if (amt > balance + 0.005) return setError(`El abono no puede ser mayor al saldo (${formatMoney(balance)}).`);
    setBusy(true);
    setError("");
    const res = await fetch(`/api/sales/${saleId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt, paymentMethod: method, commissionPct: method === "terminal" ? Number(pct.replace(",", ".")) : 0, cashReceived: method === "efectivo" && cash !== "" ? cashNum : null, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "No se pudo registrar.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <Icon name="coin" className="size-4" /> {label}
      </Button>
      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container placement="auto">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger aria-label="Cerrar" />
            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
              <Modal.Header>
                <Modal.Icon className="bg-success-soft text-success-soft-foreground">
                  <Icon name="coin" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Abono a {folio}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <p className="text-sm text-muted">
                  Saldo pendiente: <span className="font-semibold text-foreground tabular">{formatMoney(balance)}</span>
                </p>
                <Field label="Monto del abono" htmlFor="pay-amount">
                  <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold" autoFocus />
                </Field>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Método</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <label key={m} className={cx("flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus", method === m ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-surface-secondary")}>
                        <input type="radio" name="pay-method" className="sr-only" checked={method === m} onChange={() => setMethod(m)} />
                        {m === "terminal" ? "Terminal" : PAYMENT_LABELS[m]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {method === "terminal" && (
                  <Field label="Comisión de terminal (%)" htmlFor="pay-pct">
                    <Input id="pay-pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
                  </Field>
                )}
                {method === "efectivo" && (
                  <Field label="Efectivo recibido (opcional)" htmlFor="pay-cash">
                    <Input id="pay-cash" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
                  </Field>
                )}
                <Field label="Nota (opcional)" htmlFor="pay-note">
                  <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ej. segundo abono" />
                </Field>
                {line && (
                  <dl className="flex flex-col gap-1 rounded-2xl bg-default/60 p-3.5 text-sm tabular">
                    {line.commissionAmount > 0 && (
                      <div className="flex justify-between">
                        <dt>Comisión</dt>
                        <dd>{formatMoney(line.commissionAmount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold">
                      <dt>Cobrar ahora</dt>
                      <dd>{formatMoney(line.received)}</dd>
                    </div>
                    <div className="flex justify-between text-muted">
                      <dt>Saldo después</dt>
                      <dd>{formatMoney(Math.max(0, round2(balance - amt)))}</dd>
                    </div>
                    {change !== null && Number.isFinite(change) && (
                      <div className={cx("flex justify-between font-semibold", change < 0 ? "text-bad" : "text-ok")}>
                        <dt>{change < 0 ? "Falta" : "Cambio"}</dt>
                        <dd>{formatMoney(Math.abs(change))}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {error && <Alert>{error}</Alert>}
              </Modal.Body>
              <Modal.Footer className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" loading={busy} disabled={!line}>
                  Registrar abono
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
