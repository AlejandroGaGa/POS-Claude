"use client";
import { useEffect, useMemo, useState } from "react";
import { Label, Modal, NumberField } from "@heroui/react";
import {
  availableModes,
  DEFAULT_MIN_CUT_M,
  formatMoney,
  formatM,
  formatNumber,
  m2Rate,
  MODE_LABELS,
  priceLine,
  type CustomerType,
  type LineInput,
  type PricedLine,
  type ProductPricing,
  type SaleMode,
} from "@/lib/pricing";
import type { ProductJSON } from "@/lib/types";
import { motion } from "framer-motion";
import { AnimatedNumber, PILL_SPRING } from "../motion";
import { Alert, Button, Field, Input, cx } from "../ui";

export interface CartLine {
  key: string;
  product: ProductJSON;
  input: LineInput;
  priced: PricedLine;
}

interface Props {
  /** Variantes del producto elegido (un solo elemento si no tiene colores). */
  variants: ProductJSON[] | null;
  initial?: CartLine | null;
  customerType: CustomerType;
  onClose: () => void;
  onConfirm: (line: CartLine) => void;
}

/** Convierte texto capturado a número (acepta coma decimal). */
function n(v: string): number {
  if (v.trim() === "") return NaN;
  return Number(v.replace(",", "."));
}

/** Teclas que meterían decimales o signos en una cantidad de piezas. */
const NON_INTEGER_KEYS = new Set([".", ",", "e", "E", "-", "+"]);

const cm = (m?: number) => (m ? String(Math.round(m * 1000) / 10) : "");
const hasPrice = (p: ProductJSON) => availableModes(p as ProductPricing).length > 0;

export default function AddItemDialog({ variants, initial, customerType, onClose, onConfirm }: Props) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const product = useMemo(() => variants?.find((v) => v._id === variantId) ?? null, [variants, variantId]);
  const modes = useMemo(() => (product ? availableModes(product as ProductPricing) : []), [product]);
  const [mode, setMode] = useState<SaleMode | null>(null);
  const [qty, setQty] = useState("1");
  const [barLen, setBarLen] = useState<number | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [lenCm, setLenCm] = useState("");
  const [wCm, setWCm] = useState("");
  const [hCm, setHCm] = useState("");

  // Al abrir: variante inicial (la del renglón que se edita, o la primera con precio).
  useEffect(() => {
    if (!variants) return;
    setVariantId(initial?.product._id ?? (variants.find(hasPrice) ?? variants[0])._id);
    setQty(initial ? String(initial.input.qty) : "1");
    setLenCm(cm(initial?.input.mode === "tramo" ? initial.input.lengthM : undefined));
    setWCm(cm(initial?.input.mode === "m2" ? initial.input.widthM : undefined));
    setHCm(cm(initial?.input.mode === "m2" ? initial.input.heightM : undefined));
  }, [variants, initial]);

  // Al cambiar de variante: conservar la forma de venta si existe en la nueva.
  useEffect(() => {
    if (!product) return;
    const i = initial?.product._id === product._id ? initial.input : null;
    setMode((m) => (i?.mode && modes.includes(i.mode) ? i.mode : m && modes.includes(m) ? m : (modes[0] ?? null)));
    const bars = product.bars ?? [];
    setBarLen((b) => i?.barLengthM ?? (b && bars.some((x) => x.lengthM === b) ? b : (bars.find((x) => x.price > 0)?.lengthM ?? null)));
    const sheets = product.sheets ?? [];
    const si = i?.mode === "hoja" ? sheets.findIndex((s) => s.widthM === i.widthM && s.heightM === i.heightM) : -1;
    setSheetIdx(si >= 0 ? si : Math.max(0, sheets.findIndex((s) => s.price > 0)));
  }, [product, modes, initial]);

  const sheet = product?.sheets?.[sheetIdx];
  const input: LineInput | null = mode
    ? {
        mode,
        qty: n(qty),
        ...(mode === "tira" && barLen ? { barLengthM: barLen } : {}),
        ...(mode === "tramo" ? { lengthM: n(lenCm) / 100 } : {}),
        ...(mode === "m2" ? { widthM: n(wCm) / 100, heightM: n(hCm) / 100 } : {}),
        ...(mode === "hoja" && sheet ? { widthM: sheet.widthM, heightM: sheet.heightM } : {}),
      }
    : null;

  let priced: PricedLine | null = null;
  let error = "";
  if (product && input) {
    try {
      priced = priceLine(product as ProductPricing, input, { customerType });
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const touched = qty !== "" && (mode !== "tramo" || lenCm !== "") && (mode !== "m2" || (wCm !== "" && hCm !== ""));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product || !input || !priced) return;
    onConfirm({ key: initial?.key ?? crypto.randomUUID(), product, input, priced });
  }

  const qtyLabel: Record<SaleMode, string> = {
    pieza: `Cantidad (${product?.unitLabel || "pza"})`,
    kg: "Kilos",
    metro: "Metros",
    tira: "Número de tiras",
    tramo: "Número de tramos",
    hoja: "Número de hojas",
    m2: "Número de piezas",
  };
  const decimalQty = mode === "kg" || mode === "metro";

  // Si se cambia de kilos/metros a una forma por pieza, la cantidad se vuelve entera (2.5 kg → 3 piezas).
  useEffect(() => {
    if (decimalQty || qty === "") return;
    const v = n(qty);
    if (Number.isFinite(v) && !Number.isInteger(v)) setQty(String(Math.max(1, Math.round(v))));
  }, [decimalQty, qty]);
  const minCm = Math.round((product?.minCutM || DEFAULT_MIN_CUT_M) * 100);
  const title = variants && variants.length > 1 ? variants[0].group || product?.name : product?.name;
  const choice = (selected: boolean) =>
    cx(
      "relative flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border px-2 py-1 text-center transition-[color,border-color,transform] duration-150 active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus [&>span]:relative",
      selected ? "border-accent text-accent-foreground" : "border-border bg-surface hover:bg-surface-secondary",
    );

  return (
    <Modal.Backdrop isOpen={!!variants} onOpenChange={(o) => !o && onClose()}>
      <Modal.Container placement="auto" scroll="inside">
        <Modal.Dialog aria-labelledby="add-item-title" className="w-full p-0 sm:max-w-lg">
      {product && variants && (
        <form onSubmit={submit} className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line p-4">
            <div className="min-w-0">
              <p className="text-sm text-muted">
                {product.code} · {product.category}
                {product.line ? ` · ${product.line}` : ""}
              </p>
              <h2 id="add-item-title" className="font-display text-2xl">
                {title}
              </h2>
              {variants.length === 1 && product.color && <p className="text-sm text-muted">{product.color}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl hover:bg-surface-2">
              ×
            </button>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            {variants.length > 1 && (
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Color / acabado</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {variants.map((v) => {
                    const priced = hasPrice(v);
                    return (
                      <label key={v._id} className={cx(choice(variantId === v._id), !priced && "cursor-not-allowed opacity-60")}>
                        <input type="radio" name="variant" checked={variantId === v._id} disabled={!priced} onChange={() => setVariantId(v._id)} className="sr-only" />
                        {variantId === v._id && <motion.i layoutId="dlg-color" transition={PILL_SPRING} className="absolute -inset-px rounded-xl bg-accent" />}
                        <span className="font-semibold">{v.color || v.name}</span>
                        {!priced && <span className="text-sm">Sin precio</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {modes.length === 0 && <Alert>Este producto no tiene precio capturado. Pide al encargado que lo actualice.</Alert>}

            {modes.length > 1 && (
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">¿Cómo lo vendes?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {modes.map((m) => (
                    <label key={m} className={cx(choice(mode === m), "font-semibold")}>
                      <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                      {mode === m && <motion.i layoutId="dlg-mode" transition={PILL_SPRING} className="absolute -inset-px rounded-xl bg-accent" />}
                      <span>{MODE_LABELS[m]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {mode === "tira" && (
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Largo de la tira</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(product.bars ?? [])
                    .filter((b) => b.price > 0)
                    .map((b) => (
                      <label key={b.lengthM} className={choice(barLen === b.lengthM)}>
                        <input type="radio" name="bar" checked={barLen === b.lengthM} onChange={() => setBarLen(b.lengthM)} className="sr-only" />
                        {barLen === b.lengthM && <motion.i layoutId="dlg-bar" transition={PILL_SPRING} className="absolute -inset-px rounded-xl bg-accent" />}
                        <span className="font-bold">{formatM(b.lengthM)} m</span>
                        <span className="text-sm tabular">{formatMoney(b.price)}</span>
                      </label>
                    ))}
                </div>
              </fieldset>
            )}

            {mode === "hoja" && (product.sheets ?? []).filter((s) => s.price > 0).length > 1 && (
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Tamaño de la hoja</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(product.sheets ?? []).map((s, i) =>
                    s.price > 0 ? (
                      <label key={i} className={choice(sheetIdx === i)}>
                        <input type="radio" name="sheet" checked={sheetIdx === i} onChange={() => setSheetIdx(i)} className="sr-only" />
                        {sheetIdx === i && <motion.i layoutId="dlg-sheet" transition={PILL_SPRING} className="absolute -inset-px rounded-xl bg-accent" />}
                        <span className="font-bold">
                          {formatM(s.widthM)} × {formatM(s.heightM)}
                        </span>
                        <span className="text-sm tabular">{formatMoney(s.price)}</span>
                      </label>
                    ) : null,
                  )}
                </div>
              </fieldset>
            )}

            {mode === "tramo" && (
              <Field label="Largo del tramo (cm)" htmlFor="len" hint={`Mínimo ${minCm} cm · ${formatMoney(product.pricePerMeter ?? 0)} por metro`}>
                <Input id="len" inputMode="decimal" value={lenCm} onChange={(e) => setLenCm(e.target.value)} placeholder={`ej. ${minCm + 25}`} autoFocus required />
              </Field>
            )}

            {mode === "m2" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Base (cm)" htmlFor="w">
                  <Input id="w" inputMode="decimal" value={wCm} onChange={(e) => setWCm(e.target.value)} placeholder="ej. 80" autoFocus required />
                </Field>
                <Field label="Altura (cm)" htmlFor="h">
                  <Input id="h" inputMode="decimal" value={hCm} onChange={(e) => setHCm(e.target.value)} placeholder="ej. 120" required />
                </Field>
                <p className="col-span-2 text-sm text-muted">
                  {formatMoney(m2Rate(product as ProductPricing, customerType))} por m² ({customerType === "vidriero" ? "vidriero" : "particular"})
                </p>
              </div>
            )}

            {mode && (
              <Field label={qtyLabel[mode]} htmlFor="qty" hint={decimalQty ? "Puedes usar decimales, ej. 2.5" : "Solo números enteros"}>
                <NumberField
                  aria-label={qtyLabel[mode]}
                  value={Number.isFinite(n(qty)) ? n(qty) : NaN}
                  onChange={(v) => setQty(Number.isNaN(v) ? "" : String(decimalQty ? v : Math.max(1, Math.round(v))))}
                  minValue={decimalQty ? 0.001 : 1}
                  step={decimalQty ? 0.5 : 1}
                  formatOptions={{ maximumFractionDigits: decimalQty ? 3 : 0 }}
                  className="w-full"
                >
                  <NumberField.Group className="h-12 rounded-xl">
                    <NumberField.DecrementButton aria-label="Restar" className="w-12" />
                    <NumberField.Input
                      id="qty"
                      inputMode={decimalQty ? "decimal" : "numeric"}
                      onKeyDown={(e) => {
                        // Piezas cerradas (pieza, tira, tramo, hoja, corte de vidrio): solo números enteros.
                        if (!decimalQty && NON_INTEGER_KEYS.has(e.key)) e.preventDefault();
                      }}
                      onPaste={(e) => {
                        if (!decimalQty && /[^\d\s]/.test(e.clipboardData.getData("text"))) e.preventDefault();
                      }}
                      className="text-center text-lg font-semibold"
                      autoFocus={mode !== "tramo" && mode !== "m2" && variants.length === 1}
                    />
                    <NumberField.IncrementButton aria-label="Sumar" className="w-12" />
                  </NumberField.Group>
                </NumberField>
              </Field>
            )}

            {touched && error && <Alert>{error}</Alert>}

            {priced && (
              <div className="rounded-lg bg-surface-2 p-3" aria-live="polite">
                <p className="text-sm text-muted">
                  {product.color ? `${product.color} · ` : ""}
                  {priced.detail}
                </p>
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="tabular">
                    {formatNumber(priced.qty)} × {formatMoney(priced.unitPrice)}
                  </span>
                  <AnimatedNumber value={priced.subtotal} className="font-display text-3xl tabular" />
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={!priced} className="flex-[2]">
              {initial ? "Guardar cambio" : "Agregar"}
            </Button>
          </div>
        </form>
      )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
