/**
 * Búsqueda de productos tolerante con los caracteres especiales: quien busca no tiene que
 * escribir acentos, comillas de pulgadas, guiones ni el signo × igual que en el catálogo.
 *
 *   angulo      → Ángulo 1"                 (acentos y ñ)
 *   3/4''  3/4” → Batiente 3/4"             (cualquier comilla de pulgadas)
 *   10x2, 10*2  → Pija 10 × 2 plana         (× escrito como x, * o sin espacios)
 *   claro6      → Cristal claro 6 mm        (letra y número pegados)
 *   he104       → HE-104                    (códigos sin guiones)
 *   1,20        → Tensor 1.20 m             (coma o punto)
 *
 * Lo que sí se respeta, para no llenar la lista de resultados que no vienen al caso:
 * - Dos números pegados siguen pegados: "12" no encuentra 1/2".
 * - Un símbolo escrito entre dos números exige algún símbolo ahí: "3/4" no encuentra "34" ni 3" 460.
 * - La comilla después de un número sí cuenta: 3" encuentra Cabezal 3", no todo lo que tenga un 3.
 *
 * Solo arma expresiones regulares; no cambia nada en la base de datos.
 */

/** Letra sin acento → todas las formas en que puede estar escrita en el catálogo. */
const VARIANTS: Record<string, string> = { a: "aáàäâã", e: "eéèëê", i: "iíìïî", o: "oóòöôõ", u: "uúùüû", n: "nñ", c: "cç", x: "x×" };
const ACCENTED = "áàäâãéèëêíìïîóòöôõúùüûñç";
const ALNUM = `a-zA-Z0-9${ACCENTED}${ACCENTED.toUpperCase()}`;
/** Comillas con las que se escriben las pulgadas: " '' ” ″ ´´ … */
const QUOTE_CHARS = "\"'“”″′´’‘`";
const QUOTES = `[${QUOTE_CHARS}]{1,2}`;
/** Un carácter que no es letra ni número: espacio, guion, comillas, diagonal, ×, paréntesis, punto… */
const SEP = `[^${ALNUM}]`;
/** Un símbolo: ni letra, ni número, ni espacio, ni comilla (/ - . , × * + % …). */
const SYM = `[^${ALNUM}\\s${QUOTE_CHARS}]`;

type Segment = { kind: "letter" | "digit"; ch: string } | { kind: "special"; raw: string };

/** Parte el término en letras, números y tramos de caracteres especiales (sin acentos, en minúsculas). */
function segments(term: string): Segment[] {
  const plain = term
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // quita los acentos ya separados de su letra
    .toLowerCase()
    .replace(/×/g, "x"); // el signo × cuenta como la letra x (que a su vez encuentra ×)
  const out: Segment[] = [];
  for (const ch of plain) {
    if (ch >= "a" && ch <= "z") out.push({ kind: "letter", ch });
    else if (ch >= "0" && ch <= "9") out.push({ kind: "digit", ch });
    else {
      const last = out[out.length - 1];
      if (last?.kind === "special") last.raw += ch;
      else out.push({ kind: "special", raw: ch });
    }
  }
  return out;
}

const letterClass = (ch: string) => {
  const v = VARIANTS[ch];
  return v ? `[${v}${v.toUpperCase()}]` : ch;
};
const hasQuote = (raw: string) => [...raw].some((c) => QUOTE_CHARS.includes(c));

/**
 * Expresión regular para una palabra de la búsqueda, o `null` si no aplica.
 * - `text`: nombre, grupo, categoría, línea y color.
 * - `code`: el código; ahí además se ignoran los guiones entre letras ("al072nat" → AL-072-NAT),
 *   y no se busca si la palabra trae símbolos que un código no lleva (comillas, /, %, …).
 */
export function productTermRegex(term: string, field: "text" | "code" = "text"): RegExp | null {
  const segs = segments(term);
  while (segs[0]?.kind === "special") segs.shift(); // lo especial al inicio no aporta
  if (!segs.length) return null;
  if (field === "code" && segs.some((s) => s.kind === "special" && /[^\s._-]/.test(s.raw))) return null;

  let src = "";
  segs.forEach((s, i) => {
    const prev = segs[i - 1];
    const next = segs[i + 1];
    if (s.kind === "special") {
      const afterDigit = prev?.kind === "digit";
      if (afterDigit && hasQuote(s.raw)) src += QUOTES + (next ? `${SEP}*` : ""); // pulgadas: 3" = 3'' = 3”
      else if (afterDigit && next?.kind === "digit") src += `\\s*${SYM}+\\s*`; // 3/4, 1,20, 10*2, 3 + 3
      else if (afterDigit && !next) src += `${SYM}+`; // 100%
      else if (next) src += `${SEP}*`; // he-104, serie-35
      return; // al final, después de una letra, se ignora
    }
    // Dos caracteres seguidos sin nada escrito en medio: entre letra y número (o entre letras de un código) puede haber separadores.
    if (prev && prev.kind !== "special" && (prev.kind !== s.kind || (field === "code" && s.kind === "letter"))) src += `${SEP}*`;
    src += s.kind === "letter" ? letterClass(s.ch) : s.ch;
  });
  return new RegExp(src, "i");
}

const TEXT_FIELDS = ["name", "group", "category", "line", "color"] as const;

/**
 * Condiciones `$and` de MongoDB para buscar productos: cada palabra debe aparecer en el
 * nombre, grupo, código, categoría, línea o color. Devuelve `[]` si no hay nada que buscar.
 */
export function productSearchFilter(q: string | null | undefined): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = [];
  for (const term of (q ?? "").trim().split(/\s+/)) {
    const text = productTermRegex(term, "text");
    if (!text) continue;
    const code = productTermRegex(term, "code");
    clauses.push({ $or: [...TEXT_FIELDS.map((f) => ({ [f]: text })), ...(code ? [{ code }] : [])] });
  }
  return clauses;
}
