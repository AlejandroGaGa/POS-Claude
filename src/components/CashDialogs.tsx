"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@heroui/react";
import { CASH_BOX_LABELS, CONCEPTS, type CashBox, type MovementType } from "@/lib/cashConstants";
import { formatMoney } from "@/lib/pricing";
import { Alert, Button, Field, Input, Select, cx } from "./ui";
import Icon from "./Icon";

type Kind = { type: MovementType; box: CashBox } | { type: "traspaso"; box: CashBox };

/** Diálogo para registrar una entrada, una salida o un traspaso entre cajas. */
function MovementDialog({ kind, open, onOpenChange, chicaBalance }: { kind: Kind; open: boolean; onOpenChange: (o: boolean) => void; chicaBalance: number }) {
  const router = useRouter();
  const [box, setBox] = useState<CashBox>(kind.box);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setBox(kind.box);
    setConcept(kind.type === "traspaso" ? "" : kind.box === "chica" && kind.type === "entrada" ? "Fondo de caja" : "");
    setAmount("");
    setDescription("");
    setError("");
  }, [open, kind]);

  const isTransfer = kind.type === "traspaso";
  const title = isTransfer ? "Traspaso entre cajas" : kind.type === "entrada" ? "Entrada de efectivo" : "Salida de efectivo";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount.replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) return setError("Captura una cantidad mayor a 0.");
    setBusy(true);
    setError("");
    const res = await fetch(isTransfer ? "/api/cash/transfer" : "/api/cash/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isTransfer ? { from: box, amount: amt, description } : { box, type: kind.type, concept, amount: amt, description }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "No se pudo guardar.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Container placement="auto">
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger aria-label="Cerrar" />
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
            <Modal.Header>
              <Modal.Icon className={cx(kind.type === "salida" ? "bg-danger-soft text-danger-soft-foreground" : kind.type === "entrada" ? "bg-success-soft text-success-soft-foreground" : "bg-accent-soft text-accent-soft-foreground")}>
                <Icon name={isTransfer ? "transfer" : kind.type === "entrada" ? "down" : "up"} className="size-5" />
              </Modal.Icon>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <Field label={isTransfer ? "Sale de" : "Caja"} htmlFor="mv-box" hint={isTransfer ? `Entra a ${box === "caja" ? "caja chica" : "caja de mostrador"}` : box === "chica" ? `Saldo actual: ${formatMoney(chicaBalance)}` : undefined}>
                <Select id="mv-box" value={box} onChange={(e) => setBox(e.target.value as CashBox)}>
                  <option value="caja">{CASH_BOX_LABELS.caja}</option>
                  <option value="chica">{CASH_BOX_LABELS.chica}</option>
                </Select>
              </Field>
              {!isTransfer && (
                <Field label="Concepto" htmlFor="mv-concept" hint={kind.type === "entrada" ? "¿Por qué entra?" : "¿En qué se gastó?"}>
                  <Input id="mv-concept" list="mv-concepts" value={concept} onChange={(e) => setConcept(e.target.value)} required minLength={2} placeholder={kind.type === "entrada" ? "Fondo de caja" : "Compra de material"} />
                  <datalist id="mv-concepts">
                    {CONCEPTS[kind.type as MovementType].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
              )}
              <Field label="Cantidad" htmlFor="mv-amount">
                <Input id="mv-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" className="text-lg font-semibold" autoFocus />
              </Field>
              <Field label="Detalle (opcional)" htmlFor="mv-desc">
                <Input id="mv-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind.type === "salida" ? "ej. 2 cajas de pijas a Ferretera López" : "ej. fondo del lunes"} />
              </Field>
              {!isTransfer && (
                <div className="flex flex-wrap gap-1.5">
                  {CONCEPTS[kind.type as MovementType].slice(0, 6).map((c) => (
                    <button key={c} type="button" onClick={() => setConcept(c)} className={cx("min-h-9 rounded-full px-3 text-sm font-medium transition-colors", concept === c ? "bg-accent text-accent-foreground" : "bg-default hover:bg-default-hover")}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
              {error && <Alert>{error}</Alert>}
            </Modal.Body>
            <Modal.Footer className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" variant={kind.type === "salida" ? "danger" : "primary"} loading={busy}>
                Registrar
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Botón + diálogo de movimiento. */
export function CashButton({
  type,
  box = "caja",
  chicaBalance,
  children,
  variant = "secondary",
  className,
}: {
  type: MovementType | "traspaso";
  box?: CashBox;
  chicaBalance: number;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <MovementDialog kind={{ type, box } as Kind} open={open} onOpenChange={setOpen} chicaBalance={chicaBalance} />
    </>
  );
}
