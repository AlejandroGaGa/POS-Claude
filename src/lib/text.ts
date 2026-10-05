export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ACCENTS: Record<string, string> = { a: "aáàäâ", e: "eéèëê", i: "iíìïî", o: "oóòöô", u: "uúùüû", n: "nñ" };

/**
 * Regex «flexible» para buscar personas: ignora acentos y mayúsculas, y si el texto son
 * dígitos (teléfono) permite espacios o guiones entre ellos: "5512" encuentra "55 12…".
 */
export function looseRegex(q: string): RegExp {
  const t = q.trim();
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 4 && digits.length === t.replace(/[\s()+-]/g, "").length) {
    return new RegExp(digits.split("").join("\\D*"));
  }
  const body = t
    .toLowerCase()
    .split("")
    .map((ch) => {
      const base = Object.keys(ACCENTS).find((k) => ACCENTS[k].includes(ch));
      return base ? `[${ACCENTS[base]}]` : escapeRegex(ch);
    })
    .join("")
    .replace(/\s+/g, "\\s+");
  return new RegExp(body, "i");
}
