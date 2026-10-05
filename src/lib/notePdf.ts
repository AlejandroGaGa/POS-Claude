import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { shownLine } from "./adjust";
import { formatMoney, formatNumber, PAYMENT_LABELS, type PaymentMethod } from "./pricing";
import { fmtDate } from "./labels";

export interface PdfBusiness {
  businessName: string;
  address?: string;
  phone?: string;
  rfc?: string;
  ticketFooter?: string;
}

export interface PdfSale {
  kind: "venta" | "cotizacion";
  folio: string;
  status: string;
  createdAt: Date | string;
  sellerName?: string;
  customerName?: string;
  customerPhone?: string;
  customerType?: string;
  validUntil?: Date | string | null;
  items: { code?: string; name: string; detail?: string; qty: number; unitPrice: number; subtotal: number; shownUnitPrice?: number | null; shownSubtotal?: number | null }[];
  subtotal: number;
  shownSubtotal?: number | null;
  discountPct?: number | null;
  discountAmount?: number | null;
  commissionPct?: number;
  commissionAmount?: number;
  total: number;
  paymentMethod?: string | null;
  notes?: string;
  paid?: number | null;
  balance?: number | null;
}

// Helvetica estándar usa WinAnsi: acentos y ñ funcionan; otros símbolos se reemplazan.
const EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function clean(s: string | undefined | null) {
  return (s ?? "")
    .replace(/\s+/g, " ")
    .split("")
    .map((c) => (c.charCodeAt(0) <= 0xff || EXTRA.has(c) ? c : "?"))
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const words = clean(text).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Genera la nota/cotización como PDF tamaño carta. */
export async function buildNotePdf(sale: PdfSale, biz: PdfBusiness): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const isQuote = sale.kind === "cotizacion";
  const title = isQuote ? "Cotización" : "Nota de venta";
  doc.setTitle(`${title} ${sale.folio}`);
  doc.setAuthor(clean(biz.businessName));
  doc.setCreator("Ventas Mostrador HPA");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.1, 0.14);
  const muted = rgb(0.42, 0.4, 0.45);
  const line = rgb(0.85, 0.83, 0.86);
  const accent = rgb(0.29, 0.16, 0.33);

  const W = 612;
  const H = 792;
  const M = 48;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, size = 10, f: PDFFont = font, color = ink) => page.drawText(clean(s), { x, y, size, font: f, color });
  const right = (s: string, xr: number, size = 10, f: PDFFont = font, color = ink) => {
    const t = clean(s);
    page.drawText(t, { x: xr - f.widthOfTextAtSize(t, size), y, size, font: f, color });
  };
  const hr = (c = line) => page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: c });
  const ensure = (needed: number) => {
    if (y - needed < M + 30) {
      page = doc.addPage([W, H]);
      y = H - M;
      drawTableHeader();
    }
  };

  // Encabezado
  text(biz.businessName, M, 18, bold, accent);
  right(title, W - M, 14, bold);
  y -= 18;
  right(sale.folio, W - M, 13, bold);
  const leftInfo = [biz.address, biz.phone ? `Tel. ${biz.phone}` : "", biz.rfc ? `RFC ${biz.rfc}` : ""].filter(Boolean) as string[];
  const rightInfo = [fmtDate(sale.createdAt), sale.status === "cancelada" ? "CANCELADA" : ""].filter(Boolean);
  for (let i = 0; i < Math.max(leftInfo.length, rightInfo.length); i++) {
    if (i > 0 || leftInfo.length) y -= 14;
    if (leftInfo[i]) text(leftInfo[i], M, 9.5, font, muted);
    if (rightInfo[i]) right(rightInfo[i], W - M, 9.5, rightInfo[i] === "CANCELADA" ? bold : font, rightInfo[i] === "CANCELADA" ? rgb(0.7, 0.1, 0.1) : muted);
  }
  y -= 14;
  hr();
  y -= 18;

  // Datos
  const facts: [string, string][] = [];
  if (sale.customerName) facts.push(["Cliente", sale.customerName]);
  if (sale.customerPhone) facts.push(["Teléfono", sale.customerPhone]);
  if (sale.customerType === "vidriero") facts.push(["Tipo de cliente", "Vidriero"]);
  if (sale.sellerName) facts.push(["Atendió", sale.sellerName]);
  if (isQuote && sale.validUntil) facts.push(["Vigente hasta", fmtDate(sale.validUntil, false)]);
  facts.forEach(([k, v], i) => {
    const x = i % 2 === 0 ? M : W / 2 + 6;
    text(`${k}: `, x, 10, bold);
    text(v, x + bold.widthOfTextAtSize(clean(`${k}: `), 10), 10);
    if (i % 2 === 1 || i === facts.length - 1) y -= 15;
  });
  y -= 6;

  // Tabla
  const cQty = W - M - 200;
  const cUnit = W - M - 95;
  const cAmt = W - M;
  const nameMax = cQty - M - 50;
  function drawTableHeader() {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: rgb(0.95, 0.94, 0.95) });
    text("Producto", M + 6, 9.5, bold);
    right("Cant.", cQty, 9.5, bold);
    right("P. unit.", cUnit, 9.5, bold);
    right("Importe", cAmt - 6, 9.5, bold);
    y -= 22;
  }
  drawTableHeader();

  for (const it of sale.items) {
    const nameLines = wrap(it.name, bold, 10, nameMax);
    const detailLines = wrap([it.code, it.detail].filter(Boolean).join(" · "), font, 8.5, nameMax);
    ensure(nameLines.length * 13 + detailLines.length * 11 + 10);
    y -= 2;
    right(formatNumber(it.qty), cQty, 10);
    right(formatMoney(shownLine(it).unitPrice), cUnit, 10);
    right(formatMoney(shownLine(it).subtotal), cAmt - 6, 10, bold);
    nameLines.forEach((l, i) => {
      if (i) y -= 13;
      text(l, M + 6, 10, bold);
    });
    for (const l of detailLines) {
      y -= 11;
      text(l, M + 6, 8.5, font, muted);
    }
    y -= 9;
    hr();
    y -= 13;
  }

  // Totales
  ensure(90);
  y -= 4;
  const tx = W - M - 220;
  const row = (k: string, v: string, size = 10, f: PDFFont = font) => {
    text(k, tx, size, f);
    right(v, cAmt - 6, size, f);
    y -= size + 6;
  };
  if ((sale.discountAmount ?? 0) > 0) {
    row("Subtotal", formatMoney(sale.shownSubtotal ?? sale.subtotal + (sale.discountAmount ?? 0)));
    row(`Descuento especial (${formatNumber(sale.discountPct ?? 0, 2)}%)`, `-${formatMoney(sale.discountAmount ?? 0)}`, 10, bold);
    if (sale.commissionAmount && sale.commissionAmount > 0) row("Subtotal con descuento", formatMoney(sale.subtotal));
  } else row("Subtotal", formatMoney(sale.subtotal));
  if (sale.commissionAmount && sale.commissionAmount > 0) row(`Comisión terminal (${formatNumber(sale.commissionPct ?? 0, 2)}%)`, formatMoney(sale.commissionAmount));
  y += 4;
  page.drawLine({ start: { x: tx, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.8, color: line });
  y -= 10;
  row("Total", formatMoney(sale.total), 15, bold);
  if (sale.paymentMethod) row(isQuote ? "Pago previsto" : "Pagó con", PAYMENT_LABELS[sale.paymentMethod as PaymentMethod] ?? sale.paymentMethod, 9.5);
  if (!isQuote && (sale.balance ?? 0) > 0) {
    row("Pagado", formatMoney(sale.paid ?? 0), 9.5);
    row("Saldo pendiente", formatMoney(sale.balance ?? 0), 11, bold);
  }

  if (sale.notes) {
    y -= 8;
    for (const l of wrap(`Notas: ${sale.notes}`, font, 9.5, W - 2 * M)) {
      ensure(14);
      text(l, M, 9.5);
      y -= 13;
    }
  }

  if (biz.ticketFooter) {
    y -= 14;
    ensure(30);
    hr();
    y -= 16;
    for (const l of wrap(biz.ticketFooter, font, 9.5, W - 2 * M)) {
      const t = clean(l);
      page.drawText(t, { x: (W - font.widthOfTextAtSize(t, 9.5)) / 2, y, size: 9.5, font, color: muted });
      y -= 13;
    }
  }

  // Número de página
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const t = `${sale.folio} · Página ${i + 1} de ${pages.length}`;
    p.drawText(t, { x: W - M - font.widthOfTextAtSize(t, 8), y: 24, size: 8, font, color: muted });
  });

  return doc.save();
}

export function pdfFileName(sale: Pick<PdfSale, "kind" | "folio">) {
  return `${sale.kind === "cotizacion" ? "Cotizacion" : "Nota"}-${sale.folio}.pdf`;
}
