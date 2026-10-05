import { describe, expect, it } from "vitest";
import { adjustLines, shownLine } from "@/lib/adjust";

const chambrana = { qty: 4, unitPrice: 100, subtotal: 400 };
const herraje = { qty: 1, unitPrice: 50, subtotal: 50 };

describe("cobrar de más (oculto)", () => {
  it("4 chambranas ($400) + herraje ($50) con +$50: la nota suma $500 en pesos cerrados", () => {
    const a = adjustLines([chambrana, herraje], { extra: 50 });
    expect(a.shownSubtotal).toBe(500);
    expect(a.subtotal).toBe(500);
    expect(a.extra).toBe(50);
    for (const l of a.lines) expect(Number.isInteger(l.shownUnitPrice)).toBe(true);
    for (const l of a.lines) expect(l.shownUnitPrice).toBeGreaterThanOrEqual(l.listUnitPrice);
    expect(a.lines[0].listUnitPrice).toBe(100);
  });
  it("sin renglones de una pieza cuadra exacto repartiendo por pieza", () => {
    const a = adjustLines([{ qty: 2, unitPrice: 100, subtotal: 200 }, { qty: 4, unitPrice: 25, subtotal: 100 }], { extra: 37 });
    expect(a.shownSubtotal).toBe(337);
  });
  it("kilos con decimales", () => {
    const a = adjustLines([{ qty: 2.5, unitPrice: 45, subtotal: 112.5 }, { qty: 1, unitPrice: 30, subtotal: 30 }], { extra: 20 });
    expect(a.shownSubtotal).toBe(162.5);
  });
  it("nunca baja un precio de lista", () => {
    const a = adjustLines([{ qty: 10, unitPrice: 3.2, subtotal: 32 }, { qty: 1, unitPrice: 1000, subtotal: 1000 }], { extra: 1 });
    a.lines.forEach((l) => expect(l.shownUnitPrice).toBeGreaterThanOrEqual(l.listUnitPrice));
    expect(a.shownSubtotal).toBe(1033);
  });
  it("sin extra no cambia nada", () => {
    const a = adjustLines([chambrana, herraje]);
    expect(a.lines.map((l) => l.unitPrice)).toEqual([100, 50]);
    expect(a.subtotal).toBe(450);
  });
  it("recalcular desde lo ya ajustado parte del precio de lista (no infla dos veces)", () => {
    const once = adjustLines([chambrana, herraje], { extra: 50 });
    const twice = adjustLines(once.lines, { extra: 50 });
    expect(twice.shownSubtotal).toBe(500);
  });
});

describe("descuento especial (visible)", () => {
  it("5% sobre $50,000", () => {
    const a = adjustLines([{ qty: 100, unitPrice: 500, subtotal: 50000 }], { discountPct: 5 });
    expect(a.shownSubtotal).toBe(50000);
    expect(a.discountAmount).toBe(2500);
    expect(a.subtotal).toBe(47500);
    expect(a.lines[0].shownUnitPrice).toBe(500);
    expect(a.lines[0].unitPrice).toBe(475);
  });
  it("tope de 90%", () => expect(adjustLines([herraje], { discountPct: 150 }).discountPct).toBe(90));
  it("extra y descuento juntos: el descuento va sobre lo que se imprime", () => {
    const a = adjustLines([chambrana, herraje], { extra: 50, discountPct: 10 });
    expect(a.shownSubtotal).toBe(500);
    expect(a.discountAmount).toBe(50);
    expect(a.subtotal).toBe(450);
  });
});

describe("lo que se imprime", () => {
  it("ventas viejas sin campos nuevos usan el precio normal", () => expect(shownLine({ unitPrice: 10, subtotal: 20 })).toEqual({ unitPrice: 10, subtotal: 20 }));
  it("con ajuste imprime el precio antes del descuento", () => expect(shownLine({ unitPrice: 9, subtotal: 18, shownUnitPrice: 10, shownSubtotal: 20 })).toEqual({ unitPrice: 10, subtotal: 20 }));
});
