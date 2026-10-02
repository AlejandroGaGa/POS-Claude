"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomerForm, { type CustomerJSON } from "./CustomerForm";
import { Button } from "./ui";
import Icon from "./Icon";

/** Editar / dar de baja desde el detalle del cliente. */
export default function CustomerActions({ customer, canCredit }: { customer: CustomerJSON; canCredit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Icon name="edit" className="size-4" /> Editar
      </Button>
      {canCredit && (
        <Button
          variant="secondary"
          className="text-danger"
          title={err || undefined}
          onClick={async () => {
            if (!confirm(`¿Dar de baja a ${customer.name}? Su historial se conserva.`)) return;
            const res = await fetch(`/api/customers/${customer._id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setErr(data.error);
              alert(data.error);
              return;
            }
            router.push("/clientes");
          }}
        >
          Dar de baja
        </Button>
      )}
      <CustomerForm customer={customer} canCredit={canCredit} open={open} onOpenChange={setOpen} />
    </>
  );
}
