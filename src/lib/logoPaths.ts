/**
 * Logotipo SIAC en vectorial (lienzo de 970 × 245). Lo usan <Logo>, el ícono de la pestaña
 * y el PDF de la nota, para que en todos lados salga el mismo dibujo.
 */
export const LOGO_W = 970;
export const LOGO_H = 245;

/** Colores del logotipo. */
export const LOGO_INK_HEX = "#2e333a";
export const LOGO_GLASS_HEX = "#81a0b8";
export const LOGO_GLASS_LIGHT_HEX = "#8daac0";

const S =
  "M 254.4 14 H 66.4 C 41.8 16.6 22.5 27.4 10.9 45 C -5.6 70.3 -2.3 107.3 18.2 128.6 " +
  "C 31.2 142 50 150.2 70.6 151.6 H 186.4 C 214.4 157.5 214.1 193.5 188.5 200 H 2.5 V 244.5 H 194.2 " +
  "C 225.7 241 247.8 224.1 256.4 197.2 C 262.2 179.5 260.3 155.9 251.9 140.5 " +
  "C 243.9 125.7 228.6 113.2 212.4 108.4 C 203 105 196 103.6 186 103.6 H 72.9 " +
  "C 55.2 99 49 83.9 54.3 71.3 C 57.1 64.7 64.7 59.2 72.5 57.6 H 254.4 Z";
const I = "M 297 14 H 350 V 244.5 H 297 Z";
/** La "A" sin travesaño (también es el ícono de la pestaña). */
export const LOGO_A = "M 371 244.5 L 539 0 L 705.5 244.5 H 647.5 L 539 79 L 427.5 244.5 Z";
const C =
  "M 969.5 14 H 823.9 C 761.3 18.8 713 66.2 708.1 127.9 C 704.2 176.8 730.6 218.5 776.1 235.3 " +
  "C 791.5 241 804.3 243.5 826.6 244.5 H 969.5 V 200 H 821.6 C 782.2 195 756.2 168 756.2 131.6 " +
  "C 756.2 93.2 786.8 61.4 827.1 57.6 H 969.5 Z";

/** Las cuatro letras. */
export const LOGO_INK = `${S} ${I} ${LOGO_A} ${C}`;
/** El cristal dentro de la "A" y su faceta clara. */
export const LOGO_GLASS = "M 502 170 L 562 129.5 V 244.5 H 502 Z";
export const LOGO_GLASS_FACET = "M 502 170 L 562 129.5 L 502 244.5 Z";
