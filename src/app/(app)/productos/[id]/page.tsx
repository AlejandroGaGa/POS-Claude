import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Product } from "@/lib/models/Product";
import { PriceLog } from "@/lib/models/PriceLog";
import { plain } from "@/lib/serialize";
import { fmtDate } from "@/lib/labels";
import { formatMoney } from "@/lib/pricing";
import type { ProductJSON } from "@/lib/types";
import { Alert, Page, PageHeader, Section } from "@/components/ui";
import ProductForm from "@/components/ProductForm";

export const metadata = { title: "Editar producto" };

const SOURCE: Record<string, string> = { edicion: "Edición", "ajuste-masivo": "Ajuste masivo", importacion: "Importación" };

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return formatMoney(v);
  if (Array.isArray(v))
    return (
      v
        .map((b: { lengthM?: number; widthM?: number; heightM?: number; price: number }) =>
          b.lengthM !== undefined ? `${b.lengthM} m: ${formatMoney(b.price)}` : `${b.widthM}×${b.heightM} m: ${formatMoney(b.price)}`,
        )
        .join(", ") || "—"
    );
  if (typeof v === "object") {
    const s = v as { widthM: number; heightM: number; price: number };
    return `${s.widthM}×${s.heightM} m: ${formatMoney(s.price)}`;
  }
  return String(v);
}

export default async function EditarProducto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  await requirePage("products:edit");
  const { id } = await params;
  const { nuevo } = await searchParams;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();
  const [product, logs, categories] = await Promise.all([
    Product.findById(id).lean(),
    PriceLog.find({ product: id }).sort({ createdAt: -1 }).limit(30).lean(),
    Product.distinct("category"),
  ]);
  if (!product) notFound();

  return (
    <Page>
      <PageHeader title={product.name} subtitle={`${product.code} · ${product.category}`} back={{ href: "/productos", label: "Productos" }} />
      {nuevo && <Alert tone="ok">Producto creado.</Alert>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <ProductForm product={plain<ProductJSON>(product)} categories={(categories as string[]).sort()} />
        <Section title="Historial de precios" description="Últimos 30 cambios" className="xl:sticky xl:top-[calc(var(--sticky-top)+0.75rem)] xl:max-h-[calc(100dvh-var(--sticky-top)-1.5rem)] xl:overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-muted">Sin cambios registrados.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {logs.map((l) => (
                <li key={String(l._id)} className="border-l-2 border-accent/40 pl-3">
                  <p className="text-xs text-muted">
                    {fmtDate(l.createdAt)} · {l.userName} · {SOURCE[l.source ?? "edicion"]}
                  </p>
                  <ul className="text-sm">
                    {l.changes.map((c, i) => (
                      <li key={i}>
                        <span className="font-semibold">{c.field}:</span> {c.field === "alta" ? String(c.to) : `${show(c.from)} → ${show(c.to)}`}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </Page>
  );
}
