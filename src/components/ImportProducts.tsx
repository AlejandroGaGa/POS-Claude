"use client";
import { useRef, useState } from "react";
import { CSV_EXAMPLE, parseCsv, rowToProduct, type ImportRow } from "@/lib/csvImport";
import { formatMoney } from "@/lib/pricing";
import { Alert, Button, EmptyState, Field, Section, Textarea, btn } from "./ui";
import ChangesTable from "./ChangesTable";
import Icon from "./Icon";

interface Preview {
  creates: number;
  updates: number;
  priceChanges?: number;
  errors: { line: number; error: string }[];
  sample?: { code: string; name: string; changes: { field: string; from: unknown; to: unknown }[] }[];
  apply: boolean;
}

const fmt = (v: unknown) => (typeof v === "number" ? formatMoney(v) : v === null || v === undefined ? "—" : Array.isArray(v) ? v.map((b) => `${b.lengthM}m ${formatMoney(b.price)}`).join(", ") : typeof v === "object" ? formatMoney((v as { price: number }).price) : String(v));

export default function ImportProducts() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setText(await file.text());
    }
  }

  async function send(apply: boolean, parsed = rows) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/products/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parsed.filter((r) => r.data).map((r) => ({ line: r.line, data: r.data })), apply }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    if (apply && data.apply) {
      setDone(`Listo: ${data.creates} producto(s) nuevos y ${data.updates} actualizados.`);
      setPreview(null);
      setRows([]);
      setText("");
    } else setPreview({ ...data, errors: [...parsed.filter((r) => r.error).map((r) => ({ line: r.line, error: r.error! })), ...data.errors] });
  }

  function analyze() {
    setDone("");
    const parsed = parseCsv(text).map((r, i) => rowToProduct(r, i + 2));
    if (!parsed.length) return setError("No encontré renglones. Revisa que la primera fila tenga los encabezados.");
    setRows(parsed);
    send(false, parsed);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <Section title="1. Prepara tu archivo" description="Lo más fácil: descarga la lista actual en CSV, edítala en Excel y vuelve a subirla.">
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Usa un CSV (en Excel: <em>Guardar como → CSV</em>). Los productos se reconocen por <strong>código</strong>: si existe se actualiza, si no se crea.
            </p>
            <ul className="flex flex-col gap-1.5">
              <li className="rounded-xl bg-default/60 px-3 py-2">
                <strong>tipo</strong>: pieza, kg, metro, perfil o vidrio
              </li>
              <li className="rounded-xl bg-default/60 px-3 py-2">
                <strong>tiras</strong> (perfiles): <code>6:520|3.6:330|4.6:410</code> → largo m : precio
              </li>
              <li className="rounded-xl bg-default/60 px-3 py-2">
                <strong>hoja</strong> (vidrio): <code>1.80x2.60:2100</code> → base x altura m : precio
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <a href="/api/products/export" className={btn("secondary", "min-h-10")}>
                <Icon name="download" className="size-4" /> Descargar lista actual
              </a>
              <Button type="button" variant="ghost" className="min-h-10" onClick={() => setText(CSV_EXAMPLE)}>
                Usar el ejemplo
              </Button>
            </div>
          </div>
        </Section>

        <Section title="2. Sube o pega el contenido">
          <div className="flex flex-col gap-4">
            <div>
              <input ref={fileRef} id="file" type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="sr-only" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border px-4 py-4 text-left transition-colors hover:border-accent hover:bg-accent-soft/40 focus-visible:ring-2 focus-visible:ring-focus outline-none"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                  <Icon name="upload" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{fileName || "Elegir archivo CSV"}</span>
                  <span className="block text-sm text-muted">{fileName ? "Toca para cambiarlo" : "o pega el contenido abajo"}</span>
                </span>
              </button>
            </div>
            <Field label="Contenido" htmlFor="csv">
              <Textarea id="csv" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="font-mono text-sm" placeholder="codigo;nombre;categoria;tipo;precio…" />
            </Field>
            <Button onClick={analyze} loading={busy && !preview} disabled={!text.trim() || busy}>
              Revisar antes de importar
            </Button>
          </div>
        </Section>
      </div>

      <Section
        title="3. Revisa y confirma"
        description={preview ? `${preview.creates} nuevos · ${preview.updates} existentes (${preview.priceChanges ?? 0} con cambio de precio)` : "Antes de guardar verás qué se crea y qué precios cambian."}
        className="lg:sticky lg:top-[calc(var(--sticky-top)+0.75rem)]"
        actions={
          preview ? (
            <Button onClick={() => send(true)} loading={busy} disabled={preview.errors.length > 0 || preview.creates + preview.updates === 0}>
              {`Importar ${preview.creates + preview.updates}`}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3">
          {error && <Alert>{error}</Alert>}
          {done && <Alert tone="ok">{done}</Alert>}
          {preview ? (
            <>
              {preview.errors.length > 0 && (
                <Alert>
                  <p className="font-semibold">Corrige estos renglones antes de importar:</p>
                  <ul className="list-disc pl-5">
                    {preview.errors.slice(0, 30).map((e, i) => (
                      <li key={i}>{e.line ? `Renglón ${e.line}: ${e.error}` : e.error}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              {preview.sample?.length ? (
                <ChangesTable
                  label="Cambios de precio (muestra)"
                  rows={preview.sample.flatMap((s) =>
                    s.changes.map((c, i) => ({ key: `${s.code}-${i}`, product: i === 0 ? s.name : "", code: i === 0 ? s.code : undefined, field: c.field, from: fmt(c.from), to: fmt(c.to) })),
                  )}
                />
              ) : (
                <EmptyState icon="check" title="Sin cambios de precio">
                  Los productos existentes conservan su precio.
                </EmptyState>
              )}
            </>
          ) : (
            !done && (
              <EmptyState icon="upload" title="Aún no hay archivo revisado">
                Sube o pega tu lista y toca «Revisar antes de importar».
              </EmptyState>
            )
          )}
        </div>
      </Section>
    </div>
  );
}
