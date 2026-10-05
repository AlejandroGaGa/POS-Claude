"use client";
import { useEffect, useRef } from "react";

type RGBA = [number, number, number, number];
type Blob = { color: RGBA; r: number; cx: number; cy: number; ax: number; ay: number; sx: number; sy: number; phase: number };

// Manchas en los tonos del logotipo: azul acero, azul cristal y pizarra. Posiciones y radios relativos al lienzo.
// Las opacidades están medidas para que el texto blanco encima conserve contraste AA aun donde se enciman.
const BLOBS: Blob[] = [
  { color: [62, 100, 132, 0.5], r: 0.55, cx: 0.2, cy: 0.18, ax: 0.18, ay: 0.14, sx: 0.11, sy: 0.08, phase: 0 },
  { color: [39, 81, 112, 0.6], r: 0.5, cx: 0.75, cy: 0.62, ax: 0.2, ay: 0.16, sx: 0.07, sy: 0.1, phase: 1.7 },
  { color: [129, 160, 184, 0.22], r: 0.42, cx: 0.18, cy: 0.8, ax: 0.22, ay: 0.1, sx: 0.09, sy: 0.12, phase: 3.1 },
  { color: [20, 27, 36, 0.7], r: 0.45, cx: 0.82, cy: 0.12, ax: 0.14, ay: 0.2, sx: 0.12, sy: 0.07, phase: 4.4 },
];

/**
 * Fondo líquido: manchas de color que fluyen con una ondulación tipo agua.
 * Se dibuja en un <canvas> pequeño (≈1/6 de resolución) y el navegador lo escala con
 * suavizado: se ve como agua desenfocada y cuesta muy poco (fluido incluso en celulares).
 * Una luz sigue al puntero. Se pausa fuera de pantalla y respeta "reducir movimiento".
 */
export default function LiquidBackground({ className = "", ripple = true }: { className?: string; ripple?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const SCALE = 1 / 6;
    let W = 0;
    let H = 0;
    const src = document.createElement("canvas");
    const sctx = src.getContext("2d", { alpha: false })!;
    const mid = document.createElement("canvas");
    const mctx = mid.getContext("2d", { alpha: false })!;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = Math.max(32, Math.round(r.width * SCALE));
      H = Math.max(32, Math.round(r.height * SCALE));
      for (const c of [canvas, src, mid]) {
        c.width = W;
        c.height = H;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Puntero con seguimiento suave
    let px = 0.7;
    let py = 0.3;
    let tx = px;
    let ty = py;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      tx = Math.min(1.1, Math.max(-0.1, (e.clientX - r.left) / r.width));
      ty = Math.min(1.1, Math.max(-0.1, (e.clientY - r.top) / r.height));
    };
    if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });

    const drawBlob = (x: number, y: number, radius: number, [r, g, b, a]: RGBA) => {
      const grad = sctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
      grad.addColorStop(0.55, `rgba(${r},${g},${b},${a * 0.45})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      sctx.fillStyle = grad;
      sctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };

    let raf = 0;
    let visible = true;
    const t0 = performance.now();

    const frame = (now: number) => {
      const t = reduce ? 0 : (now - t0) / 1000;
      px += (tx - px) * 0.06;
      py += (ty - py) * 0.06;

      const bg = sctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "rgb(27, 34, 43)");
      bg.addColorStop(1, "rgb(32, 70, 98)");
      sctx.fillStyle = bg;
      sctx.fillRect(0, 0, W, H);

      sctx.globalCompositeOperation = "source-over";
      const m = Math.max(W, H);
      for (const b of BLOBS) {
        const x = (b.cx + Math.sin(t * b.sx + b.phase) * b.ax) * W;
        const y = (b.cy + Math.cos(t * b.sy + b.phase * 1.3) * b.ay) * H;
        const breathe = 1 + Math.sin(t * 0.35 + b.phase) * 0.08;
        drawBlob(x, y, b.r * m * breathe, b.color);
      }
      drawBlob(px * W, py * H, 0.3 * m, [200, 225, 245, 0.12]);
      sctx.globalCompositeOperation = "source-over";

      if (!ripple || reduce) {
        ctx.drawImage(src, 0, 0);
      } else {
        // Ondulación tipo agua: desplaza filas y luego columnas con ondas que viajan.
        const amp = Math.max(1.5, W / 55);
        ctx.fillStyle = "rgb(29, 44, 58)";
        ctx.fillRect(0, 0, W, H);
        for (let y = 0; y < H; y++) {
          const dx = Math.sin(y * 0.18 + t * 1.1) * amp + Math.sin(y * 0.05 - t * 0.6) * amp * 1.4;
          mctx.drawImage(src, 0, y, W, 1, dx, y, W, 1);
        }
        for (let x = 0; x < W; x++) {
          const dy = Math.sin(x * 0.16 - t * 0.9) * amp + Math.cos(x * 0.045 + t * 0.5) * amp * 1.2;
          ctx.drawImage(mid, x, 0, 1, H, x, dy, 1, H);
        }
      }
      if (!reduce && visible) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && document.visibilityState === "visible";
      if (visible) start();
    });
    io.observe(canvas);
    const onVis = () => {
      visible = document.visibilityState === "visible";
      if (visible) start();
    };
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
    };
  }, [ripple]);

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ background: "linear-gradient(140deg, var(--hero-from), var(--hero-to))" }}>
      {/* Un poco más grande que el contenedor para ocultar los bordes de la ondulación */}
      <canvas ref={ref} className="absolute -top-[10%] -left-[10%] h-[120%] w-[120%]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgb(255_255_255/0.10),transparent_60%)]" />
    </div>
  );
}
