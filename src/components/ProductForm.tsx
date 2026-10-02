"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UNIT_TYPE_LABELS, UNIT_TYPES, type UnitType } from "@/lib/pricing";
import type { ProductJSON } from "@/lib/types";
import { Alert, Button, Checkbox, Field, FieldGrid, FormActions, Input, Section, Select, Textarea } from "./ui";
import Icon from "./Icon";

type BarRow = { lengthM: string; price: string };
type SheetRow = { wCm: string; hCm: string; price: string };

const STD_BARS: BarRow[] = [{ lengthM: "6.10", price: "" }];
const STD_SHEETS: SheetRow[] = [{ wCm: "180", hCm: "260", price: "" }];

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export default function ProductForm({ product, categories }: { product?: ProductJSON; categories: string[] }) {
  const router = useRouter();
  const [unitType, setUnitType] = useState<UnitType>(product?.unitType ?? "pieza");
  const [bars, setBars] = useState<BarRow[]>(product?.bars?.length ? product.bars.map((b) => ({ lengthM: str(b.lengthM), price: str(b.price) })) : STD_BARS);
  const [sheets, setSheets] = useState<SheetRow[]>(
    product?.sheets?.length ? product.sheets.map((x) => ({ wCm: String(Math.round(x.widthM * 1000) / 10), hCm: String(Math.round(x.heightM * 1000) / 10), price: str(x.price) })) : STD_SHEETS,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setOk("");
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    const body = {
      code: g("code"),
      name: g("name"),
      group: g("group"),
      category: g("category"),
      line: g("line"),
      color: g("color"),
      unitType,
      unitLabel: g("unitLabel") || (unitType === "kg" ? "kg" : unitType === "metro" ? "m" : unitType === "perfil" ? "tira" : unitType === "vidrio" ? "hoja" : "pza"),
      price: ["pieza", "kg", "metro"].includes(unitType) ? num(g("price")) : null,
      pricePerMeter: unitType === "perfil" ? num(g("pricePerMeter")) : null,
      bars: unitType === "perfil" ? bars.filter((b) => b.lengthM.trim() && b.price.trim()).map((b) => ({ lengthM: num(b.lengthM), price: num(b.price) })) : [],
      minCutM: unitType === "perfil" ? (num(g("minCutCm")) ?? 50) / 100 : 0.5,
      pricePerM2: unitType === "vidrio" ? num(g("pricePerM2")) : null,
      pricePerM2Vidriero: unitType === "vidrio" ? num(g("pricePerM2Vidriero")) : null,
      sheets:
        unitType === "vidrio"
          ? sheets.filter((x) => x.price.trim()).map((x) => ({ widthM: (num(x.wCm) ?? 0) / 100, heightM: (num(x.hCm) ?? 0) / 100, price: num(x.price) }))
          : [],
      notes: g("notes"),
      active: f.get("active") === "on",
    };
    const hasPrice = body.price || body.pricePerMeter || body.bars.length || body.pricePerM2 || body.pricePerM2Vidriero || body.sheets.length;
    if (!hasPrice) return setError("Captura al menos un precio.");

    setSaving(true);
    const res = await fetch(product ? `/api/products/${product._id}` : "/api/products", {
      method: product ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error || "No se pudo guardar");
    if (product) {
      setOk("Cambios guardados.");
      router.refresh();
    } else router.push(`/productos/${data.product._id}?nuevo=1`);
  }

  async function remove() {
    if (!product || !confirm(`¿Dar de baja "${product.name}"? Ya no aparecerá en el mostrador.`)) return;
    const res = await fetch(`/api/products/${product._id}`, { method: "DELETE" });
    if (res.ok) router.push("/productos");
    else setError((await res.json()).error);
  }

  const rowCls = "grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_2.75rem] items-end gap-2";
  const sheetCls = "grid grid-cols-[minmax(0,5.5rem)_minmax(0,5.5rem)_minmax(0,1fr)_2.75rem] items-end gap-2";
  const trash = "flex size-11 shrink-0 items-center justify-center rounded-xl text-danger transition-colors hover:bg-danger-soft";
  const priceHelp: Record<UnitType, string> = {
    pieza: "Precio por pieza, juego, caja, rollo…",
    kg: "Se cobra kilos × precio.",
    metro: "Se cobra metros × precio.",
    perfil: "Tiras completas con su precio y tramos cobrados por metro.",
    vidrio: "Hojas completas y cortes a medida por m² (particular o vidriero).",
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Section title="Datos generales" description="Cómo aparece el producto en el mostrador y en la nota.">
        <FieldGrid>
          <Field label="Código *" htmlFor="code" hint="Único. Ej. PER-2C, CLA-6">
            <Input id="code" name="code" defaultValue={product?.code} required className="uppercase" />
          </Field>
          <Field label="Nombre *" htmlFor="name" className="xl:col-span-2">
            <Input id="name" name="name" defaultValue={product?.name} required />
          </Field>
          <Field label="Categoría *" htmlFor="category" hint="Ej. Aluminio, Vidrio, Herrajes">
            <Input id="category" name="category" defaultValue={product?.category} list="cats" required />
            <datalist id="cats">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Grupo (variantes)" htmlFor="group" hint='Igual en todos los colores, ej. Cabezal 2"'>
            <Input id="group" name="group" defaultValue={product?.group} />
          </Field>
          <Field label="¿Cómo se vende? *" htmlFor="unitType">
            <Select id="unitType" value={unitType} onChange={(e) => setUnitType(e.target.value as UnitType)}>
              {UNIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {UNIT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Línea / serie" htmlFor="line" hint='Ej. Línea 2", Serie 35'>
            <Input id="line" name="line" defaultValue={product?.line} />
          </Field>
          <Field label="Color / acabado" htmlFor="color">
            <Input id="color" name="color" defaultValue={product?.color} placeholder="Natural, blanco, negro…" />
          </Field>
        </FieldGrid>
      </Section>

      <Section title="Precios" description={priceHelp[unitType]}>
        {(unitType === "pieza" || unitType === "kg" || unitType === "metro") && (
          <FieldGrid>
            <Field label={unitType === "kg" ? "Precio por kilo *" : unitType === "metro" ? "Precio por metro *" : "Precio por unidad *"} htmlFor="price">
              <Input id="price" name="price" inputMode="decimal" defaultValue={str(product?.price)} required />
            </Field>
            {unitType === "pieza" && (
              <Field label="Unidad" htmlFor="unitLabel" hint="pza, juego, caja, rollo, par…">
                <Input id="unitLabel" name="unitLabel" defaultValue={product?.unitLabel ?? "pza"} />
              </Field>
            )}
          </FieldGrid>
        )}

        {unitType === "perfil" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-semibold">Tiras completas</legend>
              <ul className="flex flex-col gap-2">
                {bars.map((b, i) => (
                  <li key={i} className={rowCls}>
                    <Field label="Largo (m)" htmlFor={`bl-${i}`}>
                      <Input id={`bl-${i}`} inputMode="decimal" value={b.lengthM} onChange={(e) => setBars((bs) => bs.map((x, j) => (j === i ? { ...x, lengthM: e.target.value } : x)))} />
                    </Field>
                    <Field label="Precio tira" htmlFor={`bp-${i}`}>
                      <Input id={`bp-${i}`} inputMode="decimal" value={b.price} onChange={(e) => setBars((bs) => bs.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} placeholder="Vacío = no se vende" />
                    </Field>
                    <button type="button" aria-label={`Quitar tira ${b.lengthM} m`} onClick={() => setBars((bs) => bs.filter((_, j) => j !== i))} className={trash}>
                      <Icon name="trash" />
                    </button>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="ghost" className="mt-2 -ml-2" onClick={() => setBars((bs) => [...bs, { lengthM: "", price: "" }])}>
                <Icon name="plus" /> Agregar largo
              </Button>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-semibold">Tramos a la medida</legend>
              <FieldGrid cols={2}>
                <Field label="Precio por metro" htmlFor="pricePerMeter" hint="Largo del tramo × este precio">
                  <Input id="pricePerMeter" name="pricePerMeter" inputMode="decimal" defaultValue={str(product?.pricePerMeter)} />
                </Field>
                <Field label="Tramo mínimo (cm)" htmlFor="minCutCm">
                  <Input id="minCutCm" name="minCutCm" inputMode="decimal" defaultValue={String(Math.round((product?.minCutM ?? 0.5) * 100))} />
                </Field>
              </FieldGrid>
            </fieldset>
          </div>
        )}

        {unitType === "vidrio" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-semibold">Cortes a medida (m²)</legend>
              <FieldGrid cols={2}>
                <Field label="Particular" htmlFor="pricePerM2" hint="base × altura × precio">
                  <Input id="pricePerM2" name="pricePerM2" inputMode="decimal" defaultValue={str(product?.pricePerM2)} />
                </Field>
                <Field label="Vidriero" htmlFor="pricePerM2Vidriero" hint="Vacío = igual que particular">
                  <Input id="pricePerM2Vidriero" name="pricePerM2Vidriero" inputMode="decimal" defaultValue={str(product?.pricePerM2Vidriero)} />
                </Field>
              </FieldGrid>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-semibold">Hojas completas</legend>
              <ul className="flex flex-col gap-2">
                {sheets.map((x, i) => (
                  <li key={i} className={sheetCls}>
                    <Field label="Base (cm)" htmlFor={`sw-${i}`}>
                      <Input id={`sw-${i}`} inputMode="decimal" value={x.wCm} onChange={(e) => setSheets((ss) => ss.map((y, j) => (j === i ? { ...y, wCm: e.target.value } : y)))} />
                    </Field>
                    <Field label="Altura (cm)" htmlFor={`sh-${i}`}>
                      <Input id={`sh-${i}`} inputMode="decimal" value={x.hCm} onChange={(e) => setSheets((ss) => ss.map((y, j) => (j === i ? { ...y, hCm: e.target.value } : y)))} />
                    </Field>
                    <Field label="Precio hoja" htmlFor={`sp-${i}`}>
                      <Input id={`sp-${i}`} inputMode="decimal" value={x.price} onChange={(e) => setSheets((ss) => ss.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} placeholder="Vacío = no se vende" />
                    </Field>
                    <button type="button" aria-label={`Quitar hoja ${x.wCm}×${x.hCm}`} onClick={() => setSheets((ss) => ss.filter((_, j) => j !== i))} className={trash}>
                      <Icon name="trash" />
                    </button>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="ghost" className="mt-2 -ml-2" onClick={() => setSheets((ss) => [...ss, { wCm: "", hCm: "", price: "" }])}>
                <Icon name="plus" /> Agregar tamaño
              </Button>
            </fieldset>
          </div>
        )}
      </Section>

      <Section title="Otros">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <Field label="Notas internas" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={product?.notes} className="min-h-11" rows={2} />
          </Field>
          <div className="lg:pt-7">
            <Checkbox name="active" defaultChecked={product?.active ?? true} label="Activo" hint="Aparece en el mostrador" />
          </div>
        </div>
      </Section>

      <FormActions status={error ? <Alert>{error}</Alert> : ok ? <Alert tone="ok">{ok}</Alert> : null}>
        {product?.active && (
          <Button type="button" variant="secondary" className="flex-1 text-danger sm:flex-none" onClick={remove}>
            Dar de baja
          </Button>
        )}
        <Button type="submit" loading={saving} className="flex-1 sm:min-w-44 sm:flex-none">
          {product ? "Guardar cambios" : "Crear producto"}
        </Button>
      </FormActions>
    </form>
  );
}
