"use client";
import { useEffect, useMemo, useState } from "react";
import { availableModes, type CustomerType, type ProductPricing } from "@/lib/pricing";
import { priceSummary } from "@/lib/productSummary";
import type { ProductJSON } from "@/lib/types";
import AddItemDialog, { type CartLine } from "../pos/AddItemDialog";
import { Input, cx } from "../ui";
import Icon from "../Icon";

const hasPrice = (p: ProductJSON) => availableModes(p as ProductPricing).length > 0;

/** Junta variantes de color (mismo `group`) en una sola opción, como en el mostrador. */
function groupProducts(list: ProductJSON[]): ProductJSON[][] {
  const map = new Map<string, ProductJSON[]>();
  for (const p of list) {
    const k = p.group ? `g:${p.category}:${p.group}` : `p:${p._id}`;
    const arr = map.get(k);
    if (arr) arr.push(p);
    else map.set(k, [p]);
  }
  return [...map.values()];
}

/**
 * Buscador compacto del catálogo para agregar renglones (lo que se lleva en un cambio, o lo que
 * regresa en una devolución sin nota). Usa el mismo diálogo de captura que el mostrador.
 */
export default function ProductPicker({
  id,
  customerType,
  onAdd,
  placeholder = "Buscar producto por nombre o código…",
}: {
  id: string;
  customerType: CustomerType;
  onAdd: (line: CartLine) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductJSON[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [variants, setVariants] = useState<ProductJSON[] | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/products?${new URLSearchParams({ q })}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setResults(data.products);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message || "No se pudo buscar");
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const groups = useMemo(() => groupProducts(results).slice(0, 12), [results]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        Buscar producto
      </label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-10" autoComplete="off" />
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      {loading && <p className="text-sm text-muted">Buscando…</p>}
      {!loading && q.trim().length >= 2 && !groups.length && !error && <p className="text-sm text-muted">Sin resultados.</p>}
      {groups.length > 0 && (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-2xl border border-border p-1">
          {groups.map((g) => {
            const first = g.find(hasPrice) ?? g[0];
            const multi = g.length > 1;
            const ok = g.some(hasPrice);
            return (
              <li key={first._id}>
                <button
                  type="button"
                  disabled={!ok}
                  onClick={() => setVariants(g)}
                  className={cx(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus",
                    !ok && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{multi ? first.group : first.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {multi ? `${g.length} acabados` : first.code} · {first.category}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm tabular text-muted">{ok ? priceSummary(first)[0] : "Sin precio"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <AddItemDialog
        variants={variants}
        customerType={customerType}
        onClose={() => setVariants(null)}
        onConfirm={(line) => {
          onAdd(line);
          setVariants(null);
          setQ("");
        }}
      />
    </div>
  );
}
