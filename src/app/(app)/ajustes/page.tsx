import { requirePage } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/lib/models/Settings";
import { Page, PageHeader } from "@/components/ui";
import { whatsappConfig } from "@/lib/whatsapp";
import SettingsForm from "@/components/SettingsForm";

export const metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  await requirePage("settings:edit");
  await connectDB();
  const settings = await getSettings();
  return (
    <Page>
      <PageHeader title="Ajustes del negocio" subtitle="Datos de la nota, valores de venta e integraciones." />
      <SettingsForm settings={settings} whatsapp={(({ enabled, template, lang }) => ({ enabled, template, lang }))(whatsappConfig())} />
    </Page>
  );
}
