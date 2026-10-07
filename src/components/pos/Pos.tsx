"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  lineSignature,
  withUnitPrice,
  availableModes,
  computeTotals,
  CUSTOMER_LABELS,
  formatMoney,
  formatNumber,
  MAX_COMMISSION_PCT,
  priceLine,
  paymentLine,
  round2,
  type CustomerType,
  type PaymentMethod,
  type ProductPricing,
} from "@/lib/pricing";
import { priceSummary } from "@/lib/productSummary";
import type { ProductJSON } from "@/lib/types";
import { Alert, Button, EmptyState, PageHeader, cx } from "../ui";
import { Sk, SkProductCards } from "../Skeleton";
import Link from "next/link";
import type { PickedCustomer } from "../CustomerPicker";
import { upsertLine } from "@/lib/cart";
import CustomerForm from "../CustomerForm";
import Icon, { type IconName } from "../Icon";
import { Modal, SearchField } from "@heroui/react";
import CheckoutDialog from "./CheckoutDialog";
import CustomerDialog from "./CustomerDialog";
import AdjustDialog from "./AdjustDialog";
import { adjustLines } from "@/lib/adjust";
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
const ADJUST_KEY = "hp_cart_adjust_v1";

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

/** Formas de venta por pieza entera: en el carrito se cambian con botones − / +. */
const STEP_MODES = new Set(["pieza", "tira", "tramo", "hoja", "m2"]);

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
  /** Pesos de más repartidos (oculto) y descuento especial (%) de la cotización. */
  extraAmount: number;
  discountPct: number;
  /** Precio unitario cotizado por renglón (firma → precio); vacío si ya venció. */
  locked: Record<string, number>;
  /** Renglones cuyo producto ya no existe. */
  missing: number;
  customer: PickedCustomer | null;
}
type QuoteMeta = Omit<EditQuote, "lines" | "customerName" | "customerPhone" | "notes" | "paymentMethod" | "commissionPct" | "customer" | "extraAmount" | "discountPct">;

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
  const [checkout, setCheckout] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  /** Ajustes de precio: pesos de más repartidos (no se imprimen) y descuento especial (%). */
  const [extra, setExtra] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [adjOpen, setAdjOpen] = useState(false);

  // Carrito guardado en este navegador por si se recarga la página.
  // Si se abrió desde una cotización (?cotizacion=…), se carga esa cotización para editarla.
  useEffect(() => {
    if (editQuote) {
      const { lines, customerName: n, customerPhone: ph, notes: nt, paymentMethod: pm, commissionPct: cp, customer: cu, extraAmount: ea, discountPct: dp, ...meta } = editQuote;
      setCart(lines);
      setExtra(ea || 0);
      setDiscount(dp || 0);
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
      try {
        const a = JSON.parse(localStorage.getItem(ADJUST_KEY) || "null") as { extra?: number; discount?: number } | null;
        if (a) {
          setExtra(a.extra || 0);
          setDiscount(a.discount || 0);
        }
      } catch {}
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
      if (extra || discount) localStorage.setItem(ADJUST_KEY, JSON.stringify({ extra, discount }));
      else localStorage.removeItem(ADJUST_KEY);
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [cart, quote, customer, extra, discount, hydrated]);

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
  // Precios con el extra repartido y el descuento especial (lo mismo que recalcula el servidor).
  const adjusted = useMemo(() => adjustLines(cart.map((l) => l.priced), { extra, discountPct: discount }), [cart, extra, discount]);
  const totals = useMemo(() => {
    try {
      return computeTotals(adjusted.lines, method, method === "terminal" ? pctNum : 0);
    } catch {
      return null;
    }
  }, [adjusted, method, pctNum]);
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

  /** Suma o resta una pieza desde el carrito (respeta el precio cotizado si aplica). */
  function changeQty(l: CartLine, delta: number) {
    const qty = l.input.qty + delta;
    if (qty < 1) return;
    try {
      const input = { ...l.input, qty };
      const next = keepQuoted({ ...l, input, priced: priceLine(l.product as ProductPricing, input, { customerType }) }, customerType);
      setCart((c) => c.map((x) => (x.key === l.key ? next : x)));
    } catch {
      /* cantidad inválida: se deja igual */
    }
  }

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
    setExtra(0);
    setDiscount(0);
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
          extraAmount: extra || null,
          discountPct: discount,
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
          extraAmount: extra || null,
          discountPct: discount,
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
    <div className="mx-auto flex h-[calc(100dvh-var(--app-top)-var(--app-bottom)-0.25rem)] w-full max-w-[1400px] flex-col gap-2 lg:h-[calc(100dvh-1.5rem)] lg:gap-3">
        <PageHeader
          title={<span className="max-lg:sr-only">{quote ? `Editando ${quote.folio}` : "Mostrador"}</span>}
          subtitle={<span className="max-lg:hidden">{quote ? "Agrega o quita productos y guarda los cambios en la misma cotización." : "Busca o elige una categoría, toca el producto y captura la medida."}</span>}
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

      <div className="flex min-h-0 flex-1 flex-col pb-2 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-5 lg:pb-0 xl:grid-cols-[minmax(0,1fr)_460px]">
      {/* Buscador y resultados */}
      <section
        aria-label="Productos"
        className={cx("@container flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-1 pb-4 lg:h-full", tab !== "productos" && "hidden lg:flex", count > 0 && "pb-24 lg:pb-4")}
      >
        <div className="sticky top-0 z-10 flex flex-col gap-3 bg-background/90 pt-1 pb-3 backdrop-blur-md">
        <SearchField aria-label="Buscar producto" value={q} onChange={setQ} className="w-full">
          <SearchField.Group className="h-14 rounded-2xl bg-surface shadow-[var(--surface-shadow)]">
            <SearchField.SearchIcon className="ml-1 size-5" />
            <SearchField.Input ref={searchRef} placeholder="Buscar: cabezal 2, claro 6, bisagra…" className="text-base" autoComplete="off" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <div role="group" aria-label="Categorías" className="no-scrollbar flex gap-2 overflow-x-auto p-0.5">
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
          <Stagger as="ul" className="grid grid-cols-2 gap-3 @md:grid-cols-3 @2xl:grid-cols-4" stagger={0.025}>
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

        <Stagger as="ul" key={`${q}|${category}|${groups.length}`} className={cx("grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-3", loading && "hidden")} stagger={0.025} maxAnimated={12}>
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

      {/* Carrito: corto y con botones grandes. Cliente y cobro van en ventanas aparte. */}
      <section
        aria-label="Venta actual"
        className={cx(
          "flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] lg:h-full lg:p-5",
          tab !== "carrito" && "hidden lg:flex",
        )}
      >
        <p className="sr-only" aria-live="polite">
          {bumpMsg}
        </p>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl lg:text-2xl">
            {quote ? `Cotización ${quote.folio}` : "Venta actual"}
            {count > 0 && <span className="ml-2 text-lg text-muted">({count})</span>}
          </h2>
          {count > 0 && !quote && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-danger hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Icon name="trash" className="size-5" /> Vaciar
            </button>
          )}
        </div>

        {quote && (
          <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-3.5 text-base text-accent-soft-foreground">
            <p>
              {quote.expired
                ? "Esta cotización ya venció: al guardar se recalcula con precios actuales."
                : "Lo que ya estaba conserva su precio cotizado; lo nuevo lleva precio actual."}
            </p>
            {quote.missing > 0 && <p className="font-semibold">{quote.missing} producto(s) ya no existen y se quitaron.</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href={`/cotizaciones/${quote.id}`} className="link-text min-h-11 content-center font-semibold">
                Ver cotización
              </Link>
              <button type="button" onClick={discardQuote} className="link-text min-h-11 font-semibold">
                Descartar cambios
              </button>
            </div>
          </div>
        )}

        {/* Productos: esta es la única parte que se desplaza */}
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {count === 0 ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-2xl bg-surface-secondary p-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted">
                <Icon name="cart" className="size-7" />
              </span>
              <p className="text-lg font-semibold">Aún no hay productos</p>
              <p className="text-base text-muted">Busca un producto y tócalo para agregarlo.</p>
              <Button type="button" variant="secondary" onClick={() => { setTab("productos"); searchRef.current?.focus(); }} className="mt-1 min-h-12 text-base lg:hidden">
                <Icon name="search" className="size-5" /> Buscar productos
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {cart.map((l, i) => {
                  const stepper = STEP_MODES.has(l.input.mode);
                  const shown = adjusted.lines[i];
                  return (
                    <motion.li
                      key={l.key}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 24, transition: FAST }}
                      transition={BASE}
                      className="relative flex flex-col gap-3 rounded-2xl border border-border p-3"
                    >
                      {bumped?.key === l.key && (
                        <motion.span
                          key={bumped.n}
                          aria-hidden
                          initial={{ opacity: 0.9 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 1.1, ease: "easeOut" }}
                          className="pointer-events-none absolute inset-0 rounded-2xl bg-accent-soft"
                        />
                      )}
                      <div className="relative flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg leading-snug font-semibold">{l.product.name}</p>
                          <p className="text-base text-muted">
                            {l.priced.detail} · {formatMoney(shown?.shownUnitPrice ?? l.priced.unitPrice)} c/u
                          </p>
                        </div>
                        <p className="shrink-0 text-xl font-bold tabular">{formatMoney(shown?.shownSubtotal ?? l.priced.subtotal)}</p>
                      </div>
                      <div className="relative flex items-center gap-2">
                        {stepper ? (
                          <div className="flex items-center rounded-xl bg-default" role="group" aria-label={`Cantidad de ${l.product.name}`}>
                            <button
                              type="button"
                              onClick={() => changeQty(l, -1)}
                              disabled={l.input.qty <= 1}
                              aria-label={`Quitar uno de ${l.product.name}`}
                              className="flex size-12 items-center justify-center rounded-xl text-2xl font-bold hover:bg-default-hover focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 max-[380px]:size-11"
                            >
                              −
                            </button>
                            <span className="min-w-10 text-center text-xl font-bold tabular" aria-live="polite">
                              {formatNumber(l.priced.qty)}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeQty(l, 1)}
                              aria-label={`Agregar uno de ${l.product.name}`}
                              className="flex size-12 items-center justify-center rounded-xl text-2xl font-bold hover:bg-default-hover focus-visible:ring-2 focus-visible:ring-focus max-[380px]:size-11"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="min-h-12 content-center rounded-xl bg-default px-4 text-xl font-bold tabular">
                            {formatNumber(l.priced.qty)} {l.input.mode === "kg" ? "kg" : "m"}
                          </span>
                        )}
                        <div className="ml-auto flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(l);
                              setDialogVariants(variantsOf(l.product));
                            }}
                            aria-label={`Cambiar ${l.product.name}`}
                            className="flex min-h-12 min-w-16 flex-col items-center justify-center rounded-xl border border-border px-2 text-sm leading-tight font-semibold hover:bg-default focus-visible:ring-2 focus-visible:ring-focus min-[420px]:flex-row min-[420px]:gap-1.5 min-[420px]:text-base"
                          >
                            <Icon name="edit" className="size-5" /> Cambiar
                          </button>
                          <button
                            type="button"
                            onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}
                            aria-label={`Quitar ${l.product.name}`}
                            className="flex min-h-12 min-w-16 flex-col items-center justify-center rounded-xl border border-danger/40 px-2 text-sm leading-tight font-semibold text-danger hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-focus min-[420px]:flex-row min-[420px]:gap-1.5 min-[420px]:text-base"
                          >
                            <Icon name="trash" className="size-5" /> Quitar
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* Pie fijo: cliente, total y los dos botones */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-separator pt-3">
          <button
            type="button"
            onClick={() => setCustOpen(true)}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface-secondary px-4 py-1.5 text-left hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Icon name="person" className="size-6 shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-semibold">{customer?.name || "Cliente: Mostrador"}</span>
              <span className="block truncate text-base text-muted">
                {[CUSTOMER_LABELS[customerType], customer?.preferential ? "Preferencial" : "", notes ? `Nota: ${notes}` : ""].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-base font-semibold text-accent">{customer ? "Cambiar" : "Agregar"}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAdjOpen(true)}
              disabled={!count}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-base font-semibold hover:bg-default focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
            >
              <Icon name="calculator" className="size-5" /> Ajustar precio
            </button>
            {adjusted.extra > 0 && <span className="rounded-full bg-default px-3 py-1 text-sm font-medium tabular">Ajuste +{formatMoney(adjusted.extra)}</span>}
            {adjusted.discountAmount > 0 && (
              <span className="rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success-soft-foreground tabular">
                Descuento {formatNumber(adjusted.discountPct, 2)}% −{formatMoney(adjusted.discountAmount)}
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between" aria-live="polite">
            <span className="text-xl font-semibold">Total</span>
            <span className="font-display text-3xl tabular sm:text-4xl">
              <AnimatedNumber value={totals?.subtotal ?? 0} />
            </span>
          </div>

          {error && !checkout && <Alert>{error}</Alert>}

          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
            <Button
              variant="secondary"
              onClick={() => save("cotizacion")}
              loading={saving === "cotizacion"}
              disabled={!!saving || !count}
              className="min-h-16 !text-lg"
            >
              <Icon name="doc" className="size-5" /> {quote ? "Guardar cambios" : "Cotizar"}
            </Button>
            <Button
              onClick={() => {
                setError("");
                setCheckout(true);
              }}
              disabled={!!saving || !count}
              className="min-h-16 !text-xl"
            >
              <Icon name="coin" className="size-6" /> Cobrar
            </Button>
          </div>
        </div>
      </section>

      <CheckoutDialog
        open={checkout}
        onClose={() => setCheckout(false)}
        isQuote={!!quote}
        totals={totals}
        method={method}
        setMethod={setMethod}
        pct={pct}
        setPct={setPct}
        cash={cash}
        setCash={setCash}
        canPartial={canPartial}
        creditLimit={customer?.creditLimit}
        partial={partial}
        setPartial={setPartial}
        payNow={payNow}
        setPayNow={setPayNow}
        balanceLeft={balanceLeft}
        dueNow={dueNow}
        commissionNow={isPartial ? (nowLine?.commissionAmount ?? 0) : (totals?.commissionAmount ?? 0)}
        changeDue={changeDue}
        error={error}
        saving={saving === "venta"}
        onConfirm={() => save("venta")}
      />

      <AdjustDialog
        open={adjOpen}
        onClose={() => setAdjOpen(false)}
        cart={cart}
        extra={extra}
        discount={discount}
        onApply={(e, d) => {
          setExtra(e);
          setDiscount(d);
        }}
      />

      <CustomerDialog
        open={custOpen}
        onClose={() => setCustOpen(false)}
        customer={customer}
        onPick={pickCustomer}
        onMoreData={(n) => {
          setCustOpen(false);
          setNewCustomerName(n);
        }}
        customerType={customerType}
        onType={changeCustomerType}
        notes={notes}
        setNotes={setNotes}
      />

      <CustomerForm
        open={newCustomerName !== null}
        onOpenChange={(o) => !o && setNewCustomerName(null)}
        canCredit={canCredit}
        initialName={newCustomerName ?? ""}
        onSaved={(c) => pickCustomer({ _id: c._id, name: c.name, phone: c.phone, customerType: c.customerType, preferential: c.preferential, creditLimit: c.creditLimit })}
      />

      <Modal.Backdrop isOpen={confirmClear} onOpenChange={setConfirmClear}>
        <Modal.Container placement="center">
          <Modal.Dialog aria-labelledby="clear-title" className="w-full sm:max-w-sm">
            <Modal.Header>
              <Modal.Heading id="clear-title" className="text-xl">
                ¿Vaciar la venta?
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-base">Se quitan los {count} producto(s) del carrito.</p>
            </Modal.Body>
            <Modal.Footer className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirmClear(false)} className="min-h-14 !text-lg">
                No
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setCart([]);
                  setConfirmClear(false);
                }}
                className="min-h-14 !text-lg"
              >
                Sí, vaciar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

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
