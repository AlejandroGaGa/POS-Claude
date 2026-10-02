"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "@gravity-ui/icons";
import { cx } from "./ui";

type Theme = "light" | "dark";
const KEY = "hpa-theme";

function apply(t: Theme) {
  const r = document.documentElement;
  r.classList.toggle("dark", t === "dark");
  r.classList.toggle("light", t === "light");
  r.dataset.theme = t;
}

/** Botón para cambiar entre modo claro y oscuro. Recuerda la elección en este dispositivo. */
export default function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* sin almacenamiento: aplica solo en esta visita */
    }
  }

  const dark = theme === "dark";
  const label = dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={dark}
      className={cx(
        "flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-xl text-muted transition-colors outline-none hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus",
        withLabel && "w-full justify-start px-3 text-[15px] font-medium",
        className,
      )}
    >
      {/* Antes de hidratar no sabemos el tema: se muestra la luna para no parpadear el texto */}
      {dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
      {withLabel && <span>{dark ? "Modo claro" : "Modo oscuro"}</span>}
    </button>
  );
}
