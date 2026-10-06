import { useId } from "react";
import Link from "next/link";
import { APP_PRODUCT, APP_SHORT, APP_SUBTITLE, APP_TAGLINE } from "@/lib/brand";
import { ICON_BOX, LOGO_ARC, LOGO_GLASS, LOGO_OUTLINES, LOGO_PANEL, LOGO_PANEL_FACET, LOGO_WORDMARK, STACKED_BOX, WORDMARK_BOX } from "@/lib/logoPaths";
import { cx } from "./ui";

/*
 * Logotipo SIAC. Los colores salen de variables CSS (globals.css): verde del logotipo en tema
 * claro, verde claro en tema oscuro y verde original al imprimir. `mono` lo pinta todo con el
 * color del texto (para ponerlo en blanco sobre fondos de color).
 */
const INK = "var(--brand-ink, #0e5034)";

type SvgProps = {
  /** Con `title` se anuncia como imagen; sin él es decorativo. */
  title?: string;
  /** Engruesa los trazos finos para que se lean en tamaños chicos (menú, barra del celular). */
  bold?: boolean;
  mono?: boolean;
  className?: string;
};

const a11y = (title?: string) => (title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const));
const thick = (bold?: boolean) => (bold ? ({ stroke: INK, strokeWidth: 5, strokeLinejoin: "round" } as const) : {});

/** Edificios y arco, sin <svg>: se reutiliza en el ícono y en el logotipo completo. */
function IconShapes({ bold }: { bold?: boolean }) {
  // Cada copia necesita su propio degradado: si otra copia está oculta (p. ej. el menú lateral en celular), no se puede compartir.
  const id = `siac-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="470" y1="345" x2="575" y2="545">
          <stop offset="0" style={{ stopColor: "var(--brand-panel-from, #3a8462)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--brand-panel-mid, #145a3e)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-panel-to, #0c3d29)" }} />
        </linearGradient>
      </defs>
      <path d={LOGO_PANEL} fill={`url(#${id})`} />
      <path d={LOGO_PANEL_FACET} fill="#fff" opacity="0.07" />
      <path d={LOGO_GLASS} fill="var(--brand-glass, #878a86)" />
      <path d={`${LOGO_OUTLINES} ${LOGO_ARC}`} fill={INK} {...thick(bold)} />
    </>
  );
}

/** Ícono: los edificios sobre el arco. */
export function SiacIcon({ title, bold, mono, className }: SvgProps) {
  return (
    <svg viewBox={ICON_BOX.join(" ")} className={cx(mono && "brand-mono", className)} focusable="false" {...a11y(title)}>
      <IconShapes bold={bold} />
    </svg>
  );
}

/** Las letras «SIAC». */
export function SiacWordmark({ title, bold, mono, className }: SvgProps) {
  return (
    <svg viewBox={WORDMARK_BOX.join(" ")} className={cx(mono && "brand-mono", className)} focusable="false" {...a11y(title)}>
      <path d={LOGO_WORDMARK} fill={INK} {...thick(bold)} />
    </svg>
  );
}

/** Logotipo completo, como el arte original: ícono, letras, lema y giro del negocio. Para tamaños grandes. */
export function SiacLogo({ title = `${APP_SHORT} · ${APP_TAGLINE}`, mono, className }: Omit<SvgProps, "bold">) {
  return (
    <svg viewBox={STACKED_BOX.join(" ")} className={cx(mono && "brand-mono", className)} focusable="false" {...a11y(title)}>
      <IconShapes />
      <path d={LOGO_WORDMARK} fill={INK} />
      <g fill="var(--brand-text, #3e464b)">
        <text x="143" y="908" textLength="970" lengthAdjust="spacing" fontSize="51" fontWeight="350">
          {APP_TAGLINE}
        </text>
        <text x="218" y="977" textLength="820" lengthAdjust="spacing" fontSize="26" fontWeight="450">
          {APP_SUBTITLE.toUpperCase()}
        </text>
      </g>
      <path d="M 143 966 H 198 V 969 H 143 Z M 1058 966 H 1113 V 969 H 1058 Z" fill={INK} />
    </svg>
  );
}

/** Ícono + letras en una línea (encabezado de notas, cortes y devoluciones). El alto lo da `className` (p. ej. `h-12`). */
export function SiacMark({ title = APP_SHORT, className }: { title?: string; className?: string }) {
  return (
    <span role="img" aria-label={title} className={cx("flex items-end gap-2.5", className)}>
      <SiacIcon className="h-full w-auto shrink-0" />
      <SiacWordmark className="mb-[3%] h-[46%] w-auto shrink-0" />
    </span>
  );
}

/**
 * Marca del sistema con enlace al inicio.
 * - normal: ícono, letras y "Ventas Mostrador" (barra lateral y menú).
 * - `compact`: ícono y letras (barra superior del celular).
 * - `full`: más grande y con el lema (pantalla de entrada).
 */
export default function Logo({ compact = false, full = false, href = "/", className }: { compact?: boolean; full?: boolean; href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-11 min-w-0 items-center rounded-xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus",
        compact ? "gap-2" : "gap-3",
        className,
      )}
    >
      <SiacIcon bold={!full} className={cx("w-auto shrink-0", full ? "h-[4.5rem]" : compact ? "h-9" : "h-11")} />
      <span className={cx("flex min-w-0 flex-col", full ? "gap-1.5" : "gap-1")}>
        <SiacWordmark bold={!full} title={APP_SHORT} className={cx("w-auto self-start", full ? "h-8" : compact ? "h-[18px]" : "h-6")} />
        {full ? (
          <span className="max-w-[11.5rem] text-[15px] leading-tight text-balance text-[var(--brand-text)]">{APP_TAGLINE}</span>
        ) : (
          <span className={compact ? "sr-only" : "text-[13px] leading-none font-medium text-muted"}>{APP_PRODUCT}</span>
        )}
      </span>
    </Link>
  );
}
