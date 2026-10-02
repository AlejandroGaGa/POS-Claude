"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button, Card, EmptyState, btn } from "@/components/ui";

/** Error inesperado en una pantalla: mensaje claro y opción de reintentar sin perder la sesión. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 py-6">
      <Card>
        <EmptyState icon="alert" title="No se pudo cargar esta pantalla">
          <p>Revisa tu conexión e inténtalo de nuevo. Si sigue pasando, avisa al administrador{error.digest ? ` (código ${error.digest})` : ""}.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>Reintentar</Button>
            <Link href="/mostrador" className={btn("secondary")}>
              Ir al mostrador
            </Link>
          </div>
        </EmptyState>
      </Card>
    </div>
  );
}
