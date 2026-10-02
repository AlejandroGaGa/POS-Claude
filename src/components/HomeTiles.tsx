"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import CustomerForm from "./CustomerForm";
import Icon, { type IconName } from "./Icon";
import { cx } from "./ui";
import { BASE, EASE_OUT } from "./motion";

export interface Tile {
  key: string;
  title: string;
  hint: string;
  icon: IconName;
  href?: string;
  action?: "nuevo-cliente";
  primary?: boolean;
}

/**
 * Botones enormes de la pantalla de inicio. Atajos de teclado 1–4 en computadora.
 * "Registrar cliente" abre el formulario aquí mismo, sin cambiar de pantalla.
 */
export default function HomeTiles({ tiles, canCredit }: { tiles: Tile[]; canCredit: boolean }) {
  const router = useRouter();
  const [newCustomer, setNewCustomer] = useState(false);

  function run(t: Tile) {
    if (t.action === "nuevo-cliente") setNewCustomer(true);
    else if (t.href) router.push(t.href);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || newCustomer) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < tiles.length) {
        e.preventDefault();
        run(tiles[i]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, newCustomer]);

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {tiles.map((t, i) => {
          const body = (
            <>
              <span
                className={cx(
                  "flex size-16 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105 sm:size-20 sm:rounded-3xl",
                  t.primary ? "bg-white/15 text-white" : "bg-accent-soft text-accent-soft-foreground",
                )}
              >
                <Icon name={t.icon} className="size-8 sm:size-10" />
              </span>
              <span className="mt-auto flex w-full items-end justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-display block text-2xl leading-tight sm:text-[1.75rem] xl:text-[2rem]">{t.title}</span>
                  <span className={cx("mt-1 block text-[15px]", t.primary ? "text-white/80" : "text-muted")}>{t.hint}</span>
                </span>
                <kbd
                  aria-hidden
                  className={cx(
                    "hidden size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold lg:flex",
                    t.primary ? "border-white/25 text-white/80" : "border-border text-muted",
                  )}
                >
                  {i + 1}
                </kbd>
              </span>
            </>
          );
          const cls = cx(
            "group relative flex h-full min-h-48 w-full flex-col items-start gap-6 overflow-hidden rounded-[2rem] p-6 text-left shadow-[var(--surface-shadow)] outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--overlay-shadow)] focus-visible:ring-4 focus-visible:ring-focus active:scale-[0.98] sm:min-h-60 sm:p-7 xl:min-h-[19rem] xl:p-8",
            t.primary ? "text-white" : "bg-surface text-foreground",
          );
          const style = t.primary ? { background: "linear-gradient(140deg, var(--hero-from), var(--hero-to))" } : undefined;
          return (
            <motion.li key={t.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...BASE, duration: 0.35, ease: EASE_OUT, delay: 0.04 * i }}>
              {t.href ? (
                <Link href={t.href} className={cls} style={style} aria-keyshortcuts={String(i + 1)}>
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={() => run(t)} className={cls} style={style} aria-keyshortcuts={String(i + 1)}>
                  {body}
                </button>
              )}
            </motion.li>
          );
        })}
      </ul>
      <CustomerForm open={newCustomer} onOpenChange={setNewCustomer} canCredit={canCredit} onSaved={(c) => router.push(`/clientes/${c._id}`)} />
    </>
  );
}
