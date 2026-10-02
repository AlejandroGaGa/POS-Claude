import { requirePage } from "@/lib/auth";
import { Page, PageHeader } from "@/components/ui";
import ImportProducts from "@/components/ImportProducts";

export const metadata = { title: "Importar lista de precios" };

export default async function ImportarPage() {
  await requirePage("products:edit");
  return (
    <Page>
      <PageHeader title="Importar lista de precios" subtitle="Crea productos nuevos y actualiza precios desde un CSV." back={{ href: "/productos", label: "Productos" }} />
      <ImportProducts />
    </Page>
  );
}
