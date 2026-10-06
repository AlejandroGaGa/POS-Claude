import { APP_AUTHOR, APP_PRODUCT, APP_SHORT } from "@/lib/brand";
import { cx } from "./ui";

/** Pie de página: insignia del sistema y autor (la versión va en la barra lateral). */
export default function AppFooter({ className, tone = "default", stacked = false }: { className?: string; tone?: "default" | "plain"; stacked?: boolean }) {
  return (
    <footer
      className={cx(
        "no-print flex flex-col items-center gap-2 text-xs text-muted",
        !stacked && "sm:flex-row sm:justify-between sm:gap-4",
        tone === "default" && "border-t border-separator pt-4",
        className,
      )}
    >
      <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-surface py-1 pr-3.5 pl-1 shadow-[var(--surface-shadow)]">
        <span aria-hidden className="flex h-6 items-center justify-center rounded-full bg-accent px-2 text-[11px] font-bold tracking-wide text-accent-foreground">
          {APP_SHORT}
        </span>
        <span className="font-semibold text-foreground">{APP_PRODUCT}</span>
      </div>
      <p className="text-center">
        Desarrollado por <span className="font-medium text-foreground">{APP_AUTHOR}</span> · © {new Date().getFullYear()}
      </p>
    </footer>
  );
}
