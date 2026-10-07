import { describe, expect, it } from "vitest";
import { CUSTOM_CATEGORY, customFromStored, customPricing, customProduct, isCustomProduct, lineToPayload } from "@/lib/customItem";
import { priceLine } from "@/lib/pricing";
import { LineInputSchema, SaleInput } from "@/lib/validation";
import { upsertLine } from "@/lib/cart";
import type { ProductJSON } from "@/lib/types";

const chapa = { name: "Chapa especial para puerta", price: 385.5 };

describe("producto fuera de catálogo: carrito", () => {
  it("se calcula con las mismas reglas que un producto del catálogo", () => {
    expect(priceLine(customPricing(chapa, "pieza"), { mode: "pieza", qty: 3 })).toMatchObject({ unitPrice: 385.5, subtotal: 1156.5, detail: "pza" });
    expect(priceLine(customPricing({ name: "Felpa rara", price: 12 }, "metro"), { mode: "metro", qty: 2.5 })).toMatchObject({ subtotal: 30, detail: "m" });
    expect(priceLine(customPricing({ name: "Esmeril", price: 100 }, "kg"), { mode: "kg", qty: 0.75 })).toMatchObject({ subtotal: 75, detail: "kg" });
  });

  it("por pieza solo acepta cantidades enteras", () => {
    expect(() => priceLine(customPricing(chapa, "pieza"), { mode: "pieza", qty: 1.5 })).toThrow();
  });

  it("no se puede vender por tira, tramo, hoja ni m²", () => {
    expect(() => priceLine(customPricing(chapa, "pieza"), { mode: "tira", qty: 1, barLengthM: 6 })).toThrow();
  });

  it("el producto del carrito queda marcado y sin código", () => {
    const p = customProduct(chapa, "pieza", "abc");
    expect(p).toMatchObject({ _id: "custom:abc", code: "", name: chapa.name, category: CUSTOM_CATEGORY, custom: true, unitType: "pieza", price: 385.5 });
    expect(isCustomProduct(p)).toBe(true);
    expect(isCustomProduct({ _id: "65f0c0ffee0000000000abcd" })).toBe(false);
  });

  it("dos productos fuera de catálogo nunca se suman en un mismo renglón", () => {
    const line = (id: string) => {
      const product = customProduct(chapa, "pieza", id);
      return { key: id, product, input: { mode: "pieza" as const, qty: 1 } };
    };
    const { cart, mergedInto } = upsertLine([line("a")], line("b"), (l) => l);
    expect(mergedInto).toBeNull();
    expect(cart).toHaveLength(2);
  });
});

describe("producto fuera de catálogo: lo que viaja al servidor", () => {
  it("manda sus datos en lugar de un id de producto", () => {
    const product = customProduct({ ...chapa, unitLabel: "juego" }, "pieza", "abc");
    expect(lineToPayload({ product, input: { mode: "pieza", qty: 2 } })).toEqual({ custom: { name: chapa.name, price: 385.5, unitLabel: "juego" }, mode: "pieza", qty: 2 });
  });

  it("un producto del catálogo sigue viajando por su id", () => {
    const product = { _id: "65f0c0ffee0000000000abcd", code: "HE-104", name: "Disco", category: "Herrajes", unitType: "pieza", price: 50, active: true } as ProductJSON;
    expect(lineToPayload({ product, input: { mode: "pieza", qty: 1 } })).toEqual({ productId: product._id, mode: "pieza", qty: 1 });
  });

  it("el servidor acepta el renglón y limpia el nombre", () => {
    const r = LineInputSchema.parse({ custom: { name: "  Chapa especial  ", price: "385.50" }, mode: "pieza", qty: 2 });
    expect(r.custom).toEqual({ name: "Chapa especial", price: 385.5 });
  });

  it("rechaza renglones sin producto, con los dos, sin precio o por tira", () => {
    const bad = (line: unknown) => expect(LineInputSchema.safeParse(line).success, JSON.stringify(line)).toBe(false);
    bad({ mode: "pieza", qty: 1 });
    bad({ productId: "65f0c0ffee0000000000abcd", custom: chapa, mode: "pieza", qty: 1 });
    bad({ custom: { name: "Chapa", price: 0 }, mode: "pieza", qty: 1 });
    bad({ custom: { name: "Chapa", price: -5 }, mode: "pieza", qty: 1 });
    bad({ custom: { name: "C", price: 10 }, mode: "pieza", qty: 1 });
    bad({ custom: chapa, mode: "tira", qty: 1, barLengthM: 6 });
    bad({ custom: chapa, mode: "pieza", qty: 0 });
  });

  it("una venta puede mezclar productos del catálogo y fuera de catálogo", () => {
    const r = SaleInput.safeParse({ kind: "venta", paymentMethod: "efectivo", items: [{ productId: "65f0c0ffee0000000000abcd", mode: "pieza", qty: 1 }, { custom: chapa, mode: "pieza", qty: 1 }] });
    expect(r.success).toBe(true);
  });
});

describe("producto fuera de catálogo: de una cotización guardada de vuelta al carrito", () => {
  it("recupera nombre, precio de lista y unidad", () => {
    expect(customFromStored({ name: "Chapa especial", mode: "pieza", detail: "juego", unitPrice: 400, listUnitPrice: 385.5 })).toEqual({ name: "Chapa especial", price: 385.5, unitLabel: "juego" });
    expect(customFromStored({ name: "Felpa rara", mode: "metro", detail: "m", unitPrice: 12 })).toEqual({ name: "Felpa rara", price: 12, unitLabel: undefined });
  });
});
