"use client";
/**
 * Makes liquid glass react to the pointer: the specular highlight of the
 * glass surface under the cursor/finger moves towards it (--gx / --gy).
 * One passive listener for the whole app, rAF-throttled, off for reduced motion.
 */
import { useEffect } from "react";

const SELECTOR = ".glass, .btn-glass";

export function GlassLight() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last: { el: HTMLElement; x: number; y: number } | null = null;
    const apply = () => {
      raf = 0;
      if (!last) return;
      const r = last.el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const gx = ((last.x - r.left) / r.width) * 100;
      const gy = ((last.y - r.top) / r.height) * 100 - 30; // keep the light slightly above the finger
      last.el.style.setProperty("--gx", `${gx.toFixed(1)}%`);
      last.el.style.setProperty("--gy", `${gy.toFixed(1)}%`);
    };
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
      if (!el) return;
      last = { el, x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
