import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/lib/models/Settings";
import { loadSaleForReturn } from "@/lib/returnsService";
import { plain } from "@/lib/serialize";
import { Alert, Page, PageHeader } from "@/components/ui";
import ReturnLookup from "@/components/returns/ReturnLookup";
import ReturnForm, { type ReturnSale } from "@/components/returns/ReturnForm";

export const metadata = { title: "Nueva devolución" };

type SP = { venta?: string; sinNota?: string; q?: string };

export default async function NuevaDevolucionPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePage("returns:create");
  const sp = await searchParams;
  await connectDB();
  const settings = await getSettings();

  if (sp.venta) {
    let sale: ReturnSale | null = null;
    let error = "";
    try {
      sale = plain<ReturnSale>(await loadSaleForReturn(sp.venta));
    } catch (e) {
      error = (e as Error).message;
    }
    return (
      <Page>
        <PageHeader title={sale ? `Devolución de ${sale.folio}` : "Devolución"} subtitle="Marca lo que regresa y, si es cambio, lo que se lleva." back={{ href: "/devoluciones/nueva", label: "Buscar otra venta" }} />
        {error ? <Alert>{error}</Alert> : <ReturnForm sale={sale} defaultPct={settings.defaultCommissionPct} />}
      </Page>
    );
  }

  if (sp.sinNota) {
    return (
      <Page>
        <PageHeader title="Devolución sin nota" subtitle="Para cuando no trae nota o no aparece la venta." back={{ href: "/devoluciones/nueva", label: "Buscar la venta" }} />
        <ReturnForm sale={null} defaultPct={settings.defaultCommissionPct} />
      </Page>
    );
  }

  return (
    <Page className="max-w-3xl">
      <PageHeader title="Nueva devolución o cambio" subtitle="Primero encuentra la venta." back={{ href: "/devoluciones", label: "Devoluciones" }} />
      <ReturnLookup initialQ={sp.q ?? ""} />
    </Page>
  );
}
