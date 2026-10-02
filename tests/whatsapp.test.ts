import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { normalizePhone, sendDocumentTemplate, uploadPdf } from "@/lib/whatsapp";
import { buildNotePdf } from "@/lib/notePdf";

const sale = {
  kind: "cotizacion" as const,
  folio: "C-000042",
  status: "vigente",
  createdAt: new Date("2026-09-30T18:00:00Z"),
  sellerName: "Ana Pérez",
  customerName: "José Núñez",
  customerPhone: "2221234567",
  customerType: "vidriero",
  validUntil: new Date("2026-10-07T18:00:00Z"),
  items: Array.from({ length: 40 }, (_, i) => ({
    code: `AL-${i}`,
    name: `Perfil 2" línea 35 natural con nombre largo para probar el ajuste de línea ${i} → ✓`,
    detail: "Tira 6.10 m",
    qty: 2,
    unitPrice: 512.5,
    subtotal: 1025,
  })),
  subtotal: 41000,
  commissionPct: 4.6,
  commissionAmount: 1886,
  total: 42886,
  paymentMethod: "terminal",
  notes: "Entregar el viernes",
};

describe("normalizePhone", () => {
  it("agrega 52 a 10 dígitos", () => expect(normalizePhone("(222) 123-4567")).toBe("522221234567"));
  it("quita el 1 viejo de celulares MX", () => expect(normalizePhone("+52 1 222 123 4567")).toBe("522221234567"));
  it("respeta otros países", () => expect(normalizePhone("+1 415 555 0100")).toBe("14155550100"));
  it("rechaza números cortos", () => expect(() => normalizePhone("12345")).toThrow());
});

describe("buildNotePdf", () => {
  it("genera un PDF válido con varias páginas y caracteres fuera de WinAnsi", async () => {
    const bytes = await buildNotePdf(sale, { businessName: "Herrajes HPA", address: "Calle 1 #2", phone: "222", rfc: "XAXX010101000", ticketFooter: "Gracias" });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getTitle()).toBe("Cotización C-000042");
  });
});

describe("WhatsApp Cloud API", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("sube el PDF y manda la plantilla con encabezado de documento", async () => {
    process.env.WHATSAPP_TOKEN = "tok";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = url.endsWith("/media") ? { id: "MEDIA1" } : { messages: [{ id: "wamid.X" }] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const id = await uploadPdf(new Uint8Array([1, 2, 3]), "Nota-V-1.pdf");
    const msg = await sendDocumentTemplate({ to: "522221234567", mediaId: id, filename: "Nota-V-1.pdf", params: ["José", "nota de venta", "V-1", "$10.00"] });
    expect(msg).toBe("wamid.X");
    expect(calls[0].url).toBe("https://graph.facebook.com/v21.0/123/media");
    const payload = JSON.parse(String(calls[1].init.body));
    expect(payload.template.name).toBe("nota_pdf");
    expect(payload.template.language.code).toBe("es_MX");
    expect(payload.template.components[0].parameters[0].document).toEqual({ id: "MEDIA1", filename: "Nota-V-1.pdf" });
    expect(payload.template.components[1].parameters).toHaveLength(4);
  });
  it("traduce errores de Meta a mensajes claros", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { code: 190, message: "bad" } }), { status: 401 }));
    await expect(uploadPdf(new Uint8Array([1]), "a.pdf")).rejects.toThrow(/token/);
  });
});
