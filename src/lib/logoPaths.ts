/**
 * Logotipo SIAC en vectorial. Todas las rutas comparten el mismo lienzo (el del arte original),
 * así que cada pieza se recorta con su `viewBox`. Lo usan <Logo>, el ícono de la pestaña y el
 * PDF de la nota, para que en todos lados salga el mismo dibujo.
 */

/** Recuadros `[x, y, ancho, alto]` dentro del lienzo. */
export const ICON_BOX = [330, 208, 586, 394] as const; // edificios + arco
export const WORDMARK_BOX = [194, 650, 852, 187] as const; // letras SIAC
export const STACKED_BOX = [136, 205, 984, 790] as const; // logotipo completo con lema

/** Colores del logotipo (tema claro). */
export const LOGO_GREEN_HEX = "#0e5034";
export const LOGO_PANEL_HEX = "#145a3e";
export const LOGO_PANEL_LIGHT_HEX = "#2f7556";
export const LOGO_GLASS_HEX = "#878a86";
export const LOGO_TEXT_HEX = "#3e464b";

/** Contornos de los tres edificios. */
export const LOGO_TOWER = "M 557 260.5 L 634.8 212 V 569 H 624.8 V 231.8 L 565.5 266.2 V 277.8 L 557 282.2 Z";
export const LOGO_RIGHT = "M 650.5 304.8 L 736 358.8 V 572 L 724.5 571 V 365.2 L 650.5 315.2 Z";
export const LOGO_FAR = "M 749.2 407.5 L 802.5 442.2 V 579.5 L 794 578.5 V 446.8 L 749.2 415.8 Z";
export const LOGO_OUTLINES = `${LOGO_TOWER} ${LOGO_RIGHT} ${LOGO_FAR}`;
/** Arco bajo los edificios. */
export const LOGO_ARC = "M 333.5 598 Q 623 539 912.5 597.5 Q 623 570 333.5 598 Z";
/** Fachada verde (con su faceta clara) y cristal gris. */
export const LOGO_PANEL = "M 564.5 290 L 463.5 358 V 569 L 564.5 561 Z";
export const LOGO_PANEL_FACET = "M 463.5 358 L 564.5 290 L 463.5 505 Z";
export const LOGO_GLASS = "M 665.5 354.5 L 704.5 380.5 V 563 L 665.5 560.5 Z";

const S =
  "M 300 833 C 308 832.2 310.1 831.8 318.8 829.6 C 352.1 820.8 369.9 798.5 362.2 774.8 C 358.4 762.8 347.2 754 326 746.4 " +
  "C 321.2 744.6 307.6 740.8 300.5 739.3 C 291.1 737.2 275.8 733.5 268.7 731.7 C 233.7 722.8 219 711.5 220.8 694.8 " +
  "C 222.6 677.2 240.3 664.8 269 661.1 C 293.9 657.9 320.8 663.8 342.4 677.4 C 345.7 679.5 345.9 679.5 347.7 677.2 " +
  "C 348.5 676.2 349.6 674.7 350.3 673.9 C 352.3 671.4 352.3 671.5 346 667.8 C 327.5 657.1 307.7 652.1 283.4 652.2 " +
  "C 236.2 652.3 203.2 674.2 207.6 702.4 C 210.8 722.3 227.7 732.5 275.8 743.2 C 284.9 745.2 300.8 749.1 306 750.7 " +
  "C 337.1 759.7 349.6 769.8 349.6 785.9 C 349.5 818.6 295.3 835.7 245.2 818.7 C 230.8 813.9 218.2 806.8 207.1 797.3 " +
  "C 203.1 794 203.5 794 199.7 797.7 C 195.6 801.7 195.5 801.3 201.6 806.2 C 227.2 826.6 263.7 836.6 300 833 Z";
const I = "M 460.5 654 H 471.5 V 831 H 460.5 Z";
const A = "M 557 831 L 667 654 L 777 831 H 764 L 667 675 L 570 831 Z";
const C =
  "M 968.6 833.9 C 998.3 830.9 1023.3 819 1040.6 799.6 C 1044.1 795.7 1044.1 796.1 1039.6 792.9 C 1034.2 789.3 1034.6 789.3 1032 792.6 " +
  "C 1009.7 820.5 968.1 832 922.5 822.9 C 886.7 815.7 858.9 790.8 852.6 760.4 C 844.1 718.9 871.3 678.5 916.5 665.4 " +
  "C 926.8 662.4 929.1 662 941 660.6 C 944.1 660.2 946.8 660.1 954.2 660.1 C 963.8 660.1 965.3 660.2 973.6 661.4 " +
  "C 993.5 664.2 1011.7 672 1027.3 684.5 C 1032.9 689 1032.1 689 1036.5 683.7 C 1039.4 680.2 1039.5 680.5 1034.3 676.4 " +
  "C 1023.5 668.1 1010.3 661.3 996.8 657.4 C 981.9 653 968 651.2 950.8 651.6 C 931.5 652 917.1 654.8 900.2 661.5 " +
  "C 884.7 667.7 871.7 676.7 861.1 688.6 C 840.1 711.9 833.5 742.9 843.4 771.5 C 855.4 806.4 890.9 829.9 937.1 833.9 " +
  "C 939.6 834.1 942.1 834.3 942.8 834.3 C 945.8 834.6 964.8 834.3 968.6 833.9 Z";

/** Las cuatro letras. */
export const LOGO_WORDMARK = `${S} ${I} ${A} ${C}`;
