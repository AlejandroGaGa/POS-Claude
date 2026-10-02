"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  lineSignature,
  withUnitPrice,
  availableModes,
  computeTotals,
  CUSTOMER_LABELS,
  CUSTOMER_TYPES,
  formatMoney,
  formatNumber,
  MAX_COMMISSION_PCT,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  priceLine,
  paymentLine,
  round2,
  type CustomerType,
  type PaymentMethod,
  type ProductPricing,
} from "@/lib/pricing";
import { priceSummary } from "@/lib/productSummary";
import type { ProductJSON } from "@/lib/types";
import { Alert, Button, EmptyState, Field, Input, PageHeader, cx } from "../ui";
import { Sk, SkProductCards } from "../Skeleton";
import Link from "next/link";
import CustomerPicker, { type PickedCustomer } from "../CustomerPicker";
import { upsertLine } from "@/lib/cart";
import CustomerForm from "../CustomerForm";
import Icon, { type IconName } from "../Icon";
import { SearchField } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedNumber, BASE, FAST, PILL_SPRING, Stagger } from "../motion";

/** Número que "brinca" al cambiar (contador del carrito). */
function CountBump({ n }: { n: number }) {
  return (
    <motion.span key={n} initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={PILL_SPRING} className="inline-block tabular">
      {n}
    </motion.span>
  );
}
import AddItemDialog, { type CartLine } from "./AddItemDialog";

const CART_KEY = "hp_cart_v2";
const QUOTE_KEY = "hp_cart_quote_v1";
const CUSTOMER_KEY = "hp_cart_customer_v1";

const COLOR_ORDER = ["Blanco", "Natural", "Negro", "Champagne", "Nogal", "Natural brillante", "Bronce brillante", "Nogal cerezo"];
const colorRank = (c?: string) => {
  const i = COLOR_ORDER.indexOf(c ?? "");
  return i < 0 ? COLOR_ORDER.length : i;
};

/** Agrupa variantes (mismo `group`) en una sola tarjeta, respetando el orden de llegada; colores en el orden de la lista. */
function groupProducts(list: ProductJSON[]): ProductJSON[][] {
  const map = new Map<string, ProductJSON[]>();
  for (const p of list) {
    const k = p.group ? `g:${p.category}:${p.group}` : `p:${p._id}`;
    const arr = map.get(k);
    if (arr) arr.push(p);
    else map.set(k, [p]);
  }
  return [...map.values()].map((g) => (g.length > 1 ? [...g].sort((a, b) => colorRank(a.color) - colorRank(b.color)) : g));
}

const hasPrice = (p: ProductJSON) => availableModes(p as ProductPricing).length > 0;

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

/** Cotización que se está editando desde el mostrador (agregar / quitar productos). */
export interface EditQuote {
  id: string;
  folio: string;
  expired: boolean;
  validUntil: string | null;
  customerType: CustomerType;
  customerName: string;
  customerPhone: string;
  notes: string;
  paymentMethod: PaymentMethod | null;
  commissionPct: number;
  lines: CartLine[];
  /** Precio unitario cotizado por renglón (firma → precio); vacío si ya venció. */
  locked: Record<string, number>;
  /** Renglones cuyo producto ya no existe. */
  missing: number;
  customer: PickedCustomer | null;
}
type QuoteMeta = Omit<EditQuote, "lines" | "customerName" | "customerPhone" | "notes" | "paymentMethod" | "commissionPct" | "customer">;

function readQuote(): QuoteMeta | null {
  try {
    const raw = localStorage.getItem(QUOTE_KEY);
    return raw ? (JSON.parse(raw) as QuoteMeta) : null;
  } catch {
    return null;
  }
}

export interface CategoryInfo {
  name: string;
  count: number;
}

const CAT_ICON: Record<string, IconName> = { Aluminio: "box", Vidrio: "sparkles", Espejos: "sparkles", Tornillería: "tag", Jaladeras: "tag" };

export default function Pos({
  defaultPct,
  categories,
  editQuote,
  initialCustomer,
  canCredit = false,
}: {
  defaultPct: number;
  categories: CategoryInfo[];
  editQuote?: EditQuote | null;
  initialCustomer?: PickedCustomer | null;
  canCredit?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<ProductJSON[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [resPage, setResPage] = useState(1);
  const [resPages, setResPages] = useState(1);
  const [resTotal, setResTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dialogVariants, setDialogVariants] = useState<ProductJSON[] | null>(null);
  const [customerType, setCustomerType] = useState<CustomerType>("particular");
  const [editing, setEditing] = useState<CartLine | null>(null);

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [pct, setPct] = useState(String(defaultPct));
  const [cash, setCash] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [payNow, setPayNow] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState<"" | "venta" | "cotizacion">("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"productos" | "carrito">("productos");
  const searchRef = useRef<HTMLInputElement>(null);
  const [quote, setQuote] = useState<QuoteMeta | null>(null);

  // Carrito guardado en este navegador por si se recarga la página.
  // Si se abrió desde una cotización (?cotizacion=…), se carga esa cotización para editarla.
  useEffect(() => {
    if (editQuote) {
      const { lines, customerName: n, customerPhone: ph, notes: nt, paymentMethod: pm, commissionPct: cp, customer: cu, ...meta } = editQuote;
      setCart(lines);
      setCustomer(cu);
      setQuote(meta);
      setCustomerType(meta.customerType);
      setCustomerName(n);
      setCustomerPhone(ph);
      setNotes(nt);
      setMethod(pm);
      if (pm === "terminal" && cp) setPct(String(cp));
      setTab("carrito");
      router.replace("/mostrador", { scroll: false });
    } else {
      setCart(readCart());
      setQuote(readQuote());
      let saved: PickedCustomer | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "null");
      } catch {}
      const c = initialCustomer ?? saved;
      if (c) {
        setCustomer(c);
        setCustomerName(c.name);
        setCustomerPhone(c.phone ?? "");
        if (c.customerType) setCustomerType(c.customerType);
      }
      if (initialCustomer) router.replace("/mostrador", { scroll: false });
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      if (quote) localStorage.setItem(QUOTE_KEY, JSON.stringify(quote));
      else localStorage.removeItem(QUOTE_KEY);
      if (customer) localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
      else localStorage.removeItem(CUSTOMER_KEY);
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [cart, quote, customer, hydrated]);

  /** Respeta el precio cotizado si el renglón ya estaba en la cotización vigente (mismo producto, forma y medida). */
  const keepQuoted = useCallback(
    (l: CartLine, t: CustomerType): CartLine => {
      if (!quote || quote.expired || t !== quote.customerType) return l;
      const unit = quote.locked[lineSignature(l.product._id, l.input)];
      return unit === undefined ? l : { ...l, priced: withUnitPrice(l.priced, unit) };
    },
    [quote],
  );

  // Sin búsqueda ni categoría se muestran las categorías (navegación de un toque).
  const browsing = !q.trim() && !category;

  // Búsqueda con pequeño retraso mientras se escribe.
  useEffect(() => {
    if (!q.trim() && !category) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const params = new URLSearchParams({ q, category });
        const res = await fetch(`/api/products?${params}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setResults(data.products);
        setResPage(1);
        setResPages(data.pages ?? 1);
        setResTotal(data.total ?? data.products.length);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSearchError((e as Error).message || "No se pudo buscar");
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, category]);

  const groups = useMemo(() => groupProducts(results), [results]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ q, category, pagina: String(resPage + 1) });
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults((r) => [...r, ...data.products]);
      setResPage(data.page);
      setResPages(data.pages);
    } catch (e) {
      setSearchError((e as Error).message || "No se pudo cargar");
    } finally {
      setLoadingMore(false);
    }
  }

  // Al cambiar el tipo de cliente se recalculan los renglones (afecta el m² del vidrio).
  function changeCustomerType(t: CustomerType) {
    setCustomerType(t);
    setCart((c) =>
      c.map((l) => {
        try {
          return keepQuoted({ ...l, priced: priceLine(l.product as ProductPricing, l.input, { customerType: t }) }, t);
        } catch {
          return l;
        }
      }),
    );
  }

  /** Variantes del grupo de un producto (para editar un renglón con su selector de color). */
  function variantsOf(p: ProductJSON): ProductJSON[] {
    if (!p.group) return [p];
    const g = groups.find((arr) => arr.some((x) => x._id === p._id));
    return g ?? [p];
  }

  const pctNum = Number(pct.replace(",", "."));
  const totals = useMemo(() => {
    try {
      return computeTotals(cart.map((l) => l.priced), method, method === "terminal" ? pctNum : 0);
    } catch {
      return null;
    }
  }, [cart, method, pctNum]);
  const cashNum = Number(cash.replace(",", "."));
  const canPartial = !!customer?.preferential;
  const isPartial = canPartial && partial;
  const payNowNum = isPartial ? Math.max(0, Number(payNow.replace(",", ".")) || 0) : 0;
  const nowLine = useMemo(() => {
    if (!isPartial || !totals) return null;
    const amount = Math.min(payNowNum, totals.subtotal);
    if (amount <= 0) return { amount: 0, commissionAmount: 0, received: 0 };
    try {
      return paymentLine(amount, method ?? "efectivo", method === "terminal" ? pctNum : 0);
    } catch {
      return null;
    }
  }, [isPartial, totals, payNowNum, method, pctNum]);
  const dueNow = isPartial ? (nowLine?.received ?? 0) : (totals?.total ?? 0);
  const balanceLeft = isPartial && totals ? round2(totals.subtotal - Math.min(payNowNum, totals.subtotal)) : 0;
  const changeDue = method === "efectivo" && cash !== "" && totals ? round2(cashNum - dueNow) : null;

  function pickCustomer(c: PickedCustomer | null) {
    setCustomer(c);
    setCustomerName(c?.name ?? "");
    setCustomerPhone(c?.phone ?? "");
    if (!c?.preferential) setPartial(false);
    if (c?.customerType && c.customerType !== customerType) changeCustomerType(c.customerType);
  }

  // Renglón que acaba de recibir una cantidad sumada (se resalta un momento).
  const [bumped, setBumped] = useState<{ key: string; n: number } | null>(null);
  const [bumpMsg, setBumpMsg] = useState("");

  const confirmLine = useCallback(
    (raw: CartLine) => {
      const line = keepQuoted(raw, customerType);
      // Mismo producto, misma forma y medida: se suma al renglón existente en vez de duplicarlo.
      const reprice = (l: CartLine) => keepQuoted({ ...l, priced: priceLine(l.product as ProductPricing, l.input, { customerType }) }, customerType);
      const { cart: next, mergedInto } = upsertLine(cart, line, reprice);
      setCart(next);
      if (mergedInto) {
        setBumped((b) => ({ key: mergedInto, n: (b?.n ?? 0) + 1 }));
        const m = next.find((x) => x.key === mergedInto);
        if (m) setBumpMsg(`Se sumó a ${m.product.name}: ahora ${formatNumber(m.priced.qty)}.`);
      }
      setDialogVariants(null);
      setEditing(null);
      searchRef.current?.focus();
    },
    [keepQuoted, customerType, cart],
  );

  function resetSale() {
    setQuote(null);
    setCart([]);
    setMethod(null);
    setCustomerType("particular");
    setPct(String(defaultPct));
    setCash("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomer(null);
    setPartial(false);
    setPayNow("");
    setNotes("");
  }

  async function save(kind: "venta" | "cotizacion") {
    setError("");
    if (!cart.length) return setError("Agrega al menos un producto.");
    const creditOnly = kind === "venta" && isPartial && payNowNum === 0;
    if (kind === "venta" && !method && !creditOnly) return setError("Elige el método de pago.");
    if (kind === "venta" && isPartial && totals && payNowNum >= totals.subtotal) return setError("Si paga todo, desactiva «Pago parcial».");
    if (method === "terminal" && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > MAX_COMMISSION_PCT)) {
      return setError(`La comisión debe estar entre 0% y ${MAX_COMMISSION_PCT}%.`);
    }
    if (kind === "venta" && method === "efectivo" && cash !== "" && changeDue !== null && changeDue < 0) {
      return setError("El efectivo recibido es menor al total.");
    }
    setSaving(kind);
    if (quote) return saveQuote(kind);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          items: cart.map((l) => ({ productId: l.product._id, ...l.input })),
          paymentMethod: creditOnly ? null : method,
          customerType,
          commissionPct: method === "terminal" ? pctNum : 0,
          cashReceived: method === "efectivo" && cash !== "" ? cashNum : null,
          customerName,
          customerPhone,
          customerId: customer?._id ?? null,
          payNow: kind === "venta" && isPartial ? payNowNum : null,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      resetSale();
      router.push(`/notas/${data.id}?nuevo=1`);
    } catch (e) {
      setError((e as Error).message);
      setSaving("");
    }
  }

  /** Guarda los cambios en la cotización que se está editando y, si es venta, la cobra. */
  async function saveQuote(kind: "venta" | "cotizacion") {
    if (!quote) return;
    try {
      const res = await fetch(`/api/sales/${quote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ productId: l.product._id, ...l.input })),
          paymentMethod: method,
          customerType,
          commissionPct: method === "terminal" ? pctNum : 0,
          customerName,
          customerPhone,
          customerId: customer?._id ?? null,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la cotización");
      if (kind === "cotizacion") {
        const id = quote.id;
        resetSale();
        router.push(`/cotizaciones/${id}?editada=1`);
        return;
      }
      const conv = await fetch(`/api/sales/${quote.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: isPartial && payNowNum === 0 ? null : method,
          commissionPct: method === "terminal" ? pctNum : 0,
          cashReceived: method === "efectivo" && cash !== "" ? cashNum : null,
          payNow: isPartial ? payNowNum : null,
        }),
      });
      const cdata = await conv.json();
      if (!conv.ok) throw new Error(cdata.error || "No se pudo cobrar");
      resetSale();
      router.push(`/notas/${cdata.id}?nuevo=1`);
    } catch (e) {
      setError((e as Error).message);
      setSaving("");
    }
  }

  function discardQuote() {
    const id = quote?.id;
    resetSale();
    if (id) router.push(`/cotizaciones/${id}`);
  }

  const count = cart.length;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <PageHeader
          title={quote ? `Editando ${quote.folio}` : "Mostrador"}
          subtitle={quote ? "Agrega o quita productos y guarda los cambios en la misma cotización." : "Busca o elige una categoría, toca el producto y captura la medida."}
        >
          {/* Pestañas en celular */}
          <div role="tablist" aria-label="Vista" className="grid w-full grid-cols-2 gap-1 rounded-full bg-surface p-1 shadow-[var(--surface-shadow)] lg:hidden">
            {(["productos", "carrito"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cx("relative min-h-10 rounded-full font-semibold transition-colors", tab === t ? "text-accent-foreground" : "text-muted hover:text-foreground")}
              >
                {tab === t && <motion.span layoutId="pos-tab" transition={PILL_SPRING} className="absolute inset-0 rounded-full bg-accent" />}
                <span className="relative">{t === "productos" ? "Productos" : <>{quote ? "Cotización" : "Venta"} (<CountBump n={count} />)</>}</span>
              </button>
            ))}
          </div>
        </PageHeader>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-5">
      {/* Buscador y resultados */}
      <section aria-label="Productos" className={cx("flex min-w-0 flex-col gap-4", tab !== "productos" && "hidden lg:flex", count > 0 && "pb-20 lg:pb-0")}>
        <div className="sticky top-[var(--sticky-top)] z-10 -mx-3 -mt-2 flex flex-col gap-3 bg-background/85 px-3 pt-2 pb-3 backdrop-blur-md sm:mx-0 sm:px-0">
        <SearchField aria-label="Buscar producto" value={q} onChange={setQ} className="w-full">
          <SearchField.Group className="h-14 rounded-2xl bg-surface shadow-[var(--surface-shadow)]">
            <SearchField.SearchIcon className="ml-1 size-5" />
            <SearchField.Input ref={searchRef} placeholder="Buscar: cabezal 2, claro 6, bisagra…" className="text-base" autoComplete="off" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <div role="group" aria-label="Categorías" className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          {[{ name: "", count: 0 }, ...categories].map((c) => {
            const active = category === c.name;
            return (
              <button
                key={c.name || "_all"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c.name)}
                className={cx(
                  "relative min-h-10 shrink-0 rounded-full bg-surface px-4 text-sm font-semibold shadow-[var(--surface-shadow)] transition-[color,transform] duration-150 outline-none active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-focus",
                  active ? "text-accent-foreground" : "text-foreground hover:bg-surface-secondary",
                )}
              >
                {active && <motion.span layoutId="pos-cat" transition={PILL_SPRING} className="absolute inset-0 rounded-full bg-accent" />}
                <span className="relative">{c.name || "Todas"}</span>
              </button>
            );
          })}
        </div>
        </div>

        {browsing && (
          <Stagger as="ul" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" stagger={0.025}>
            {categories.map((c) => (
              <Fragment key={c.name}>
                <button
                  type="button"
                  onClick={() => setCategory(c.name)}
                  className="flex h-full min-h-24 w-full flex-col items-start justify-between gap-3 rounded-2xl bg-surface p-4 text-left shadow-[var(--surface-shadow)] outline-none transition hover:-translate-y-0.5 hover:shadow-[var(--overlay-shadow)] focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                    <Icon name={CAT_ICON[c.name] ?? "tag"} />
                  </span>
                  <span>
                    <span className="block font-semibold leading-tight">{c.name}</span>
                    <span className="text-sm text-muted">{c.count} producto(s)</span>
                  </span>
                </button>
              </Fragment>
            ))}
          </Stagger>
        )}

        {searchError && <Alert>{searchError}</Alert>}
        {!browsing && (
          <div className="flex min-h-5 items-center text-sm text-muted" aria-live="polite" aria-busy={loading}>
            {loading ? <Sk className="h-3.5 w-36" /> : `${resTotal} resultado(s)${resPages > 1 ? ` · mostrando ${results.length}` : ""}`}
          </div>
        )}

        {!browsing && loading && <SkProductCards n={6} />}
        {!browsing && !loading && !searchError && results.length === 0 && (
          <EmptyState icon="search" title="Sin coincidencias" className="bg-surface shadow-[var(--surface-shadow)]">
            Prueba con otra palabra, el código o quita la categoría.
          </EmptyState>
        )}

        <Stagger as="ul" key={`${q}|${category}|${groups.length}`} className={cx("grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3", loading && "hidden")} stagger={0.025} maxAnimated={12}>
          {groups.map((g) => {
            const first = g.find(hasPrice) ?? g[0];
            const multi = g.length > 1;
            const anyPrice = g.some(hasPrice);
            return (
              <Fragment key={first._id}>
                <button
                  onClick={() => {
                    setEditing(null);
                    setDialogVariants(g);
                  }}
                  className={cx(
                    "flex h-full min-h-11 w-full flex-col gap-1 rounded-2xl bg-surface p-4 text-left shadow-[var(--surface-shadow)] outline-none transition hover:-translate-y-0.5 hover:shadow-[var(--overlay-shadow)] focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.99]",
                    !anyPrice && "opacity-70",
                  )}
                >
                  <span className="text-sm text-muted">
                    {multi ? first.category : `${first.code} · ${first.category}`}
                    {first.line ? ` · ${first.line}` : ""}
                  </span>
                  <span className="font-semibold leading-snug">{multi ? first.group : first.name}</span>
                  {multi ? (
                    <span className="text-sm text-muted">
                      {g.length} acabados: {g.map((v) => v.color || v.name).join(", ")}
                    </span>
                  ) : (
                    first.color && <span className="text-sm text-muted">{first.color}</span>
                  )}
                  <span className="mt-auto pt-1 text-sm font-medium tabular">
                    {anyPrice ? (
                      <>
                        {multi && <span className="block text-muted">{first.color}:</span>}
                        {priceSummary(first).map((s) => (
                          <span key={s} className="block">
                            {s}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="block text-warn">Sin precio</span>
                    )}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </Stagger>
        {loadingMore && <SkProductCards n={4} />}
        {!browsing && !loading && resPage < resPages && (
          <Button variant="secondary" onClick={loadMore} loading={loadingMore} className="self-center">
            {`Cargar más (${resTotal - results.length} restantes)`}
          </Button>
        )}
      </section>

      {/* Carrito y cobro */}
      <section
        aria-label="Carrito"
        className={cx(
          "flex min-w-0 flex-col gap-4 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] lg:p-5 lg:sticky lg:top-[calc(var(--sticky-top)+0.25rem)] lg:max-h-[calc(100dvh-var(--sticky-top)-1rem)] lg:overflow-y-auto",
          tab !== "carrito" && "hidden lg:flex",
        )}
      >
        <p className="sr-only" aria-live="polite">
          {bumpMsg}
        </p>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl sm:text-2xl">{quote ? `Cotización ${quote.folio}` : "Venta actual"}</h2>
          {count > 0 && !quote && (
            <button onClick={() => setCart([])} className="min-h-10 rounded-full px-4 text-sm font-medium text-danger hover:bg-danger-soft">
              Vaciar
            </button>
          )}
        </div>

        {quote && (
          <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-3.5 text-sm text-accent-soft-foreground">
            <p>
              {quote.expired
                ? "Esta cotización ya venció: al guardar se recalcula con precios actuales y se renueva la vigencia."
                : "Los productos que ya estaban conservan su precio cotizado; los nuevos llevan el precio actual."}
            </p>
            {quote.missing > 0 && <p className="font-medium">{quote.missing} producto(s) ya no existen y se quitaron.</p>}
            <div className="flex flex-wrap gap-2">
              <Link href={`/cotizaciones/${quote.id}`} className="font-semibold underline-offset-4 hover:underline">
                Ver cotización
              </Link>
              <span aria-hidden>·</span>
              <button type="button" onClick={discardQuote} className="font-semibold underline-offset-4 hover:underline">
                Descartar cambios
              </button>
            </div>
          </div>
        )}

        {count === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-secondary p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface text-muted">
              <Icon name="cart" />
            </span>
            <p className="font-medium">Aún no hay productos</p>
            <p className="text-sm text-muted">Toca un producto de la lista para agregarlo.</p>
          </div>
        ) : (
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
            {cart.map((l) => (
              <motion.li
                key={l.key}
                layout
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: FAST }}
                transition={BASE}
                className="relative flex items-start gap-2 border-b border-separator py-3 last:border-b-0"
              >
                {bumped?.key === l.key && (
                  <motion.span
                    key={bumped.n}
                    aria-hidden
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                    className="pointer-events-none absolute -inset-x-2 inset-y-0.5 rounded-xl bg-accent-soft"
                  />
                )}
                <div className="relative min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{l.product.name}</p>
                  <p className="text-sm text-muted">{l.priced.detail}</p>
                  <p className="text-sm tabular">
                    {formatNumber(l.priced.qty)} × {formatMoney(l.priced.unitPrice)}
                  </p>
                </div>
                <p className="relative pt-0.5 font-semibold tabular">{formatMoney(l.priced.subtotal)}</p>
                <div className="relative flex flex-col">
                  <button
                    aria-label={`Editar ${l.product.name}`}
                    onClick={() => {
                      setEditing(l);
                      setDialogVariants(variantsOf(l.product));
                    }}
                    className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-default hover:text-foreground"
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    aria-label={`Quitar ${l.product.name}`}
                    onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}
                    className="flex size-10 items-center justify-center rounded-full text-danger hover:bg-danger-soft"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
          </ul>
        )}

        <div className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-3.5">
          <div className="flex items-center justify-between">
            <label htmlFor="c-pick" className="font-medium">
              Cliente
            </label>
            <span className="text-sm text-muted">{customer?.preferential ? "Preferencial" : "Opcional"}</span>
          </div>
          <CustomerPicker id="c-pick" value={customer} onPick={pickCustomer} onCreate={(n) => setNewCustomerName(n)} />
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-medium text-accent outline-none focus-visible:underline">
              <span className="group-open:hidden">+ Notas de la venta{notes ? ` (${notes.slice(0, 24)}…)` : ""}</span>
              <span className="hidden group-open:inline">Notas de la venta</span>
            </summary>
            <div className="mt-2">
              <Input id="c-notes" aria-label="Notas de la venta" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ej. entrega a domicilio" />
            </div>
          </details>
        </div>

        <CustomerForm
          open={newCustomerName !== null}
          onOpenChange={(o) => !o && setNewCustomerName(null)}
          canCredit={canCredit}
          initialName={newCustomerName ?? ""}
          onSaved={(c) => pickCustomer({ _id: c._id, name: c.name, phone: c.phone, customerType: c.customerType, preferential: c.preferential, creditLimit: c.creditLimit })}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-muted">Tipo de cliente</legend>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-default p-1">
            {CUSTOMER_TYPES.map((t) => (
              <label
                key={t}
                className={cx(
                  "relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-1 text-center text-[15px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
                  customerType === t ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {customerType === t && <motion.span layoutId="pos-ctype" transition={PILL_SPRING} className="absolute inset-0 rounded-xl bg-surface shadow-sm" />}
                <input type="radio" name="ctype" value={t} checked={customerType === t} onChange={() => changeCustomerType(t)} className="sr-only" />
                <span className="relative">{CUSTOMER_LABELS[t]}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted">Cambia el precio por m² del vidrio.</p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-muted">Método de pago</legend>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <label
                key={m}
                className={cx(
                  "relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-center text-sm font-semibold transition-[color,transform] duration-150 active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus [&>*:not(input)]:relative",
                  method === m ? "border-accent text-accent-foreground" : "border-border hover:bg-surface-secondary",
                )}
              >
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                {method === m && <motion.i layoutId="pos-pay" transition={PILL_SPRING} className="absolute -inset-px !absolute rounded-2xl bg-accent" />}
                <Icon name={m === "efectivo" ? "wallet" : m === "terminal" ? "card" : "cash"} className="size-5" />
                <span>{m === "terminal" ? "Terminal" : PAYMENT_LABELS[m]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {method === "terminal" && (
          <div className="rounded-2xl bg-warning-soft p-4 text-warning-soft-foreground">
            <Field label="Comisión por terminal (%)" htmlFor="pct">
              <Input id="pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} className="text-lg font-semibold" />
            </Field>
            <p className="mt-2 text-sm">Avísale al cliente que el pago con tarjeta lleva esta comisión sobre el total.</p>
          </div>
        )}

        {canPartial && (
          <div className="flex flex-col gap-3 rounded-2xl bg-accent-soft/60 p-3.5">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="text-sm">
                <span className="block font-semibold">Pago parcial</span>
                <span className="text-muted">Cliente preferencial: puede dejar saldo{customer?.creditLimit ? ` (límite ${formatMoney(customer.creditLimit)})` : ""}.</span>
              </span>
              <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="size-5 shrink-0 accent-[var(--accent)]" />
            </label>
            {partial && (
              <Field label="Paga hoy" htmlFor="paynow" hint={`Queda a deber ${formatMoney(balanceLeft)} · 0 = todo a crédito`}>
                <Input id="paynow" inputMode="decimal" value={payNow} onChange={(e) => setPayNow(e.target.value)} placeholder="0.00" className="text-lg font-semibold" />
              </Field>
            )}
          </div>
        )}

        {method === "efectivo" && (
          <Field label="Efectivo recibido (opcional)" htmlFor="cash">
            <Input id="cash" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0.00" />
          </Field>
        )}

        <div className="flex flex-col gap-3 max-lg:sticky max-lg:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-lg:-mx-4 max-lg:-mb-4 max-lg:rounded-b-3xl max-lg:bg-surface max-lg:px-4 max-lg:pb-4 max-lg:shadow-[0_-8px_16px_-12px_rgb(0_0_0/0.15)]">
        <dl className="flex flex-col gap-1.5 border-t border-dashed border-separator pt-4 tabular" aria-live="polite">
          <div className="flex justify-between text-muted">
            <dt>Subtotal</dt>
            <dd>{formatMoney(totals?.subtotal ?? 0)}</dd>
          </div>
          {method === "terminal" && !isPartial && (
            <div className="flex justify-between">
              <dt>Comisión terminal ({totals ? formatNumber(totals.commissionPct, 2) : "—"}%)</dt>
              <dd>{totals ? formatMoney(totals.commissionAmount) : "—"}</dd>
            </div>
          )}
          {isPartial ? (
            <>
              {method === "terminal" && nowLine && nowLine.commissionAmount > 0 && (
                <div className="flex justify-between">
                  <dt>Comisión sobre el pago</dt>
                  <dd>{formatMoney(nowLine.commissionAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-warn">
                <dt>Queda a deber</dt>
                <dd>{formatMoney(balanceLeft)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <dt className="text-lg font-semibold">Paga hoy</dt>
                <dd className="font-display text-3xl">
                  <AnimatedNumber value={dueNow} />
                </dd>
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between pt-1">
              <dt className="text-lg font-semibold">Total</dt>
              <dd className="font-display text-3xl">{totals ? <AnimatedNumber value={totals.total} /> : "—"}</dd>
            </div>
          )}
          {changeDue !== null && Number.isFinite(changeDue) && (
            <div className={cx("flex justify-between font-semibold", changeDue < 0 ? "text-bad" : "text-ok")}>
              <dt>{changeDue < 0 ? "Falta" : "Cambio"}</dt>
              <dd>{formatMoney(Math.abs(changeDue))}</dd>
            </div>
          )}
        </dl>

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => save("cotizacion")} loading={saving === "cotizacion"} disabled={!!saving || !count} className="flex-1">
            {quote ? "Guardar cambios" : "Guardar cotización"}
          </Button>
          <Button onClick={() => save("venta")} loading={saving === "venta"} disabled={!!saving || !count} className="min-h-12 flex-1 text-base">
            {quote ? "Cobrar cotización" : "Cobrar venta"}
          </Button>
        </div>
        </div>
      </section>

      {/* Barra inferior móvil con el total */}
      <AnimatePresence>
      {tab === "productos" && count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24, transition: FAST }}
          transition={PILL_SPRING}
          className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 lg:hidden"
        >
          <Button onClick={() => setTab("carrito")} className="min-h-14 w-full justify-between px-6 text-base shadow-[var(--overlay-shadow)]">
            <span>
              {quote ? "Ver cotización" : "Ver venta"} (<CountBump n={count} />)
            </span>
            <AnimatedNumber value={totals?.total ?? 0} className="tabular" />
          </Button>
        </motion.div>
      )}
      </AnimatePresence>

      </div>

      <AddItemDialog
        variants={dialogVariants}
        initial={editing}
        customerType={customerType}
        onClose={() => {
          setDialogVariants(null);
          setEditing(null);
        }}
        onConfirm={confirmLine}
      />
    </div>
  );
}
