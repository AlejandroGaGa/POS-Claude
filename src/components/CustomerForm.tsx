"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@heroui/react";
import { CUSTOMER_LABELS, CUSTOMER_TYPES, type CustomerType } from "@/lib/pricing";
import { Alert, Button, Checkbox, Field, FieldGrid, Input, Select, Textarea } from "./ui";
import Icon from "./Icon";

export interface CustomerJSON {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  customerType?: CustomerType;
  preferential?: boolean;
  creditLimit?: number;
  active?: boolean;
}

/** Alta / edición de cliente en un diálogo (desde Clientes, el detalle o el mostrador). */
export default function CustomerForm({
  customer,
  canCredit,
  open,
  onOpenChange,
  onSaved,
  initialName,
}: {
  customer?: CustomerJSON | null;
  canCredit: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: (c: CustomerJSON) => void;
  initialName?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preferential, setPreferential] = useState(!!customer?.preferential);
  useEffect(() => {
    if (open) {
      setError("");
      setPreferential(!!customer?.preferential);
    }
  }, [open, customer]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    const body: Record<string, unknown> = {
      name: g("name"),
      phone: g("phone"),
      email: g("email"),
      address: g("address"),
      notes: g("notes"),
      customerType: g("customerType") || "particular",
    };
    if (canCredit) {
      body.preferential = preferential;
      body.creditLimit = Number(g("creditLimit") || 0);
    }
    setBusy(true);
    setError("");
    const res = await fetch(customer ? `/api/customers/${customer._id}` : "/api/customers", {
      method: customer ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "No se pudo guardar.");
    onOpenChange(false);
    onSaved?.({ ...data.customer, _id: String(data.customer._id) });
    router.refresh();
  }

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Container placement="auto" scroll="inside">
        <Modal.Dialog className="sm:max-w-xl">
          <Modal.CloseTrigger aria-label="Cerrar" />
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <Icon name="person" className="size-5" />
              </Modal.Icon>
              <Modal.Heading>{customer ? "Editar cliente" : "Nuevo cliente"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <FieldGrid cols={2}>
                <Field label="Nombre *" htmlFor="cu-name" className="sm:col-span-2">
                  <Input id="cu-name" name="name" defaultValue={customer?.name ?? initialName} required minLength={2} autoFocus />
                </Field>
                <Field label="Teléfono" htmlFor="cu-phone">
                  <Input id="cu-phone" name="phone" type="tel" defaultValue={customer?.phone} placeholder="222 123 4567" />
                </Field>
                <Field label="Correo" htmlFor="cu-email">
                  <Input id="cu-email" name="email" type="email" defaultValue={customer?.email} />
                </Field>
                <Field label="Dirección" htmlFor="cu-address" className="sm:col-span-2">
                  <Input id="cu-address" name="address" defaultValue={customer?.address} />
                </Field>
                <Field label="Precio de vidrio" htmlFor="cu-type" hint="Se aplica al elegirlo en el mostrador">
                  <Select id="cu-type" name="customerType" defaultValue={customer?.customerType ?? "particular"}>
                    {CUSTOMER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CUSTOMER_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Notas" htmlFor="cu-notes">
                  <Textarea id="cu-notes" name="notes" defaultValue={customer?.notes} rows={1} className="min-h-11" />
                </Field>
              </FieldGrid>
              {canCredit ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                  <Checkbox checked={preferential} onChange={(e) => setPreferential(e.target.checked)} label="Cliente preferencial" hint="Puede pagar en parcialidades" />
                  <Field label="Límite de crédito" htmlFor="cu-limit" hint="0 = sin límite">
                    <Input id="cu-limit" name="creditLimit" inputMode="decimal" defaultValue={customer?.creditLimit ?? 0} disabled={!preferential} />
                  </Field>
                </div>
              ) : (
                customer?.preferential && <Alert tone="ok">Cliente preferencial: puede pagar en parcialidades.</Alert>
              )}
              {error && <Alert>{error}</Alert>}
            </Modal.Body>
            <Modal.Footer className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" loading={busy}>
                {customer ? "Guardar" : "Registrar cliente"}
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Botón que abre el diálogo de alta/edición. */
export function CustomerFormButton({ customer, canCredit, children, variant = "primary", className }: { customer?: CustomerJSON | null; canCredit: boolean; children: ReactNode; variant?: "primary" | "secondary" | "ghost"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <CustomerForm customer={customer} canCredit={canCredit} open={open} onOpenChange={setOpen} />
    </>
  );
}
