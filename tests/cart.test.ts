import { describe, expect, it } from "vitest";
import { upsertLine, type MergeableLine } from "@/lib/cart";

type L = MergeableLine & { subtotal: number };
const reprice = (l: L): L => ({ ...l, subtotal: l.input.qty * 10 });
const line = (key: string, id: string, input: L["input"]): L => ({ key, product: { _id: id }, input, subtotal: input.qty * 10 });

describe("upsertLine", () => {
  it("suma la cantidad si es el mismo producto y forma", () => {
    const { cart, mergedInto } = upsertLine([line("a", "p1", { mode: "pieza", qty: 2 })], line("b", "p1", { mode: "pieza", qty: 3 }), reprice);
    expect(cart).toHaveLength(1);
    expect(mergedInto).toBe("a");
    expect(cart[0]).toMatchObject({ key: "a", input: { qty: 5 }, subtotal: 50 });
  });
  it("no mezcla medidas distintas (tira 6.10 vs 4.60, tramos de distinto largo)", () => {
    let c = upsertLine([line("a", "p1", { mode: "tira", qty: 1, barLengthM: 6.1 })], line("b", "p1", { mode: "tira", qty: 1, barLengthM: 4.6 }), reprice).cart;
    expect(c).toHaveLength(2);
    c = upsertLine([line("a", "p1", { mode: "tramo", qty: 1, lengthM: 1.2 })], line("b", "p1", { mode: "tramo", qty: 2, lengthM: 1.2 }), reprice).cart;
    expect(c).toHaveLength(1);
    expect(c[0].input.qty).toBe(3);
  });
  it("no mezcla productos distintos ni formas distintas", () => {
    expect(upsertLine([line("a", "p1", { mode: "pieza", qty: 1 })], line("b", "p2", { mode: "pieza", qty: 1 }), reprice).cart).toHaveLength(2);
    expect(upsertLine([line("a", "p1", { mode: "tira", qty: 1, barLengthM: 6.1 })], line("b", "p1", { mode: "tramo", qty: 1, lengthM: 1 }), reprice).cart).toHaveLength(2);
  });
  it("al editar un renglón hasta igualar otro, se funden en uno", () => {
    const start = [line("a", "p1", { mode: "pieza", qty: 1 }), line("b", "p1", { mode: "kg", qty: 1 })];
    const { cart } = upsertLine(start, line("b", "p1", { mode: "pieza", qty: 4 }), reprice);
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ key: "a", input: { qty: 5 } });
  });
  it("editar sin coincidencia solo reemplaza", () => {
    const { cart, mergedInto } = upsertLine([line("a", "p1", { mode: "pieza", qty: 1 })], line("a", "p1", { mode: "pieza", qty: 7 }), reprice);
    expect(mergedInto).toBeNull();
    expect(cart[0].input.qty).toBe(7);
  });
  it("suma kilos con decimales sin errores de redondeo", () => {
    const { cart } = upsertLine([line("a", "p1", { mode: "kg", qty: 0.1 })], line("b", "p1", { mode: "kg", qty: 0.2 }), reprice);
    expect(cart[0].input.qty).toBe(0.3);
  });
});
