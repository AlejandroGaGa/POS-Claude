"use client";
import { useEffect, useState, useTransition, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { navProgress } from "@/lib/navProgress";

/** Reporta un `pending` (de useTransition) a la barra global. */
export function usePendingProgress(pending: boolean) {
  useEffect(() => {
    if (!pending) return;
    navProgress.start();
    return () => navProgress.done();
  }, [pending]);
}

/** Barra fina en la parte superior mientras se aplican filtros o se cambia de página. */
export function TopProgress() {
  const [pending, setPending] = useState(false);
  useEffect(() => navProgress.subscribe(setPending), []);
  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          key="bar"
          role="progressbar"
          aria-label="Actualizando"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25, delay: 0.1 } }}
          className="no-print pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden"
        >
          <motion.div
            className="h-full bg-accent"
            initial={{ width: "0%" }}
            animate={{ width: ["0%", "45%", "75%", "90%"] }}
            transition={{ duration: 2.4, times: [0, 0.2, 0.55, 1], ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Link que navega dentro de una transición (la pantalla actual se queda, con resultados
 * atenuados y barra de progreso) en lugar de mostrar el skeleton completo. Ideal para paginación.
 */
export function PendingLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  usePendingProgress(pending);
  return (
    <Link
      href={href}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        start(() => router.push(href, { scroll: false }));
      }}
    />
  );
}
