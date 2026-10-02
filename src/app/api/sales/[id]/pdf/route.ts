import { connectDB } from "@/lib/db";
import { handle, requireApi } from "@/lib/auth";
import { getSettings } from "@/lib/models/Settings";
import { loadSaleForApi } from "@/lib/saleAccess";
import { buildNotePdf, pdfFileName, type PdfSale } from "@/lib/notePdf";

/** Descarga la nota/cotización en PDF. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApi("sales:create");
  await connectDB();
  const [sale, settings] = await Promise.all([loadSaleForApi(user, (await params).id), getSettings()]);
  const pdf = await buildNotePdf(sale as unknown as PdfSale, settings);
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(sale as unknown as PdfSale)}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
