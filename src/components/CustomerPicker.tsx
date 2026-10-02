"use client";
import { useEffect, useId, useRef, useState } from "react";
import { cx, inputCls } from "./ui";
import Icon from "./Icon";
import { Sk } from "./Skeleton";
import type { CustomerType } from "@/lib/pricing";

export interface PickedCustomer {
  _id: string;
  name: string;
  phone?: string;
  customerType?: CustomerType;
  preferential?: boolean;
  creditLimit?: number;
}

/**
 * Buscador de clientes (nombre o teléfono) con lista desplegable y teclado.
 * Si no hay coincidencia ofrece "Registrar «texto»".
 */
export default function CustomerPicker({
  id,
  value,
  onPick,
  onCreate,
  placeholder = "Buscar por nombre o teléfono…",
  autoFocus,
}: {
  id?: string;
  value: PickedCustomer | null;
  onPick: (c: PickedCustomer | null) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PickedCustomer[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers?limite=8&q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (res.ok) {
          setItems(data.customers.map((c: PickedCustomer) => ({ ...c, _id: String(c._id) })));
          setActive(0);
        }
      } catch {
        /* cancelado */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const canCreate = !!onCreate && q.trim().length >= 2;
  const total = items.length + (canCreate ? 1 : 0);

  function choose(i: number) {
    if (i < items.length) {
      onPick(items[i]);
      setQ("");
      setOpen(false);
    } else if (canCreate) {
      onCreate!(q.trim());
      setQ("");
      setOpen(false);
    }
  }

  if (value) {
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-xl bg-default px-3.5 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground">
          <Icon name="person" className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-semibold">{value.name}</p>
          <p className="truncate text-muted">
            {[value.phone, value.customerType === "vidriero" ? "Vidriero" : null, value.preferential ? "Preferencial" : null].filter(Boolean).join(" · ") || "Sin teléfono"}
          </p>
        </div>
        <button type="button" onClick={() => onPick(null)} className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-default-hover hover:text-foreground" aria-label="Quitar cliente">
          <Icon name="close" className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(total - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && open && total) {
            e.preventDefault();
            choose(active);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className={cx(inputCls, "pl-10")}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-2xl bg-overlay p-1.5 shadow-[var(--overlay-shadow)]">
          {items.map((c, i) => (
            <li
              key={c._id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onMouseEnter={() => setActive(i)}
              className={cx("flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm", i === active && "bg-default")}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block truncate text-muted">{c.phone || "Sin teléfono"}</span>
              </span>
              {c.preferential && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-foreground">Preferencial</span>}
            </li>
          ))}
          {canCreate && (
            <li
              role="option"
              aria-selected={active === items.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(items.length)}
              onMouseEnter={() => setActive(items.length)}
              className={cx("flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-accent", active === items.length && "bg-default")}
            >
              <Icon name="plus" className="size-4" /> Registrar «{q.trim()}»
            </li>
          )}
          {loading && !items.length &&
            [0, 1, 2].map((i) => (
              <li key={`sk-${i}`} aria-hidden className="flex flex-col gap-1.5 px-3 py-2.5">
                <Sk className="h-3.5 w-36" />
                <Sk className="h-3 w-24" />
              </li>
            ))}
          {!loading && !items.length && !canCreate && <li className="px-3 py-2.5 text-sm text-muted">{q.trim() ? "Sin coincidencias" : "Escribe un nombre o teléfono"}</li>}
        </ul>
      )}
    </div>
  );
}
