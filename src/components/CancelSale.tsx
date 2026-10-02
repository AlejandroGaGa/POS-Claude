"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@heroui/react";
import { Alert, Button, Field, Textarea } from "./ui";
import Icon from "./Icon";

export default function CancelSale({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/sales/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" className="text-danger" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container placement="auto">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger aria-label="Cerrar" />
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Modal.Header>
                <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
                  <Icon name="alert" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>{label}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-muted">No se puede deshacer. Quedará registrado quién canceló y por qué.</p>
                <Field label="Motivo" htmlFor="reason">
                  <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} autoFocus />
                </Field>
                {error && <Alert>{error}</Alert>}
              </Modal.Body>
              <Modal.Footer className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                  Volver
                </Button>
                <Button type="submit" variant="danger" className="flex-1" loading={busy}>
                  Confirmar
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
