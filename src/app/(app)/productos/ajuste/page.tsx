import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Product } from "@/lib/models/Product";
import { Page, PageHeader } from "@/components/ui";
import BulkAdjust from "@/components/BulkAdjust";

export const metadata = { title: "Ajuste de precios" };

export default async function AjustePage() {
  await requirePage("products:edit");
  await connectDB();
  const categories = ((await Product.distinct("category", { active: true })) as string[]).sort();
  return (
    <Page>
      <PageHeader title="Subir o bajar precios" subtitle="Revisa la vista previa antes de aplicar; queda en el historial de cada producto." back={{ href: "/productos", label: "Productos" }} />
      <BulkAdjust categories={categories} />
    </Page>
  );
}
