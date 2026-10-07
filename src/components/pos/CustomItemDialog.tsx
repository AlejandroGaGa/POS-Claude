"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@heroui/react";
import { formatMoney, priceLine, type PricedLine } from "@/lib/pricing";
import { CUSTOM_MAX_PRICE, CUSTOM_MODE_LABELS, CUSTOM_MODES, customPricing, customProduct, isCustomMode, type CustomMode } from "@/lib/customItem";
import type { CartLine } from "./AddItemDialog";
import { Alert, Button, Input, cx } from "../ui";
import Icon from "../Icon";

/** Convierte texto capturado a número (acepta coma decimal y el signo $). */
function num(v: string): number {
  const t = v.replace(/[$\s]/g, "").replace(",", ".");
  return t === "" ? NaN : Number(t);
}

const QTY_LABEL: Record<CustomMode, string> = { pieza: "Cantidad", kg: "Kilos", metro: "Metros" };
const PRICE_LABEL: Record<CustomMode, string> = { pieza: "Precio por pieza", kg: "Precio por kilo", metro: "Precio por metro" };

/**
 * Vender un producto que no está en el catálogo: se captura nombre, precio y cantidad, y entra
 * a la venta como un renglón más. No se da de alta: solo existe en esa nota o cotización.
 * Con `initial` edita un renglón fuera de catálogo que ya está en el carrito.
 */
export default function CustomItemDialog({
  open,
  initialName = "",
  initial,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** Lo que se estaba buscando: se propone como nombre. */
  initialName?: string;
  initial?: CartLine | null;
  onClose: () => void;
  onConfirm: (line: CartLine) => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<CustomMode>("pieza");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [tried, setTried] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTried(false);
    if (initial) {
      setName(initial.product.name);
      setMode(isCustomMode(initial.input.mode) ? initial.input.mode : "pieza");
      setPrice(String(initial.product.price ?? ""));
      setQty(String(initial.input.qty));
    } else {
      setName(initialName);
      setMode("pieza");
      setPrice("");
      setQty("1");
    }
    // Con el nombre ya puesto (venía de la búsqueda) lo siguiente es el precio.
    const t = setTimeout(() => ((initial || initialName ? priceRef : nameRef).current?.focus()), 60);
    return () => clearTimeout(t);
  }, [open, initial, initialName]);

  const cleanName = name.trim();
  const priceNum = num(price);
  const qtyNum = num(qty);
  let priced: PricedLine | null = null;
  let error = "";
  if (cleanName.length < 2) error = "Escribe el nombre del producto.";
  else if (!Number.isFinite(priceNum) || priceNum <= 0) error = "Escribe el precio.";
  else if (priceNum > CUSTOM_MAX_PRICE) error = "El precio es demasiado alto.";
  else {
    try {
      priced = priceLine(customPricing({ name: cleanName, price: priceNum }, mode), { mode, qty: qtyNum });
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!priced) return;
    // Al editar se conserva el mismo renglón del carrito (misma llave y mismo id).
    const id = initial ? initial.product._id.replace(/^custom:/, "") : crypto.randomUUID();
    const product = customProduct({ name: cleanName, price: priced.unitPrice }, mode, id);
    onConfirm({ key: initial?.key ?? crypto.randomUUID(), product, input: { mode, qty: priced.qty }, priced });
  }

  const big = "h-14 !text-lg";
  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Container placement="auto" scroll="inside">
        <Modal.Dialog aria-labelledby="custom-item-title" className="w-full sm:max-w-lg">
          <Modal.CloseTrigger aria-label="Cerrar" />
          {/* min-h-0 + flex-1: el formulario envuelve el cuerpo del diálogo y así el cuerpo puede hacer scroll. */}
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
            <Modal.Header>
              <Modal.Heading id="custom-item-title" className="font-display text-2xl">
                {initial ? "Cambiar producto fuera de catálogo" : "Producto fuera de catálogo"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4 text-foreground">
              <p className="text-base text-muted">Para vender algo que no está en la lista. Sale en esta nota con el nombre y precio que escribas; no se guarda en el catálogo.</p>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="ci-name" className="text-lg font-semibold">
                  ¿Qué es?
                </label>
                <Input ref={nameRef} id="ci-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Chapa especial para puerta" maxLength={160} autoComplete="off" className={big} aria-invalid={tried && cleanName.length < 2} />
              </div>

              <fieldset>
                <legend className="mb-1.5 text-lg font-semibold">Se vende por</legend>
                <div className="grid grid-cols-3 gap-2">
                  {CUSTOM_MODES.map((m) => (
                    <label
                      key={m}
                      className={cx(
                        "flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border-2 px-2 text-center text-lg font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-focus",
                        mode === m ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface hover:bg-default",
                      )}
                    >
                      <input type="radio" name="ci-mode" className="sr-only" checked={mode === m} onChange={() => setMode(m)} />
                      {CUSTOM_MODE_LABELS[m]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ci-price" className="text-lg font-semibold">
                    {PRICE_LABEL[mode]}
                  </label>
                  <div className="relative">
                    <span aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-muted">
                      $
                    </span>
                    <Input ref={priceRef} id="ci-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0.00" autoComplete="off" className={cx(big, "pl-9 tabular")} aria-invalid={tried && !(priceNum > 0)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ci-qty" className="text-lg font-semibold">
                    {QTY_LABEL[mode]}
                  </label>
                  <Input
                    id="ci-qty"
                    inputMode={mode === "pieza" ? "numeric" : "decimal"}
                    value={qty}
                    onChange={(e) => setQty(mode === "pieza" ? e.target.value.replace(/\D/g, "") : e.target.value.replace(/[^\d.,]/g, ""))}
                    autoComplete="off"
                    className={cx(big, "text-center tabular")}
                  />
                </div>
              </div>

              <div className="flex items-baseline justify-between rounded-2xl bg-default px-4 py-3" aria-live="polite">
                <span className="text-lg font-semibold">Importe</span>
                <span className="font-display text-3xl tabular">{formatMoney(priced?.subtotal ?? 0)}</span>
              </div>
              {tried && error && <Alert>{error}</Alert>}
            </Modal.Body>
            <Modal.Footer className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose} className="min-h-14 flex-1 !text-lg">
                Cancelar
              </Button>
              <Button type="submit" className="min-h-14 flex-[2] !text-lg">
                <Icon name={initial ? "check" : "plus"} className="size-5" /> {initial ? "Guardar cambio" : "Agregar a la venta"}
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
