/**
 * Importación de la lista de precios desde CSV (sirve igual para Excel → "Guardar como CSV").
 *
 * Columnas (encabezados en la primera fila, en cualquier orden):
 *   codigo, nombre, grupo, categoria, linea, color, tipo, unidad, precio,
 *   precio_metro, tiras, tramo_minimo_m, precio_m2, precio_m2_vidriero, hojas, notas
 *
 *   tipo:   pieza | kg | metro | perfil | vidrio
 *   grupo:  nombre común de las variantes (p. ej. el mismo perfil en varios colores); el
 *           mostrador las muestra en una sola tarjeta y el vendedor elige el color.
 *   tiras:  "6.10:850|4.60:650"              (largo en metros : precio de la tira)
 *   hojas:  "1.80x2.60:1380|2.30x2.60:1795"  (base x altura en metros : precio de la hoja)
 */
import { UNIT_TYPES, type UnitType } from "./pricing";

export const CSV_HEADERS = [
  "codigo",
  "nombre",
  "grupo",
  "categoria",
  "linea",
  "color",
  "tipo",
  "unidad",
  "precio",
  "precio_metro",
  "tiras",
  "tramo_minimo_m",
  "precio_m2",
  "precio_m2_vidriero",
  "hojas",
  "notas",
] as const;

/** Parser CSV pequeño con soporte de comillas y separador , o ; (Excel en español usa ;). */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true; // comilla solo abre al inicio del campo (permite 2" en el texto)
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map((h) =>
    h
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "_"),
  );
  return nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function toNum(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.replace(/[$\s]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export interface ImportRow {
  line: number;
  data?: Record<string, unknown>;
  error?: string;
}

/** Convierte un renglón del CSV en el objeto que espera la API de productos. */
export function rowToProduct(r: Record<string, string>, line: number): ImportRow {
  try {
    const tipo = (r.tipo || "pieza").toLowerCase() as UnitType;
    if (!UNIT_TYPES.includes(tipo)) throw new Error(`tipo "${r.tipo}" no válido (usa ${UNIT_TYPES.join(", ")})`);
    if (!r.codigo) throw new Error("falta el código");
    if (!r.nombre) throw new Error("falta el nombre");

    const bars = (r.tiras || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [len, price] = s.split(":");
        const lengthM = toNum(len);
        const p = toNum(price);
        if (!lengthM || !Number.isFinite(lengthM) || p === null || !Number.isFinite(p)) throw new Error(`tira "${s}" mal escrita (ej. 6:850)`);
        return { lengthM, price: p };
      });

    // "hojas" (o "hoja", formato anterior): uno o varios tamaños separados por |
    const sheets = (r.hojas || r.hoja || "")
      .split("|")
      .map((x) => x.replace(/\s/g, ""))
      .filter(Boolean)
      .map((x) => {
        const m = x.match(/^([\d.,]+)[x×*]([\d.,]+):\$?([\d.,]+)$/i);
        if (!m) throw new Error(`hoja "${x}" mal escrita (ej. 1.80x2.60:1450)`);
        return { widthM: toNum(m[1])!, heightM: toNum(m[2])!, price: toNum(m[3])! };
      });

    const nums = {
      precio: toNum(r.precio),
      precio_metro: toNum(r.precio_metro),
      precio_m2: toNum(r.precio_m2),
      precio_m2_vidriero: toNum(r.precio_m2_vidriero),
      tramo: toNum(r.tramo_minimo_m),
    };
    for (const [k, v] of Object.entries(nums)) if (Number.isNaN(v)) throw new Error(`${k} no es un número`);

    return {
      line,
      data: {
        code: r.codigo,
        name: r.nombre,
        group: r.grupo || "",
        category: r.categoria || "General",
        line: r.linea || "",
        color: r.color || "",
        unitType: tipo,
        unitLabel: r.unidad || (tipo === "kg" ? "kg" : tipo === "metro" ? "m" : "pza"),
        price: nums.precio,
        pricePerMeter: nums.precio_metro,
        bars,
        minCutM: nums.tramo ?? 0.5,
        pricePerM2: nums.precio_m2,
        pricePerM2Vidriero: nums.precio_m2_vidriero,
        sheets,
        notes: r.notas || "",
        active: true,
      },
    };
  } catch (e) {
    return { line, error: (e as Error).message };
  }
}

export const CSV_EXAMPLE = `codigo,nombre,grupo,categoria,linea,color,tipo,unidad,precio,precio_metro,tiras,tramo_minimo_m,precio_m2,precio_m2_vidriero,hojas,notas
JAL-001,Jaladera de concha,,Herrajes,,,pieza,pza,35,,,,,,,
ESM-100,Esmeril grano 100,,Abrasivos,,,kg,kg,120,,,,,,,
FEL-01,Felpa 5mm,,Accesorios,,Gris,metro,m,6.5,,,,,,,
PER-2C-BCO,"Cabezal 2"" Blanco","Cabezal 2""",Aluminio,Línea 2",Blanco,perfil,tira,,60,6.10:277,0.5,,,,
PER-2C-NEG,"Cabezal 2"" Negro","Cabezal 2""",Aluminio,Línea 2",Negro,perfil,tira,,66,6.10:346,0.5,,,,
CLA-6,Cristal claro 6 mm,,Vidrio,,Claro,vidrio,hoja,,,,,650,450,1.80x2.60:1380|2.30x2.60:1795,`;
