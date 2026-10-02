import Link from "next/link";
import { btn } from "@/components/ui";

export default function NoPermission() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">No tienes permiso para ver esta sección</h1>
      <p className="text-muted">Si crees que es un error, pide al administrador que revise tu rol.</p>
      <Link href="/" className={btn()}>
        Ir al inicio
      </Link>
    </main>
  );
}
