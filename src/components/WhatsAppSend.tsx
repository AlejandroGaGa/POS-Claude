"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Modal } from "@heroui/react";
import { Alert, Button, Field, Input, btn } from "./ui";
import Icon from "./Icon";
import { BASE } from "./motion";

type Props = {
  id: string;
  folio: string;
  defaultPhone: string;
  /** Hay credenciales de Meta en el servidor. */
  enabled: boolean;
  /** Enlace wa.me con el resumen en texto (respaldo). */
  waUrl: string;
  lastSent?: { at: string; to: string; by?: string } | null;
};

export default function WhatsAppSend({ id, folio, defaultPhone, enabled, waUrl, lastSent }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  const digits = phone.replace(/\D/g, "");
  const valid = digits.length >= 10 && digits.length <= 15;

  function openModal() {
    setState("idle");
    setError("");
    setPhone(defaultPhone);
    setOpen(true);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setError("Escribe 10 dígitos (o con lada internacional).");
    setState("sending");
    setError("");
    try {
      const res = await fetch(`/api/sales/${id}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, savePhone: !defaultPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("idle");
        return setError(data.error || "No se pudo enviar.");
      }
      setSentTo(data.to);
      setState("sent");
      router.refresh();
    } catch {
      setState("idle");
      setError("Sin conexión. Intenta de nuevo.");
    }
  }

  const pretty = (d: string) => (d.startsWith("52") && d.length === 12 ? `+52 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : `+${d}`);

  return (
    <>
      <Button variant="secondary" onClick={openModal}>
        <Icon name="chat" /> WhatsApp
      </Button>
      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container placement="auto">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger aria-label="Cerrar" />
            <AnimatePresence mode="wait" initial={false}>
              {state === "sent" ? (
                <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={BASE} className="flex flex-col items-center gap-3 py-4 text-center">
                  <motion.span
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 22, delay: 0.05 }}
                    className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground"
                  >
                    <Icon name="check" className="size-7" />
                  </motion.span>
                  <Modal.Heading className="font-display text-2xl">PDF enviado</Modal.Heading>
                  <p className="text-muted">
                    {folio} se envió a <span className="font-semibold text-foreground tabular">{pretty(sentTo)}</span>.
                  </p>
                  <Button className="mt-2 w-full" onClick={() => setOpen(false)}>
                    Listo
                  </Button>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={send} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BASE} className="flex flex-col gap-4">
                  <Modal.Header>
                    <Modal.Icon className="bg-success-soft text-success-soft-foreground">
                      <Icon name="chat" className="size-5" />
                    </Modal.Icon>
                    <Modal.Heading>Enviar PDF por WhatsApp</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="flex flex-col gap-3">
                    {enabled ? (
                      <>
                        <p className="text-muted">El cliente recibirá {folio} como documento PDF.</p>
                        <Field label="Teléfono del cliente" htmlFor="wa-phone" hint="10 dígitos. Se agrega +52 automáticamente.">
                          <Input
                            id="wa-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="222 123 4567"
                            autoFocus
                            required
                          />
                        </Field>
                        {lastSent && (
                          <p className="text-sm text-muted">
                            Último envío: {new Date(lastSent.at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} a {pretty(lastSent.to)}
                            {lastSent.by ? ` (${lastSent.by})` : ""}
                          </p>
                        )}
                      </>
                    ) : (
                      <Alert tone="warn">
                        El envío de PDF por WhatsApp aún no está configurado. El administrador debe agregar las credenciales de Meta (ver README). Mientras tanto puedes mandar el resumen en texto desde tu WhatsApp.
                      </Alert>
                    )}
                    {error && <Alert>{error}</Alert>}
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                      Mandar resumen en texto con mi WhatsApp
                    </a>
                  </Modal.Body>
                  <Modal.Footer className="flex gap-2">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    {enabled && (
                      <Button type="submit" className="flex-1" loading={state === "sending"} disabled={!valid}>
                        Enviar PDF
                      </Button>
                    )}
                  </Modal.Footer>
                </motion.form>
              )}
            </AnimatePresence>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

export function PdfLink({ id }: { id: string }) {
  return (
    <a href={`/api/sales/${id}/pdf`} target="_blank" rel="noopener noreferrer" className={btn("secondary")}>
      <Icon name="download" /> PDF
    </a>
  );
}
