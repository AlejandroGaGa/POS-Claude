import "server-only";
import { HttpError } from "./errors";

/**
 * Envío de documentos por WhatsApp Cloud API (Meta).
 * Flujo: 1) subir el PDF a /{phone-number-id}/media  2) enviar una plantilla aprobada
 * con encabezado de tipo documento que apunta al media id.
 */

export function whatsappConfig() {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  return {
    token,
    phoneNumberId,
    version: process.env.WHATSAPP_API_VERSION?.trim() || "v21.0",
    template: process.env.WHATSAPP_TEMPLATE_NAME?.trim() || "nota_pdf",
    lang: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "es_MX",
    /** Cuántos parámetros {{n}} tiene el cuerpo de la plantilla (0 a 4). */
    bodyParams: Math.min(4, Math.max(0, Number(process.env.WHATSAPP_TEMPLATE_BODY_PARAMS ?? 4) || 0)),
    enabled: Boolean(token && phoneNumberId),
  };
}

/** Normaliza un teléfono mexicano a formato internacional sin "+": 10 dígitos → 52XXXXXXXXXX. */
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) d = `52${d}`;
  // 521XXXXXXXXXX (formato antiguo de celulares en México) → 52XXXXXXXXXX
  if (d.length === 13 && d.startsWith("521")) d = `52${d.slice(3)}`;
  if (d.length < 11 || d.length > 15) throw new HttpError(400, "Teléfono no válido. Escribe 10 dígitos (o con lada internacional).");
  return d;
}

type MetaError = { error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } } };

function metaMessage(data: MetaError, status: number): string {
  const e = data?.error;
  const code = e?.code;
  const hints: Record<number, string> = {
    190: "El token de WhatsApp no es válido o expiró. Genera uno permanente (usuario del sistema) y actualiza WHATSAPP_TOKEN.",
    131030: "Este número no está en la lista de destinatarios permitidos de tu número de prueba. Agrégalo en Meta o usa tu número de producción.",
    132001: "La plantilla no existe o no está aprobada en ese idioma. Revisa WHATSAPP_TEMPLATE_NAME y WHATSAPP_TEMPLATE_LANG.",
    132000: "La cantidad de variables no coincide con la plantilla. Ajusta WHATSAPP_TEMPLATE_BODY_PARAMS.",
    132012: "El formato de la plantilla no coincide (¿tiene encabezado de tipo Documento?).",
    131026: "El número no tiene WhatsApp o no puede recibir mensajes.",
    131047: "Han pasado más de 24 h desde el último mensaje del cliente; usa una plantilla aprobada.",
    100: "Parámetro inválido en la solicitud a Meta.",
  };
  const base = (code && hints[code]) || e?.error_data?.details || e?.message || `Meta respondió con error ${status}.`;
  return `WhatsApp: ${base}`;
}

async function graph(path: string, init: RequestInit) {
  const cfg = whatsappConfig();
  const res = await fetch(`https://graph.facebook.com/${cfg.version}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as MetaError & Record<string, unknown>;
  if (!res.ok) throw new HttpError(502, metaMessage(data, res.status));
  return data;
}

export async function uploadPdf(pdf: Uint8Array, filename: string): Promise<string> {
  const cfg = whatsappConfig();
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([pdf as BlobPart], { type: "application/pdf" }), filename);
  const data = await graph(`${cfg.phoneNumberId}/media`, { method: "POST", body: form });
  const id = data.id as string | undefined;
  if (!id) throw new HttpError(502, "WhatsApp: Meta no devolvió el id del documento.");
  return id;
}

export async function sendDocumentTemplate(opts: { to: string; mediaId: string; filename: string; params: string[] }) {
  const cfg = whatsappConfig();
  const components: unknown[] = [
    { type: "header", parameters: [{ type: "document", document: { id: opts.mediaId, filename: opts.filename } }] },
  ];
  const body = opts.params.slice(0, cfg.bodyParams).map((t) => ({ type: "text", text: t.slice(0, 900) || "-" }));
  if (body.length) components.push({ type: "body", parameters: body });
  const data = await graph(`${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: opts.to,
      type: "template",
      template: { name: cfg.template, language: { code: cfg.lang }, components },
    }),
  });
  const messages = data.messages as { id: string }[] | undefined;
  return messages?.[0]?.id ?? null;
}
