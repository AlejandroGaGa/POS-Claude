import { describe, expect, it } from "vitest";
import { adjustPrice, availableModes, computeTotals, priceLine, PricingError, type ProductPricing } from "@/lib/pricing";
import { parseCsv, rowToProduct } from "@/lib/csvImport";

const perfil: ProductPricing = {
  unitType: "perfil",
  pricePerMeter: 95,
  bars: [
    { lengthM: 6, price: 520 },
    { lengthM: 3.6, price: 330 },
    { lengthM: 4.6, price: 410 },
  ],
  minCutM: 0.5,
};
const vidrio: ProductPricing = {
  unitType: "vidrio",
  pricePerM2: 650,
  pricePerM2Vidriero: 450,
  sheets: [
    { widthM: 1.8, heightM: 2.6, price: 1380 },
    { widthM: 2.3, heightM: 2.6, price: 1795 },
    { widthM: 3.6, heightM: 2.6, price: 2760 },
  ],
};

describe("priceLine", () => {
  it("pieza", () => {
    expect(priceLine({ unitType: "pieza", price: 35.5 }, { mode: "pieza", qty: 3 })).toMatchObject({ unitPrice: 35.5, subtotal: 106.5 });
  });

  it("pieza rechaza fracciones", () => {
    expect(() => priceLine({ unitType: "pieza", price: 10 }, { mode: "pieza", qty: 1.5 })).toThrow(PricingError);
  });

  it("kilos con decimales", () => {
    expect(priceLine({ unitType: "kg", price: 120 }, { mode: "kg", qty: 2.75 }).subtotal).toBe(330);
  });

  it("tira completa usa el precio de la tira", () => {
    expect(priceLine(perfil, { mode: "tira", qty: 2, barLengthM: 3.6 })).toMatchObject({ unitPrice: 330, subtotal: 660 });
  });

  it("tira con largo inexistente falla", () => {
    expect(() => priceLine(perfil, { mode: "tira", qty: 1, barLengthM: 5 })).toThrow(/largo de tira/);
  });

  it("tramo = metros × precio por metro", () => {
    expect(priceLine(perfil, { mode: "tramo", qty: 2, lengthM: 1.25 })).toMatchObject({ unitPrice: 118.75, subtotal: 237.5 });
  });

  it("tramo mínimo 50 cm", () => {
    expect(() => priceLine(perfil, { mode: "tramo", qty: 1, lengthM: 0.49 })).toThrow(/50 cm/);
    expect(priceLine(perfil, { mode: "tramo", qty: 1, lengthM: 0.5 }).subtotal).toBe(47.5);
  });

  it("tramo no puede exceder la tira más larga", () => {
    expect(() => priceLine(perfil, { mode: "tramo", qty: 1, lengthM: 6.1 })).toThrow(/tira más larga/);
  });

  it("vidrio por medida: particular por defecto", () => {
    // 0.80 × 1.20 = 0.96 m² × 650 = 624
    expect(priceLine(vidrio, { mode: "m2", qty: 2, widthM: 0.8, heightM: 1.2 })).toMatchObject({ unitPrice: 624, subtotal: 1248 });
  });

  it("vidrio por medida: precio vidriero", () => {
    // 0.96 m² × 450 = 432
    expect(priceLine(vidrio, { mode: "m2", qty: 1, widthM: 0.8, heightM: 1.2 }, { customerType: "vidriero" }).unitPrice).toBe(432);
  });

  it("vidriero sin precio propio usa el de particular", () => {
    const p: ProductPricing = { unitType: "vidrio", pricePerM2: 295 };
    expect(priceLine(p, { mode: "m2", qty: 1, widthM: 1, heightM: 1 }, { customerType: "vidriero" }).unitPrice).toBe(295);
  });

  it("vidrio: la medida debe caber en alguna hoja (girada también)", () => {
    expect(() => priceLine(vidrio, { mode: "m2", qty: 1, widthM: 2.5, heightM: 1.7 })).not.toThrow();
    expect(() => priceLine(vidrio, { mode: "m2", qty: 1, widthM: 3.2, heightM: 2.5 })).not.toThrow(); // cabe en 3.60×2.60
    expect(() => priceLine(vidrio, { mode: "m2", qty: 1, widthM: 3.7, heightM: 1 })).toThrow(/hoja más grande/);
  });

  it("hoja completa: elige el tamaño", () => {
    expect(priceLine(vidrio, { mode: "hoja", qty: 1, widthM: 2.3, heightM: 2.6 }).subtotal).toBe(1795);
    expect(() => priceLine(vidrio, { mode: "hoja", qty: 1 })).toThrow(/tamaño/);
    const una: ProductPricing = { unitType: "vidrio", sheets: [{ widthM: 1.8, heightM: 2.6, price: 745 }] };
    expect(priceLine(una, { mode: "hoja", qty: 2 }).subtotal).toBe(1490);
  });

  it("modo no disponible", () => {
    expect(() => priceLine({ unitType: "pieza", price: 5 }, { mode: "kg", qty: 1 })).toThrow(PricingError);
  });
});

describe("availableModes", () => {
  it("solo ofrece lo que tiene precio", () => {
    expect(availableModes(perfil)).toEqual(["tira", "tramo"]);
    expect(availableModes({ unitType: "perfil", pricePerMeter: 90 })).toEqual(["tramo"]);
    expect(availableModes({ unitType: "vidrio", pricePerM2: 300 })).toEqual(["m2"]);
    expect(availableModes({ unitType: "vidrio", sheets: [{ widthM: 0.7, heightM: 1.8, price: 292 }] })).toEqual(["hoja"]);
    expect(availableModes({ unitType: "pieza", price: null })).toEqual([]);
  });
});

describe("computeTotals", () => {
  const lines = [{ subtotal: 1000 }, { subtotal: 250.5 }];
  it("efectivo y transferencia sin comisión", () => {
    expect(computeTotals(lines, "efectivo", 5)).toEqual({ subtotal: 1250.5, commissionPct: 0, commissionAmount: 0, total: 1250.5 });
    expect(computeTotals(lines, "transferencia", 5).total).toBe(1250.5);
  });
  it("terminal aplica la comisión sobre el total", () => {
    expect(computeTotals(lines, "terminal", 4.6)).toEqual({ subtotal: 1250.5, commissionPct: 4.6, commissionAmount: 57.52, total: 1308.02 });
  });
  it("rechaza comisiones fuera de rango", () => {
    expect(() => computeTotals(lines, "terminal", 25)).toThrow(PricingError);
  });
});

describe("adjustPrice", () => {
  it("sube 10% y redondea", () => {
    expect(adjustPrice(95, 10, 0)).toBe(104.5);
    expect(adjustPrice(95, 10, 1)).toBe(105);
    expect(adjustPrice(95, 10, 0.5)).toBe(104.5);
  });
});

describe("CSV", () => {
  it("lee comas, punto y coma y comillas", () => {
    const rows = parseCsv('codigo;nombre;tipo;precio\nA-1;"Bisagra; grande";pieza;12,5\n');
    expect(rows[0]).toEqual({ codigo: "A-1", nombre: "Bisagra; grande", tipo: "pieza", precio: "12,5" });
    expect(rowToProduct(rows[0], 2).data).toMatchObject({ code: "A-1", price: 12.5 });
  });
  it("tiras y hoja", () => {
    const [r] = parseCsv("codigo,nombre,tipo,precio_metro,tiras,precio_m2,hoja\nP1,Perfil,perfil,95,6:520|3.6:330,,\n");
    expect(rowToProduct(r, 2).data).toMatchObject({ unitType: "perfil", pricePerMeter: 95, bars: [{ lengthM: 6, price: 520 }, { lengthM: 3.6, price: 330 }] });
    const [v] = parseCsv("codigo,nombre,tipo,precio_m2,precio_m2_vidriero,hojas\nV1,Cristal,vidrio,650,450,1.80x2.60:1380|2.30x2.60:1795\n");
    expect(rowToProduct(v, 2).data).toMatchObject({
      pricePerM2: 650,
      pricePerM2Vidriero: 450,
      sheets: [
        { widthM: 1.8, heightM: 2.6, price: 1380 },
        { widthM: 2.3, heightM: 2.6, price: 1795 },
      ],
    });
    // formato anterior (columna "hoja")
    const [old] = parseCsv("codigo,nombre,tipo,hoja\nV2,Cristal,vidrio,1.80x2.60:2100\n");
    expect(rowToProduct(old, 2).data).toMatchObject({ sheets: [{ widthM: 1.8, heightM: 2.6, price: 2100 }] });
  });
  it("permite comillas de pulgadas dentro del texto", () => {
    const [r] = parseCsv('codigo,nombre,tipo,precio\nP1,Cabezal 2",pieza,10\n');
    expect(r).toMatchObject({ nombre: 'Cabezal 2"', precio: "10" });
  });
  it("reporta errores por renglón", () => {
    const [r] = parseCsv("codigo,nombre,tipo\nX,Algo,litro\n");
    expect(rowToProduct(r, 2).error).toMatch(/tipo/);
  });
  it("precios con miles y signo de pesos", () => {
    const [r] = parseCsv('codigo,nombre,tipo,precio\nX,Algo,pieza,"$1,250.50"\n');
    expect(rowToProduct(r, 2).data).toMatchObject({ price: 1250.5 });
  });
});
