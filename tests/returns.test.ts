import { describe, expect, it } from "vitest";
import { normalizeFolio, returnableQty, returnedLineValue, settleReturn } from "@/lib/returns";
import { looseRegex } from "@/lib/text";

describe("devolución con diferencia", () => {
  it("devuelve una tira de 450 y se lleva una de 589: se cobran 139", () => {
    expect(settleReturn({ returnedTotal: 450, newTotal: 589, mode: "diferencia" })).toMatchObject({ difference: 139, charge: 139, refund: 0, outcome: "cobro" });
  });
  it("devuelve 589 y se lleva 450: se regresan 139 en efectivo", () => {
    expect(settleReturn({ returnedTotal: 589, newTotal: 450, mode: "diferencia" })).toMatchObject({ difference: -139, charge: 0, refund: 139, outcome: "reembolso" });
  });
  it("solo devuelve (sin cambio): se regresa todo", () => {
    expect(settleReturn({ returnedTotal: 300, newTotal: 0, mode: "diferencia" })).toMatchObject({ refund: 300, outcome: "reembolso" });
  });
  it("mismo valor: cambio parejo", () => {
    expect(settleReturn({ returnedTotal: 346, newTotal: 346, mode: "diferencia" })).toMatchObject({ charge: 0, refund: 0, outcome: "parejo" });
  });
  it("si la venta debía saldo, lo que se le debe se abona primero", () => {
    expect(settleReturn({ returnedTotal: 589, newTotal: 450, mode: "diferencia", balance: 100 })).toMatchObject({ appliedToBalance: 100, refund: 39, outcome: "reembolso" });
    expect(settleReturn({ returnedTotal: 589, newTotal: 450, mode: "diferencia", balance: 500 })).toMatchObject({ appliedToBalance: 139, refund: 0, outcome: "abono_saldo" });
  });
  it("el saldo no afecta cuando el cliente es quien paga", () => {
    expect(settleReturn({ returnedTotal: 450, newTotal: 589, mode: "diferencia", balance: 500 })).toMatchObject({ charge: 139, appliedToBalance: 0 });
  });
  it("redondea centavos", () => {
    expect(settleReturn({ returnedTotal: 100.105, newTotal: 200.2, mode: "diferencia" }).charge).toBe(100.09);
  });
});

describe("cambio sin diferencia (cortesía)", () => {
  it("lo nuevo vale más: no se cobra y el negocio absorbe", () => {
    expect(settleReturn({ returnedTotal: 450, newTotal: 589, mode: "cortesia" })).toMatchObject({ charge: 0, refund: 0, waived: 139, outcome: "cortesia" });
  });
  it("lo nuevo vale menos: no se regresa nada", () => {
    expect(settleReturn({ returnedTotal: 589, newTotal: 450, mode: "cortesia" })).toMatchObject({ charge: 0, refund: 0, notRefunded: 139, outcome: "cortesia" });
  });
  it("mismo valor: parejo", () => {
    expect(settleReturn({ returnedTotal: 10, newTotal: 10, mode: "cortesia" }).outcome).toBe("parejo");
  });
});

describe("cobrar lo nuevo completo", () => {
  it("se cobra lo nuevo entero y lo devuelto no se acredita", () => {
    expect(settleReturn({ returnedTotal: 450, newTotal: 589, mode: "cobrar_completo", balance: 300 })).toMatchObject({ charge: 589, refund: 0, notRefunded: 450, appliedToBalance: 0, outcome: "cobro" });
  });
  it("sin nada nuevo es una devolución sin reembolso", () => {
    expect(settleReturn({ returnedTotal: 450, newTotal: 0, mode: "cobrar_completo" })).toMatchObject({ charge: 0, refund: 0, notRefunded: 450, outcome: "sin_reembolso" });
  });
});

describe("cantidades devueltas", () => {
  it("valor a precio pagado", () => expect(returnedLineValue(115.5, 2)).toBe(231));
  it("lo que queda por devolver", () => {
    expect(returnableQty(3, 1)).toBe(2);
    expect(returnableQty(3, null)).toBe(3);
    expect(returnableQty(2.5, 2.5)).toBe(0);
    expect(returnableQty(1, 2)).toBe(0);
  });
});

describe("búsqueda", () => {
  it("normaliza folios", () => {
    expect(normalizeFolio("v123")).toEqual({ prefix: "V", folio: "V-000123" });
    expect(normalizeFolio("C-000045")).toEqual({ prefix: "C", folio: "C-000045" });
    expect(normalizeFolio("d 7")).toEqual({ prefix: "D", folio: "D-000007" });
    expect(normalizeFolio("Juan")).toBeNull();
  });
  it("nombre sin importar acentos ni mayúsculas", () => {
    expect(looseRegex("jose perez").test("José Pérez")).toBe(true);
    expect(looseRegex("MUÑOZ").test("munoz")).toBe(true);
    expect(looseRegex("muñoz").test("MUÑOZ")).toBe(true);
  });
  it("teléfono con espacios o guiones", () => {
    expect(looseRegex("5512345678").test("55 1234-5678")).toBe(true);
    expect(looseRegex("1234").test("(55) 12 34 56")).toBe(true);
  });
  it("escapa caracteres especiales", () => {
    expect(looseRegex('Cabezal 2"').test('Cabezal 2" Negro')).toBe(true);
    expect(() => looseRegex("(a+")).not.toThrow();
  });
});
