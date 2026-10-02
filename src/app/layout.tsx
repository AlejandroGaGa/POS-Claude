import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { APP_NAME } from "@/lib/brand";
import { MotionProvider } from "@/components/motion";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  applicationName: APP_NAME,
  description: "Cotización y venta de mostrador: aluminio, vidrio y herrajes",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1820" },
  ],
};

// Aplica el tema antes de pintar (evita parpadeo): la elección guardada con el botón
// de claro/oscuro manda; si no hay, se sigue el tema del sistema.
const themeScript = `(()=>{try{var r=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');var a=function(){var s=null;try{s=localStorage.getItem('hpa-theme')}catch(e){}var d=s?s==='dark':m.matches;r.classList.toggle('dark',d);r.classList.toggle('light',!d);r.dataset.theme=d?'dark':'light'};a();m.addEventListener('change',a)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className="light" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-[100dvh] bg-background font-sans text-foreground">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
