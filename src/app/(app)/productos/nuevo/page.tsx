import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Product } from "@/lib/models/Product";
import { Page, PageHeader, Section } from "@/components/ui";
import { UNIT_TYPE_LABELS, UNIT_TYPES } from "@/lib/pricing";
import ProductForm from "@/components/ProductForm";

export const metadata = { title: "Nuevo producto" };

export default async function NuevoProducto() {
  await requirePage("products:edit");
  await connectDB();
  const categories = (await Product.distinct("category")) as string[];
  const help: Record<string, string> = {
    pieza: "Bisagras, jaladeras, tornillos: cantidad × precio.",
    kg: "Esmeril, soldadura: kilos con decimales.",
    metro: "Felpa, vinil, empaques: metros lineales.",
    perfil: "Aluminio: tira completa (6.10 m, 4.60 m…) o tramo desde 50 cm por metro.",
    vidrio: "Hoja completa o corte a medida por m², con precio particular y vidriero.",
  };
  return (
    <Page>
      <PageHeader title="Nuevo producto" subtitle="Captura los datos y al menos un precio." back={{ href: "/productos", label: "Productos" }} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <ProductForm categories={categories.sort()} />
        <Section title="Formas de venta" description="Elige la que corresponda en «¿Cómo se vende?»" className="xl:sticky xl:top-[calc(var(--sticky-top)+0.75rem)]">
          <dl className="flex flex-col gap-3 text-sm">
            {UNIT_TYPES.map((t) => (
              <div key={t} className="border-l-2 border-accent/40 pl-3">
                <dt className="font-semibold">{UNIT_TYPE_LABELS[t]}</dt>
                <dd className="text-muted">{help[t]}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </Page>
  );
}
