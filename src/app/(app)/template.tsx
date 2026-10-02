import { PageTransition } from "@/components/motion";

// Se vuelve a montar en cada navegación: anima la entrada de cada pantalla.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
