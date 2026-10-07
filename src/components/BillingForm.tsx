"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@heroui/react";
import { CFDI_USES, TAX_REGIMES } from "@/lib/sat";
import { Alert, Button, Field, FieldGrid, Input, Select, Textarea } from "./ui";
import Icon from "./Icon";
import CustomerPicker, { type PickedCustomer } from "./CustomerPicker";

import { billingText } from "@/lib/billing";
export { billingText };

export interface BillingJSON {
  _id: string;
  customer: string;
  customerName?: string;
  legalName: string;
  rfc: string;
  taxRegime?: string;
  cfdiUse?: string;
  zip?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export function CopyBilling({ profile, className }: { profile: BillingJSON; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      className={className ?? "min-h-9 px-3 text-sm"}
      onClick={async () => {
        await navigator.clipboard.writeText(billingText(profile));
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      <Icon name={ok ? "check" : "copy"} className="size-4" /> {ok ? "Copiado" : "Copiar"}
    </Button>
  );
}

/** Alta / edición de datos fiscales. Con `customer` fijo (desde el detalle) o eligiéndolo (desde Facturación). */
export default function BillingForm({
  open,
  onOpenChange,
  profile,
  customer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile?: BillingJSON | null;
  customer?: PickedCustomer | null;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<PickedCustomer | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setError("");
    setPicked(customer ?? (profile ? { _id: profile.customer, name: profile.customerName ?? "" } : null));
  }, [open, customer, profile]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) return setError("Elige el cliente.");
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(["legalName", "rfc", "taxRegime", "cfdiUse", "zip", "email", "address", "notes"].map((k) => [k, String(f.get(k) ?? "")]));
    setBusy(true);
    setError("");
    const res = await fetch(profile ? `/api/billing/${profile._id}` : "/api/billing", {
      method: profile ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, customerId: picked._id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "No se pudo guardar.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Container placement="auto" scroll="inside">
        <Modal.Dialog className="sm:max-w-xl">
          <Modal.CloseTrigger aria-label="Cerrar" />
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <Icon name="invoice" className="size-5" />
              </Modal.Icon>
              <Modal.Heading>{profile ? "Editar datos de facturación" : "Nuevos datos de facturación"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {!customer && (
                <Field label="Cliente *" htmlFor="bf-customer">
                  <CustomerPicker id="bf-customer" value={picked} onPick={setPicked} />
                </Field>
              )}
              <FieldGrid cols={2}>
                <Field label="Razón social *" htmlFor="bf-legal" className="sm:col-span-2" hint="Como aparece en la constancia de situación fiscal">
                  <Input id="bf-legal" name="legalName" defaultValue={profile?.legalName} required minLength={2} className="uppercase" />
                </Field>
                <Field label="RFC *" htmlFor="bf-rfc">
                  <Input id="bf-rfc" name="rfc" defaultValue={profile?.rfc} required maxLength={13} className="uppercase tabular" />
                </Field>
                <Field label="Código postal" htmlFor="bf-zip">
                  <Input id="bf-zip" name="zip" defaultValue={profile?.zip} inputMode="numeric" maxLength={5} />
                </Field>
                <Field label="Régimen fiscal" htmlFor="bf-regime" className="sm:col-span-2">
                  <Select id="bf-regime" name="taxRegime" defaultValue={profile?.taxRegime ?? ""}>
                    <option value="">Sin especificar</option>
                    {TAX_REGIMES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Uso de CFDI" htmlFor="bf-use">
                  <Select id="bf-use" name="cfdiUse" defaultValue={profile?.cfdiUse ?? ""}>
                    <option value="">Sin especificar</option>
                    {CFDI_USES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Correo para la factura" htmlFor="bf-email">
                  <Input id="bf-email" name="email" type="email" defaultValue={profile?.email} />
                </Field>
                <Field label="Domicilio fiscal" htmlFor="bf-address" className="sm:col-span-2">
                  <Input id="bf-address" name="address" defaultValue={profile?.address} />
                </Field>
                <Field label="Notas" htmlFor="bf-notes" className="sm:col-span-2">
                  <Textarea id="bf-notes" name="notes" defaultValue={profile?.notes} rows={2} className="min-h-11" />
                </Field>
              </FieldGrid>
              {error && <Alert>{error}</Alert>}
            </Modal.Body>
            <Modal.Footer className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" loading={busy}>
                Guardar
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Lista de datos fiscales de un cliente con alta, edición, copia y borrado. */
export function BillingList({ profiles, customer, canDelete }: { profiles: BillingJSON[]; customer: PickedCustomer; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<BillingJSON | null>(null);
  async function remove(b: BillingJSON) {
    if (!confirm(`¿Borrar los datos de ${b.legalName}?`)) return;
    const res = await fetch(`/api/billing/${b._id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }
  return (
    <div className="flex flex-col gap-3">
      {profiles.length === 0 && <p className="text-sm text-muted">Sin datos fiscales registrados.</p>}
      {profiles.map((b) => (
        <div key={b._id} className="rounded-2xl bg-default/60 p-3.5 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{b.legalName}</p>
              <p className="tabular text-muted">{b.rfc}{b.zip ? ` · C.P. ${b.zip}` : ""}</p>
            </div>
            <CopyBilling profile={b} />
          </div>
          {(b.taxRegime || b.cfdiUse) && <p className="mt-1 text-muted">{[b.taxRegime, b.cfdiUse].filter(Boolean).join(" · ")}</p>}
          {b.email && <p className="text-muted">{b.email}</p>}
          <div className="mt-2 flex gap-3">
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => { setEdit(b); setOpen(true); }}>
              Editar
            </button>
            {canDelete && (
              <button type="button" className="font-medium text-danger hover:underline" onClick={() => remove(b)}>
                Borrar
              </button>
            )}
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={() => { setEdit(null); setOpen(true); }}>
        <Icon name="plus" className="size-4" /> Agregar datos fiscales
      </Button>
      <BillingForm open={open} onOpenChange={setOpen} profile={edit} customer={customer} />
    </div>
  );
}

/** Botón "Nuevos datos" (eligiendo cliente) para la página de Facturación. */
export function NewBillingButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="plus" className="size-4" /> Nuevos datos
      </Button>
      <BillingForm open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Acciones de un renglón en Facturación. */
export function BillingRowActions({ profile, canDelete }: { profile: BillingJSON; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <span className="flex justify-end gap-1">
      <CopyBilling profile={profile} />
      <Button variant="ghost" className="min-h-9 px-3 text-sm" onClick={() => setOpen(true)}>
        <Icon name="edit" className="size-4" /> Editar
      </Button>
      {canDelete && (
      <Button
        variant="ghost"
        className="min-h-9 px-3 text-sm text-danger"
        onClick={async () => {
          if (!confirm(`¿Borrar los datos de ${profile.legalName}?`)) return;
          const res = await fetch(`/api/billing/${profile._id}`, { method: "DELETE" });
          if (res.ok) router.refresh();
        }}
        aria-label={`Borrar ${profile.legalName}`}
      >
        <Icon name="trash" className="size-4" />
      </Button>
      )}
      <BillingForm open={open} onOpenChange={setOpen} profile={profile} />
    </span>
  );
}
