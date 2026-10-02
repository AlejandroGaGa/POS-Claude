"use client";
/**
 * Sistema de movimiento (Framer Motion). Reglas para que todo se sienta limpio y rápido:
 * - Duraciones cortas (120–260 ms) y una sola curva "ease out" para entradas.
 * - Desplazamientos pequeños (4–12 px); nada rebota salvo los indicadores activos (resorte firme).
 * - Respeta "reducir movimiento" del sistema (MotionConfig reducedMotion="user").
 */
import { animate, motion, MotionConfig, useMotionValue, useReducedMotion, type Transition, type Variants } from "framer-motion";
import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { formatMoney } from "@/lib/pricing";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const FAST: Transition = { duration: 0.18, ease: EASE_OUT };
export const BASE: Transition = { duration: 0.26, ease: EASE_OUT };
/** Resorte para "píldoras" activas que se deslizan entre opciones (layoutId). */
export const PILL_SPRING: Transition = { type: "spring", stiffness: 520, damping: 38, mass: 0.7 };

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={BASE}>
      {children}
    </MotionConfig>
  );
}

/** Entrada de página: aparece y sube 8 px. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={BASE}>
      {children}
    </motion.div>
  );
}

const containerV: Variants = {
  hidden: {},
  show: (stagger: number = 0.035) => ({ transition: { staggerChildren: stagger, delayChildren: 0.02 } }),
};
const itemV: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: BASE },
};

/**
 * Lista con entrada escalonada. Envuelve cada hijo en un item animado.
 * Solo los primeros `maxAnimated` se escalonan para que listas largas no se sientan lentas.
 */
export function Stagger({
  children,
  className,
  as = "div",
  stagger = 0.035,
  maxAnimated = 16,
  itemClassName,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul";
  stagger?: number;
  maxAnimated?: number;
  itemClassName?: string;
}) {
  const Comp = as === "ul" ? motion.ul : motion.div;
  const Item = as === "ul" ? motion.li : motion.div;
  const items = Children.toArray(children);
  return (
    <Comp className={className} variants={containerV} custom={stagger} initial="hidden" animate="show">
      {items.map((child, i) => (
        <Item
          key={isValidElement(child) && child.key != null ? child.key : i}
          variants={i < maxAnimated ? itemV : undefined}
          className={itemClassName}
        >
          {child}
        </Item>
      ))}
    </Comp>
  );
}

/** Aparece subiendo un poco (con retraso opcional). */
export function FadeUp({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...BASE, duration: 0.4, delay }}>
      {children}
    </motion.div>
  );
}

/**
 * Entrada suave para tarjetas. Anima al montar (no espera al scroll) para que el
 * contenido nunca se quede oculto; el retraso escalona tarjetas vecinas.
 */
export function Reveal({ children, className, delay = 0.06 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...BASE, duration: 0.32, delay }}>
      {children}
    </motion.div>
  );
}

/** Cifra que cuenta hasta su valor (dinero o número). */
export function AnimatedNumber({
  value,
  money = true,
  decimals = 0,
  countUp = false,
  className,
}: {
  value: number;
  money?: boolean;
  decimals?: number;
  /** Cuenta desde 0 al montar (KPIs). Sin esto solo anima cuando el valor cambia. */
  countUp?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(countUp ? 0 : value);
  const fmt = (n: number) =>
    money ? formatMoney(n) : new Intl.NumberFormat("es-MX", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n);
  const [text, setText] = useState(() => fmt(countUp ? 0 : value));
  const first = useRef(true);

  useEffect(() => {
    if (reduce) {
      setText(fmt(value));
      return;
    }
    const from = first.current ? (countUp ? 0 : value) : mv.get();
    first.current = false;
    if (from === value) {
      setText(fmt(value));
      return;
    }
    const controls = animate(from, value, {
      duration: Math.min(0.7, 0.25 + Math.log10(Math.abs(value - from) + 1) * 0.08),
      ease: EASE_OUT,
      onUpdate: (v) => {
        mv.set(v);
        setText(fmt(v));
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return <span className={className}>{text}</span>;
}
