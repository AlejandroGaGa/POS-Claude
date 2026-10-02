import { describe, expect, it } from "vitest";
import { lineSignature, paymentLine, withUnitPrice } from "@/lib/pricing";
import { billingText } from "@/lib/billing";

describe("paymentLine", () => {
  it("efectivo sin comisión", () => expect(paymentLine(100, "efectivo", 4)).toMatchObject({ amount: 100, commissionAmount: 0, received: 100 }));
  it("terminal cobra comisión sobre el abono", () => expect(paymentLine(250, "terminal", 4)).toMatchObject({ amount: 250, commissionPct: 4, commissionAmount: 10, received: 260 }));
  it("rechaza montos en cero", () => expect(() => paymentLine(0, "efectivo", 0)).toThrow());
  it("rechaza comisión fuera de rango", () => expect(() => paymentLine(10, "terminal", 30)).toThrow());
});

describe("precio cotizado", () => {
  it("la firma ignora la cantidad y redondea medidas", () => {
    expect(lineSignature("p1", { mode: "tramo", lengthM: 1.2500001 })).toBe(lineSignature("p1", { mode: "tramo", lengthM: 1.25 }));
    expect(lineSignature("p1", { mode: "tira", barLengthM: 6.1 })).not.toBe(lineSignature("p1", { mode: "tira", barLengthM: 4.6 }));
  });
  it("withUnitPrice recalcula el subtotal", () => expect(withUnitPrice({ qty: 3, unitPrice: 50, subtotal: 150 }, 20).subtotal).toBe(60));
});

describe("datos de facturación", () => {
  it("arma el texto para copiar", () => {
    const t = billingText({ legalName: "VIDRIOS SA", rfc: "VRO010101AB1", zip: "72000", taxRegime: "601 - General" });
    expect(t).toContain("RFC: VRO010101AB1");
    expect(t).toContain("C.P.: 72000");
    expect(t).not.toContain("Correo");
  });
});
