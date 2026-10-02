import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { HttpError, handle, requireApi } from "@/lib/auth";
import { getSettings } from "@/lib/models/Settings";
import { Sale } from "@/lib/models/Sale";
import { loadSaleForApi } from "@/lib/saleAccess";
import { parse } from "@/lib/validation";
import { buildNotePdf, pdfFileName, type PdfSale } from "@/lib/notePdf";
import { formatMoney } from "@/lib/pricing";
import { normalizePhone, sendDocumentTemplate, uploadPdf, whatsappConfig } from "@/lib/whatsapp";

const Body = z.object({
  phone: z.string().trim().min(10, "Escribe el teléfono del cliente").max(20),
  savePhone: z.boolean().optional(),
});

/**
 * Envía el PDF de la nota/cotización al cliente por WhatsApp Cloud API usando la plantilla
 * aprobada. Variables del cuerpo: {{1}} cliente, {{2}} tipo de documento, {{3}} folio, {{4}} total.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApi("sales:create");
  const cfg = whatsappConfig();
  if (!cfg.enabled) throw new HttpError(503, "WhatsApp no está configurado. Agrega WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en las variables de entorno.");
  const { phone, savePhone } = parse(Body, await req.json());
  const to = normalizePhone(phone);

  await connectDB();
  const id = (await params).id;
  const [sale, settings] = await Promise.all([loadSaleForApi(user, id), getSettings()]);
  if (sale.status === "cancelada") throw new HttpError(409, "No se puede enviar un documento cancelado.");

  const pdfSale = sale as unknown as PdfSale;
  const filename = pdfFileName(pdfSale);
  const pdf = await buildNotePdf(pdfSale, settings);
  const mediaId = await uploadPdf(pdf, filename);
  const messageId = await sendDocumentTemplate({
    to,
    mediaId,
    filename,
    params: [
      sale.customerName || "cliente",
      sale.kind === "cotizacion" ? "cotización" : "nota de venta",
      sale.folio,
      formatMoney(sale.total),
    ],
  });

  const update: Record<string, unknown> = { whatsappSentAt: new Date(), whatsappSentTo: to, whatsappSentByName: user.name };
  if (savePhone && !sale.customerPhone) update.customerPhone = phone;
  await Sale.updateOne({ _id: sale._id }, { $set: update });

  return NextResponse.json({ ok: true, to, messageId });
});
