import { describe, expect, it } from "vitest";
import { productSearchFilter, productTermRegex } from "@/lib/productSearch";

/** ¿La palabra buscada encuentra este texto del catálogo? (false también si la palabra no aplica a ese campo) */
const finds = (term: string, text: string, field: "text" | "code" = "text") => productTermRegex(term, field)?.test(text) ?? false;

describe("búsqueda de productos: caracteres especiales", () => {
  it("ignora acentos y ñ en ambos sentidos", () => {
    expect(finds("angulo", 'Ángulo 1" Blanco')).toBe(true);
    expect(finds("silicon", "Silicón 100% uso general")).toBe(true);
    expect(finds("linea", 'Línea 3"')).toBe(true);
    expect(finds("bano", "Perfil aleta suave 6 mm (cancel de baño)")).toBe(true);
    expect(finds("baño", "Cancel de bano")).toBe(true);
    expect(finds("ÁNGULO", "angulo 1")).toBe(true);
  });

  it("acepta cualquier comilla de pulgadas", () => {
    for (const q of ['3/4"', "3/4''", "3/4”", "3/4″", "3/4´´", "3/4"]) expect(finds(q, 'Batiente 3/4" Blanco'), q).toBe(true);
    for (const q of ['3"', "3''", "3”"]) expect(finds(q, 'Cabezal 3" Negro'), q).toBe(true);
  });

  it("la comilla después de un número sí cuenta: no trae todo lo que tenga ese número", () => {
    expect(finds('3"', 'Cabezal 2" Blanco')).toBe(false);
    expect(finds('3"', "Riel inferior Serie 35")).toBe(false);
    expect(finds('3"', "AL-036-BCO", "code")).toBe(false);
  });

  it("encuentra el signo × escrito como x, * o sin espacios", () => {
    expect(finds("10x2", "Pija 10 × 2 plana")).toBe(true);
    expect(finds("10*2", "Pija 10 × 2 plana")).toBe(true);
    expect(finds("3x21", "Lija de banda 3 × 21 grano 180")).toBe(true);
    expect(finds("3×21", "Lija de banda 3x21 grano 180")).toBe(true);
  });

  it("junta o separa letras y números", () => {
    expect(finds("claro6", "Cristal claro 6 mm")).toBe(true);
    expect(finds("6mm", "Cristal claro 6 mm")).toBe(true);
    expect(finds("serie-35", "Riel inferior Serie 35")).toBe(true);
  });

  it("acepta coma o punto en las medidas", () => {
    expect(finds("1,20", "Tensor 1.20 m 3/8")).toBe(true);
    expect(finds("1.20", "Tensor 1,20 m")).toBe(true);
  });

  it("encuentra códigos sin guiones", () => {
    expect(finds("he104", "HE-104", "code")).toBe(true);
    expect(finds("al072nat", "AL-072-NAT", "code")).toBe(true);
    expect(finds("AL 072", "AL-072-NAT", "code")).toBe(true);
    expect(finds("he-104", "HE104", "code")).toBe(true);
  });

  it("no afloja de más: los números pegados siguen pegados", () => {
    expect(finds("12", 'Disco de corte 4 1/2"')).toBe(false);
    expect(finds("120", "Tensor 1.20 m 3/8")).toBe(false);
    expect(finds("34", 'Batiente 3/4"')).toBe(false);
    expect(finds("104", "HE-10-4", "code")).toBe(false);
  });

  it("un símbolo escrito entre dos números exige algún símbolo en el producto", () => {
    expect(finds("3/4", "Serie 34")).toBe(false);
    expect(finds("3/4", 'Traslape 3" 460 Natural')).toBe(false);
    expect(finds("3/4", "AL-003-460", "code")).toBe(false);
    expect(finds("3/4", "Tapón de plástico 3-4")).toBe(true);
    expect(finds("3+3", "Vidrio inastillable 3 + 3 mm")).toBe(true);
  });

  it("no junta letras de palabras distintas en el nombre", () => {
    expect(finds("sal", "Perfiles aluminio")).toBe(false);
  });

  it("los símbolos de expresiones regulares se toman como texto", () => {
    expect(finds("(paquete", "Escuadra mosquitero (paquete 10 pzas)")).toBe(true);
    expect(finds("paquete)", "Escuadra mosquitero (paquete 10 pzas)")).toBe(true);
    expect(finds("100%", "Silicón 100% uso general")).toBe(true);
    expect(finds("100%", "HE-100", "code")).toBe(false);
    expect(productTermRegex(".*")).toBeNull();
    expect(productTermRegex('"')).toBeNull();
  });
});

describe("productSearchFilter", () => {
  const fields = (clause: unknown) => (clause as { $or: Record<string, RegExp>[] }).$or.map((c) => Object.keys(c)[0]).sort();

  it("arma una condición por palabra y descarta las que solo traen símbolos", () => {
    expect(productSearchFilter('cabezal 2" - natural')).toHaveLength(3);
    expect(productSearchFilter(' " ')).toEqual([]);
    expect(productSearchFilter("")).toEqual([]);
    expect(productSearchFilter(undefined)).toEqual([]);
  });

  it("busca cada palabra en nombre, grupo, código, categoría, línea y color", () => {
    expect(fields(productSearchFilter("angulo")[0])).toEqual(["category", "code", "color", "group", "line", "name"]);
  });

  it("una medida en pulgadas no se busca en el código", () => {
    expect(fields(productSearchFilter('3/4"')[0])).toEqual(["category", "color", "group", "line", "name"]);
  });
});
