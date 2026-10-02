"use client";
import { useState } from "react";
import { formatMoney } from "@/lib/pricing";
import { Alert, Button, EmptyState, Field, Input, Section, Select } from "./ui";
import ChangesTable from "./ChangesTable";

interface Preview {
  total: number;
  affected: number;
  sample: { code: string; name: string; changes: { field: string; from: number; to: number }[] }[];
}

export default function BulkAdjust({ categories }: { categories: string[] }) {
  const [category, setCategory] = useState("");
  const [pct, setPct] = useState("");
  const [roundTo, setRoundTo] = useState("0.5");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(apply: boolean) {
    setError("");
    setDone("");
    setBusy(true);
    const res = await fetch("/api/products/bulk-adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category || null, pct: Number(pct.replace(",", ".")), roundTo: Number(roundTo), apply }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    if (apply) {
      setDone(`Se actualizaron ${data.affected} producto(s).`);
      setPreview(null);
    } else setPreview(data);
  }

  const pctNum = Number(pct.replace(",", "."));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <Section
        title="Ajuste"
        description="Aplica un porcentaje a todos los precios (pieza, kilo, metro, tiras, m² y hoja). Usa un número negativo para bajar."
        className="lg:sticky lg:top-[calc(var(--sticky-top)+0.75rem)]"
      >
        <div className="flex flex-col gap-4">
          <Field label="Categoría" htmlFor="cat">
            <Select id="cat" value={category} onChange={(e) => { setCategory(e.target.value); setPreview(null); }}>
              <option value="">Todo el catálogo</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Porcentaje" htmlFor="pct" hint="8 sube, −5 baja">
              <Input id="pct" inputMode="decimal" value={pct} onChange={(e) => { setPct(e.target.value); setPreview(null); }} placeholder="8" />
            </Field>
            <Field label="Redondear a" htmlFor="round">
              <Select id="round" value={roundTo} onChange={(e) => { setRoundTo(e.target.value); setPreview(null); }}>
                <option value="0">Centavos</option>
                <option value="0.5">$0.50</option>
                <option value="1">$1</option>
                <option value="5">$5</option>
                <option value="10">$10</option>
              </Select>
            </Field>
          </div>
          <Button onClick={() => send(false)} loading={busy && !preview} disabled={busy || !pct || !Number.isFinite(pctNum) || pctNum === 0}>
            Ver cómo quedaría
          </Button>
          {preview && (
            <Button onClick={() => send(true)} loading={busy} disabled={preview.affected === 0} variant="danger">
              {`Aplicar ${pctNum > 0 ? "+" : ""}${pctNum}% a ${preview.affected}`}
            </Button>
          )}
          {error && <Alert>{error}</Alert>}
          {done && <Alert tone="ok">{done}</Alert>}
        </div>
      </Section>

      <Section
        title="Vista previa"
        description={preview ? `Se modificarán ${preview.affected} de ${preview.total} producto(s).` : "Aquí verás el antes y después de cada precio antes de aplicarlo."}
      >
        {preview ? (
          <>
            <ChangesTable
              label="Cambios de precio"
              rows={preview.sample.flatMap((s) =>
                s.changes.map((c, i) => ({ key: `${s.code}-${i}`, product: i === 0 ? s.name : "", code: i === 0 ? s.code : undefined, field: c.field, from: formatMoney(c.from), to: formatMoney(c.to) })),
              )}
            />
            {preview.affected > preview.sample.length && <p className="mt-3 text-sm text-muted">Mostrando {preview.sample.length} de {preview.affected}.</p>}
          </>
        ) : (
          <EmptyState icon="tag" title="Sin vista previa todavía">
            Elige la categoría y el porcentaje, luego toca «Ver cómo quedaría».
          </EmptyState>
        )}
      </Section>
    </div>
  );
}
