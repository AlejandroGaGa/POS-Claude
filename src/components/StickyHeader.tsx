"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Encabezado de página fijo. Mide su alto y lo publica en --page-header-h para que
 * los encabezados de tablas y paneles laterales se peguen justo debajo.
 * Al hacer scroll se compacta un poco y muestra una línea inferior.
 */
export default function StickyHeader({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--page-header-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el, { box: "border-box" });
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      root.style.setProperty("--page-header-h", "0px");
    };
  }, []);

  return (
    <div
      ref={ref}
      data-stuck={stuck || undefined}
      className={cx(
        "no-print sticky top-[var(--app-top)] z-20 -mx-3 bg-background/85 px-3 backdrop-blur-md transition-[box-shadow,padding] duration-200 sm:-mx-5 sm:px-5",
        stuck ? "py-2.5 shadow-[0_1px_0_var(--separator)]" : "py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
