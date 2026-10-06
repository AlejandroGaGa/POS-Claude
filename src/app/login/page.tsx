import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import LoginForm from "./LoginForm";
import Logo, { SiacLogo } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import AppFooter from "@/components/AppFooter";
import LiquidBackground from "@/components/LiquidBackground";
import { FadeUp } from "@/components/motion";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const s = await getSession().catch(() => null);
  if (s) redirect(homeFor(s.role));
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca con fondo líquido (pantallas grandes) */}
      <section className="relative hidden overflow-hidden p-10 text-[color:var(--hero-fg)] lg:flex lg:flex-col lg:justify-between">
        <LiquidBackground />
        <FadeUp className="relative">
          <SiacLogo className="h-auto w-80 [--brand-glass:var(--hero-glass)] [--brand-text:var(--hero-fg)] xl:w-96" />
        </FadeUp>
        <div className="relative max-w-md">
          <FadeUp delay={0.08}>
            <p className="font-display text-5xl leading-tight">Cotiza y cobra en segundos.</p>
          </FadeUp>
          <FadeUp delay={0.16}>
            <p className="mt-4 text-lg text-[color:var(--hero-fg-soft)]">Tiras, tramos, hojas de vidrio y herrajes con el precio correcto, sin hacer cuentas a mano.</p>
          </FadeUp>
        </div>
        <FadeUp delay={0.24} className="relative text-base text-[color:var(--hero-fg-soft)]">
          Aluminio · Cristal · Herrajes
        </FadeUp>
      </section>

      <section className="flex flex-col items-center justify-start sm:p-8">
        {/* En celular: franja líquida arriba */}
        <div className="relative h-44 w-full overflow-hidden rounded-b-[2rem] text-[color:var(--hero-fg)] sm:hidden">
          <LiquidBackground />
          <p className="font-display relative px-5 pt-20 text-3xl leading-tight">Cotiza y cobra en segundos.</p>
        </div>
        <FadeUp className="w-full max-w-sm p-4 sm:my-auto sm:p-0">
          <div className="mb-8 flex items-center justify-between gap-3">
            <Logo full href="/login" />
            <ThemeToggle />
          </div>
          <h1 className="font-display text-3xl">Bienvenido</h1>
          <p className="mt-1 mb-6 text-muted">Entra con el usuario que te dio el administrador.</p>
          <div className="rounded-3xl bg-surface p-5 shadow-[var(--surface-shadow)] sm:p-6">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </FadeUp>
        <AppFooter tone="plain" stacked className="mt-auto w-full max-w-sm px-4 pt-6 pb-4 sm:px-0 sm:pb-0" />
      </section>
    </main>
  );
}
