import Link from "next/link";
import { Card, EmptyState, btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 py-6">
      <Card>
        <EmptyState icon="search" title="No encontramos lo que buscas">
          <p>El registro no existe o fue dado de baja.</p>
          <div className="mt-4 flex justify-center">
            <Link href="/mostrador" className={btn("secondary")}>
              Ir al mostrador
            </Link>
          </div>
        </EmptyState>
      </Card>
    </div>
  );
}
