"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/pricing";
import { fmtDate } from "@/lib/labels";
import { returnableQty } from "@/lib/returns";
import { Badge, Card, EmptyState, Input, btn, cx } from "../ui";
import Icon from "../Icon";

interface FoundSale {
  _id: string;
  folio: string;
  fromQuoteFolio?: string;
  createdAt: string;
  customer?: string | null;
  customerName?: string;
  customerPhone?: string;
  total: number;
  balance?: number;
  sellerName?: string;
  returnedTotal?: number;
  items: { name?: string; qty: number; returnedQty?: number }[];
}

function itemsText(s: FoundSale) {
  const names = [...new Set(s.items.map((i) => i.name).filter(Boolean))] as string[];
  const head = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${head} y ${names.length - 2} más` : head;
}

/**
 * Paso 1 de la devolución: encontrar la venta. Un solo buscador para todo — folio de venta
 * (V-123), de la cotización (C-45), de una devolución (D-7), nombre o teléfono del cliente
 * (registrado o capturado en mostrador) o el producto que trae.
 */
export default function ReturnLookup({ initialQ = "" }: { initialQ?: string }) {
  const [q, setQ] = useState(initialQ);
  const [sales, setSales] = useState<FoundSale[]>([]);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const t0 = q.trim();
    if (t0.length < 2) {
      setSales([]);
      setHint("");
      setSearched(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/returns/lookup?${new URLSearchParams({ q: t0 })}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSales(data.sales);
        setHint(data.hint || "");
        setSearched(true);
        const url = new URL(window.location.href);
        url.searchParams.set("q", t0);
        window.history.replaceState(null, "", url);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSales([]);
          setHint((e as Error).message || "No se pudo buscar.");
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <label htmlFor="ret-q" className="font-display text-lg font-medium sm:text-xl">
          ¿De qué venta es?
        </label>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          <Input
            id="ret-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Folio (V-123, C-45), cliente, teléfono o producto"
            className="h-14 pl-12 text-lg"
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <p className="text-sm text-muted">
          Sirve el folio de la nota o de la cotización, el nombre como se anotó en mostrador (sin importar acentos) o parte del teléfono.
        </p>
      </Card>

      {loading && <p className="px-1 text-sm text-muted">Buscando…</p>}

      {!loading && sales.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Ventas encontradas">
          {sales.map((s) => {
            const left = s.items.reduce((a, it) => a + returnableQty(it.qty, it.returnedQty), 0);
            const done = left <= 0;
            const body = (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold tabular">
                    {s.folio}
                    {s.fromQuoteFolio && <span className="ml-2 text-sm font-normal text-muted">de {s.fromQuoteFolio}</span>}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {(s.returnedTotal ?? 0) > 0 && <Badge tone={done ? "neutral" : "warn"}>{done ? "Ya se devolvió todo" : `Devuelto ${formatMoney(s.returnedTotal ?? 0)}`}</Badge>}
                    {(s.balance ?? 0) > 0 && <Badge tone="warn">Debe {formatMoney(s.balance ?? 0)}</Badge>}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 text-sm text-muted">
                    <p className="truncate text-base text-foreground">
                      {s.customerName || "Mostrador (sin nombre)"}
                      {s.customer ? "" : s.customerName ? " · no registrado" : ""}
                    </p>
                    {s.customerPhone && <p className="tabular">{s.customerPhone}</p>}
                    <p className="truncate">{itemsText(s)}</p>
                    <p>
                      {fmtDate(s.createdAt)}
                      {s.sellerName ? ` · ${s.sellerName}` : ""}
                    </p>
                  </div>
                  <span className="font-display text-xl tabular">{formatMoney(s.total)}</span>
                </div>
              </>
            );
            return (
              <li key={s._id}>
                {done ? (
                  <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4 opacity-60 shadow-[var(--surface-shadow)]">{body}</div>
                ) : (
                  <Link
                    href={`/devoluciones/nueva?venta=${s._id}`}
                    className={cx("flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-[var(--surface-shadow)] outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.99]")}
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && searched && !sales.length && (
        <Card>
          <EmptyState icon="search" title="Sin ventas">
            {hint}
          </EmptyState>
        </Card>
      )}
      {!loading && hint && sales.length > 0 && <p className="px-1 text-sm text-muted">{hint}</p>}

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">¿No trae nota o no aparece la venta?</p>
          <p className="text-sm text-muted">Regístrala sin nota: lo devuelto se toma a precio de lista actual.</p>
        </div>
        <Link href="/devoluciones/nueva?sinNota=1" className={btn("secondary", "shrink-0")}>
          <Icon name="doc" className="size-4" /> Devolución sin nota
        </Link>
      </Card>
    </div>
  );
}
