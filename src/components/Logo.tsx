import Link from "next/link";
import { APP_SHORT } from "@/lib/brand";
import { cx } from "./ui";

/** Marca: píldora oscura con "HPA" + nombre. `compact` para la barra superior del celular. */
export default function Logo({ compact = false, href = "/", className }: { compact?: boolean; href?: string; className?: string }) {
  return (
    <Link href={href} className={cx("flex min-w-0 items-center", compact ? "gap-2" : "gap-2.5", " rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus", className)}>
      <span className={cx("flex h-10 shrink-0 items-center justify-center rounded-2xl bg-foreground font-bold tracking-wide text-background", compact ? "w-12 text-xs" : "w-14 text-sm")}>{APP_SHORT}</span>
      <span className="min-w-0 leading-tight">
        <span className={cx("block truncate font-semibold tracking-tight", compact ? "text-[13px]" : "text-[17px]")}>Ventas Mostrador</span>
        <span className="block text-xs font-medium text-muted">{APP_SHORT}</span>
      </span>
    </Link>
  );
}
