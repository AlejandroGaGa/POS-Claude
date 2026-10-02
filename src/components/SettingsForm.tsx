"use client";
import { useState } from "react";
import type { SettingsData } from "@/lib/models/Settings";
import { Alert, Button, Field, FieldGrid, FormActions, Input, Section, Textarea } from "./ui";
import Icon from "./Icon";

export default function SettingsForm({ settings, whatsapp }: { settings: SettingsData; whatsapp: { enabled: boolean; template: string; lang: string } }) {
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? { tone: "ok", text: "Ajustes guardados." } : { tone: "bad", text: data.error });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <Section title="Datos que salen en la nota" description="Encabezado y pie de la nota impresa y del PDF.">
          <FieldGrid cols={2}>
            <Field label="Nombre del negocio" htmlFor="businessName" className="sm:col-span-2">
              <Input id="businessName" name="businessName" defaultValue={settings.businessName} required />
            </Field>
            <Field label="Dirección" htmlFor="address" className="sm:col-span-2">
              <Input id="address" name="address" defaultValue={settings.address} />
            </Field>
            <Field label="Teléfono" htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={settings.phone} />
            </Field>
            <Field label="RFC" htmlFor="rfc">
              <Input id="rfc" name="rfc" defaultValue={settings.rfc} className="uppercase" />
            </Field>
            <Field label="Pie de la nota" htmlFor="ticketFooter" className="sm:col-span-2">
              <Textarea id="ticketFooter" name="ticketFooter" defaultValue={settings.ticketFooter} rows={3} />
            </Field>
          </FieldGrid>
        </Section>

        <div className="flex flex-col gap-4">
          <Section title="Ventas" description="Valores sugeridos en el mostrador.">
            <FieldGrid cols={2}>
              <Field label="Comisión terminal (%)" htmlFor="defaultCommissionPct" hint="Se puede cambiar en cada venta">
                <Input id="defaultCommissionPct" name="defaultCommissionPct" inputMode="decimal" defaultValue={settings.defaultCommissionPct} required />
              </Field>
              <Field label="Vigencia (días)" htmlFor="quoteValidityDays" hint="De cada cotización">
                <Input id="quoteValidityDays" name="quoteValidityDays" inputMode="numeric" defaultValue={settings.quoteValidityDays} required />
              </Field>
            </FieldGrid>
          </Section>

          <Section title="WhatsApp" description="Envío de la nota en PDF a tus clientes.">
            <div className="flex items-start gap-3 rounded-2xl bg-default/60 p-3.5">
              <span className={whatsapp.enabled ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground" : "flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground"}>
                <Icon name={whatsapp.enabled ? "check" : "alert"} className="size-5" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{whatsapp.enabled ? "Conectado" : "Sin configurar"}</p>
                <p className="text-muted">
                  {whatsapp.enabled
                    ? `Plantilla «${whatsapp.template}» (${whatsapp.lang}).`
                    : "Agrega WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID (ver README). Mientras tanto se envía el resumen en texto."}
                </p>
              </div>
            </div>
          </Section>
        </div>
      </div>

      <FormActions status={msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}>
        <Button type="submit" loading={busy} className="w-full sm:w-auto sm:min-w-44">
          Guardar ajustes
        </Button>
      </FormActions>
    </form>
  );
}
