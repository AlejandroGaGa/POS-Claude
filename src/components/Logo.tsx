import Link from "next/link";
import { APP_PRODUCT, APP_SHORT, APP_TAGLINE } from "@/lib/brand";
import { LOGO_GLASS, LOGO_GLASS_FACET, LOGO_H, LOGO_INK, LOGO_W } from "@/lib/logoPaths";
import { cx } from "./ui";

/**
 * Logotipo SIAC. Las letras toman el color del texto (`currentColor`), así sirve en tema claro,
 * oscuro y sobre fondos de color; el cristal conserva su azul. `tagline` agrega el lema debajo,
 * ajustado al ancho de las letras. Con `title` se anuncia como imagen; sin él es decorativo.
 */
export function SiacMark({ tagline = false, title, className }: { tagline?: boolean; title?: string; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_W} ${tagline ? 350 : LOGO_H}`}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={LOGO_INK} fill="currentColor" />
      <path d={LOGO_GLASS} fill="var(--brand-glass, #81a0b8)" />
      <path d={LOGO_GLASS_FACET} fill="var(--brand-glass-light, #8daac0)" />
      {tagline && (
        <text x="3" y="338" textLength="964" lengthAdjust="spacing" fontSize="43" fontWeight="450" fill="currentColor">
          {APP_TAGLINE}
        </text>
      )}
    </svg>
  );
}

/**
 * Marca del sistema con enlace al inicio.
 * - normal: logotipo + "Ventas Mostrador" (barra lateral y menú).
 * - `compact`: solo el logotipo (barra superior del celular).
 * - `full`: logotipo grande con el lema (pantalla de entrada).
 */
export default function Logo({ compact = false, full = false, href = "/", className }: { compact?: boolean; full?: boolean; href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-11 min-w-0 items-center gap-3 rounded-xl text-[var(--brand-ink)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus",
        className,
      )}
    >
      {full ? (
        <SiacMark tagline title={`${APP_SHORT} · ${APP_TAGLINE}`} className="h-auto w-[230px] max-w-full min-[400px]:w-[280px]" />
      ) : (
        <>
          <SiacMark title={APP_SHORT} className={cx("w-auto shrink-0", compact ? "h-6" : "h-8")} />
          <span className={compact ? "sr-only" : "border-l border-border pl-3 text-sm leading-tight font-semibold text-foreground"}>
            {APP_PRODUCT.split(" ").map((w) => (
              <span key={w} className={compact ? undefined : "block"}>
                {w}{" "}
              </span>
            ))}
          </span>
        </>
      )}
    </Link>
  );
}
