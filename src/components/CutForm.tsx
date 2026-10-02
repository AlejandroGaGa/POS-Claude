"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, round2 } from "@/lib/pricing";
import { Alert, Button, Field, FieldGrid, FormActions, Input, Section, Select, Textarea, cx } from "./ui";
import { AnimatedNumber } from "./motion";

const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];

/** Captura del corte: conteo por denominación (opcional), retiro y diferencia en vivo. */
export default function CutForm({ expected }: { expected: number }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [manual, setManual] = useState("");
  const [withdrawn, setWithdrawn] = useState("");
  const [withdrawTo, setWithdrawTo] = useState<"fuera" | "chica">("fuera");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const byDenoms = round2(DENOMS.reduce((a, d) => a + d * (Number(counts[d] || 0) || 0), 0));
  const usingDenoms = DENOMS.some((d) => counts[d]);
  const counted = usingDenoms ? byDenoms : Number(manual.replace(",", ".")) || 0;
  const diff = round2(counted - expected);
  const w = Number(withdrawn.replace(",", ".")) || 0;
  const left = round2(counted - w);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!usingDenoms && manual === "") return setError("Captura el efectivo contado.");
    if (w > counted) return setError("No puedes retirar más de lo contado.");
    if (Math.abs(diff) >= 0.01 && !notes.trim() && !confirm(`Hay una diferencia de ${formatMoney(diff)}. ¿Guardar el corte así?`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/cash/cut", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counted, withdrawn: w, withdrawTo, notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error || "No se pudo guardar el corte.");
    }
    router.push(`/cortes/${data.id}?nuevo=1`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Section title="Cuenta el efectivo" description="Por denominación (se suma solo) o escribe el total.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
          {DENOMS.map((d) => (
            <Field key={d} label={d >= 20 ? `Billete ${formatMoney(d).replace(".00", "")}` : `Moneda ${formatMoney(d).replace(".00", "")}`} htmlFor={`den-${d}`}>
              <Input id={`den-${d}`} inputMode="numeric" value={counts[d] ?? ""} onChange={(e) => setCounts((c) => ({ ...c, [d]: e.target.value.replace(/\D/g, "") }))} placeholder="0" />
            </Field>
          ))}
        </div>
        {!usingDenoms && (
          <div className="mt-4 max-w-xs">
            <Field label="…o total contado" htmlFor="cut-manual">
              <Input id="cut-manual" inputMode="decimal" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="0.00" className="text-lg font-semibold" />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Resultado">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <dl className="flex flex-col gap-2 rounded-2xl bg-default/60 p-4 tabular">
            <div className="flex justify-between text-sm">
              <dt className="text-muted">Debe haber</dt>
              <dd>{formatMoney(expected)}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted">Contado</dt>
              <dd className="font-semibold">{formatMoney(counted)}</dd>
            </div>
            <div className={cx("flex items-baseline justify-between border-t border-separator pt-2", Math.abs(diff) < 0.01 ? "text-ok" : diff < 0 ? "text-bad" : "text-warn")}>
              <dt className="font-semibold">{Math.abs(diff) < 0.01 ? "Cuadra" : diff < 0 ? "Faltante" : "Sobrante"}</dt>
              <dd className="font-display text-3xl">
                <AnimatedNumber value={Math.abs(diff)} />
              </dd>
            </div>
          </dl>
          <FieldGrid cols={2}>
            <Field label="Se retira" htmlFor="cut-w" hint={`Queda de fondo: ${formatMoney(Math.max(0, left))}`}>
              <Input id="cut-w" inputMode="decimal" value={withdrawn} onChange={(e) => setWithdrawn(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="El retiro va a" htmlFor="cut-to">
              <Select id="cut-to" value={withdrawTo} onChange={(e) => setWithdrawTo(e.target.value as "fuera" | "chica")}>
                <option value="fuera">Fuera de caja (dueño / banco)</option>
                <option value="chica">Caja chica</option>
              </Select>
            </Field>
            <Field label="Notas" htmlFor="cut-notes" className="sm:col-span-2" hint="Explica cualquier diferencia">
              <Textarea id="cut-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="min-h-11" />
            </Field>
          </FieldGrid>
        </div>
      </Section>

      <FormActions status={error ? <Alert>{error}</Alert> : null}>
        <Button type="submit" loading={busy} className="w-full sm:w-auto sm:min-w-48">
          Cerrar corte
        </Button>
      </FormActions>
    </form>
  );
}
