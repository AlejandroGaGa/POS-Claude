"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@heroui/react";
import { CUSTOMER_LABELS, CUSTOMER_TYPES, type CustomerType } from "@/lib/pricing";
import CustomerPicker, { type PickedCustomer } from "../CustomerPicker";
import { Alert, Button, Input, cx } from "../ui";
import Icon from "../Icon";

const TYPE_HINT: Record<CustomerType, string> = {
  particular: "Precio normal",
  vidriero: "Precio especial en vidrio",
};

type Tab = "buscar" | "nuevo";

/**
 * Cliente de la venta, fuera del carrito para que éste quede corto.
 * Dos pestañas: buscar uno registrado o darlo de alta ahí mismo (nombre y teléfono) sin salir de la venta.
 */
export default function CustomerDialog({
  open,
  onClose,
  customer,
  onPick,
  onMoreData,
  customerType,
  onType,
  notes,
  setNotes,
}: {
  open: boolean;
  onClose: () => void;
  customer: PickedCustomer | null;
  onPick: (c: PickedCustomer | null) => void;
  /** Abre el formulario completo (correo, dirección, preferencial) con el nombre capturado. */
  onMoreData: (name: string) => void;
  customerType: CustomerType;
  onType: (t: CustomerType) => void;
  notes: string;
  setNotes: (v: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("buscar");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<PickedCustomer | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTab("buscar");
      setName("");
      setPhone("");
      setError("");
      setExisting(null);
    }
  }, [open]);

  function goNew(prefill = "") {
    setTab("nuevo");
    if (prefill) setName(prefill);
    setError("");
    setExisting(null);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setExisting(null);
    if (name.trim().length < 2) {
      setError("Escribe el nombre del cliente.");
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), customerType }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.status === 409 && phone.trim()) {
      // Ya existe con ese teléfono: se ofrece usarlo en lugar de duplicarlo.
      const r = await fetch(`/api/customers?limite=1&q=${encodeURIComponent(phone.trim())}`).then((x) => x.json()).catch(() => null);
      const c = r?.customers?.[0];
      if (c) setExisting({ ...c, _id: String(c._id) });
      setError(data.error || "Ya hay un cliente con ese teléfono.");
      return;
    }
    if (!res.ok) return setError(data.error || "No se pudo guardar el cliente.");
    const c = data.customer;
    onPick({ _id: String(c._id), name: c.name, phone: c.phone, customerType: c.customerType, preferential: c.preferential, creditLimit: c.creditLimit });
    onClose();
  }

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Container placement="top">
        <Modal.Dialog aria-labelledby="cust-title" className="w-full sm:max-w-lg">
          <Modal.CloseTrigger aria-label="Cerrar" />
          <Modal.Header>
            <Modal.Heading id="cust-title" className="font-display text-2xl">
              Cliente
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex min-h-[26rem] flex-col gap-5 text-foreground">
            {customer ? (
              <div className="flex flex-col gap-2">
                <p className="text-lg font-semibold">Cliente de esta venta</p>
                <CustomerPicker id="cd-pick" value={customer} onPick={onPick} />
              </div>
            ) : (
              <>
                <div role="tablist" aria-label="Cliente" className="grid grid-cols-2 gap-1 rounded-2xl bg-default p-1">
                  {(
                    [
                      ["buscar", "Buscar cliente", "search"],
                      ["nuevo", "Cliente nuevo", "personPlus"],
                    ] as const
                  ).map(([t, label, icon]) => (
                    <button
                      key={t}
                      id={`cd-tab-${t}`}
                      type="button"
                      role="tab"
                      aria-selected={tab === t}
                      aria-controls={`cd-panel-${t}`}
                      tabIndex={tab === t ? 0 : -1}
                      onClick={() => (t === "nuevo" ? goNew() : setTab("buscar"))}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                          const next = t === "buscar" ? "nuevo" : "buscar";
                          if (next === "nuevo") goNew();
                          else setTab("buscar");
                          document.getElementById(`cd-tab-${next}`)?.focus();
                        }
                      }}
                      className={cx(
                        "flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-base font-semibold whitespace-nowrap focus-visible:ring-4 focus-visible:ring-focus sm:text-lg",
                        tab === t ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
                      )}
                    >
                      <Icon name={icon} className="size-5" />
                      {label}
                    </button>
                  ))}
                </div>

                {tab === "buscar" ? (
                  <div id="cd-panel-buscar" role="tabpanel" aria-labelledby="cd-tab-buscar" className="flex flex-col gap-2">
                    <label htmlFor="cd-pick" className="text-lg font-semibold">
                      ¿Quién compra?
                    </label>
                    <CustomerPicker id="cd-pick" value={null} onPick={onPick} onCreate={(n) => goNew(n)} placeholder="Nombre o teléfono…" autoFocus />
                    <p className="text-base text-muted">
                      ¿No aparece?{" "}
                      <button type="button" onClick={() => goNew()} className="link-text min-h-11 font-semibold text-accent">
                        Regístralo aquí
                      </button>
                      . Si no anotas cliente, la venta queda como «Mostrador».
                    </p>
                  </div>
                ) : (
                  <form id="cd-panel-nuevo" role="tabpanel" aria-labelledby="cd-tab-nuevo" onSubmit={create} className="flex flex-col gap-3" noValidate>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="cd-name" className="text-lg font-semibold">
                        Nombre <span className="text-base font-normal text-muted">(obligatorio)</span>
                      </label>
                      <Input
                        ref={nameRef}
                        id="cd-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="ej. Juan Pérez"
                        autoComplete="off"
                        className="h-14 !text-lg"
                        aria-invalid={!!error && name.trim().length < 2}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="cd-phone" className="text-lg font-semibold">
                        Teléfono <span className="text-base font-normal text-muted">(opcional)</span>
                      </label>
                      <Input id="cd-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10 dígitos" autoComplete="off" className="h-14 !text-lg" />
                    </div>
                    {error && (
                      <Alert>
                        {error}
                        {existing && (
                          <Button
                            type="button"
                            variant="secondary"
                            className="mt-2 min-h-12 w-full !text-base"
                            onClick={() => {
                              onPick(existing);
                              onClose();
                            }}
                          >
                            Usar a {existing.name}
                          </Button>
                        )}
                      </Alert>
                    )}
                    <Button type="submit" loading={saving} className="min-h-14 !text-lg">
                      <Icon name="personPlus" className="size-5" /> Guardar y usar en esta venta
                    </Button>
                    <button type="button" onClick={() => onMoreData(name.trim())} className="link-text min-h-11 self-start text-base font-semibold text-accent">
                      Agregar más datos (correo, dirección…)
                    </button>
                  </form>
                )}
              </>
            )}

            <fieldset>
              <legend className="mb-2 text-lg font-semibold">Tipo de cliente</legend>
              <div className="grid grid-cols-2 gap-2">
                {CUSTOMER_TYPES.map((t) => (
                  <label
                    key={t}
                    className={cx(
                      "flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 px-2 text-center has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-focus",
                      customerType === t ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface hover:bg-default",
                    )}
                  >
                    <input type="radio" name="cd-type" checked={customerType === t} onChange={() => onType(t)} className="sr-only" />
                    <span className="text-lg font-semibold">{CUSTOMER_LABELS[t]}</span>
                    <span className="text-sm">{TYPE_HINT[t]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <label htmlFor="cd-notes" className="text-lg font-semibold">
                Notas <span className="text-base font-normal text-muted">(opcional)</span>
              </label>
              <Input id="cd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ej. entrega a domicilio" className="h-14 !text-lg" />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" onClick={onClose} className="min-h-14 w-full !text-lg">
              Listo
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
