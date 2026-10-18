"use client";
/**
 * Brand motion toolkit for the dashboard. Everything here respects
 * prefers-reduced-motion (MotionConfig reducedMotion="user" in the shell +
 * explicit checks for the JS-driven animations).
 */
import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { formatILS } from "@/lib/format";
import { cn } from "@/components/ui";

export const SPRING = { type: "spring" as const, stiffness: 380, damping: 34 };

const formatters = {
  int: (v: number) => new Intl.NumberFormat("he-IL").format(Math.round(v)),
  ils: (v: number) => formatILS(Math.round(v)),
  ils0: (v: number) => formatILS(Math.round(v), { decimals: 0 }),
};

/** Counts up from 0 on first render and ticks to new values on live updates. */
export function AnimatedNumber({ value, kind = "int", className }: { value: number; kind?: keyof typeof formatters; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, formatters[kind]);
  const first = useRef(true);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const wasFirst = first.current;
    first.current = false;
    const controls = animate(mv, value, { duration: wasFirst ? 1.1 : 0.6, ease: [0.16, 1, 0.3, 1] });
    if (!wasFirst) setBump((b) => b + 1);
    return () => controls.stop();
  }, [value, reduce, mv]);

  return (
    <motion.span
      key={bump}
      className={cn("inline-block tabular-nums", className)}
      initial={bump ? { scale: 1.08, color: "#2457FF" } : false}
      animate={{ scale: 1, color: "#111318" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      {text}
    </motion.span>
  );
}

/** HOP needle loader: a gauge arc with a sweeping needle (the logo's "o" motif). */
export function NeedleLoader({ size = 40, label = "טוען…", className }: { size?: number; label?: string | null; className?: string }) {
  return (
    <span role={label ? "status" : undefined} aria-label={label ?? undefined} aria-hidden={label ? undefined : true} className={cn("inline-grid place-items-center text-brand", className)}>
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <path d="M9.4 34.6a17 17 0 1 1 29.2 0" stroke="currentColor" strokeOpacity="0.16" strokeWidth="5" strokeLinecap="round" />
        <path className="hop-needle-arc" d="M9.4 34.6a17 17 0 1 1 29.2 0" stroke="currentColor" strokeWidth="5" strokeLinecap="round" pathLength={100} strokeDasharray="40 100" />
        <g className="hop-needle">
          <line x1="24" y1="25.9" x2="24" y2="12" stroke="var(--ink)" strokeWidth="3.6" strokeLinecap="round" />
        </g>
        <circle cx="24" cy="25.9" r="4.2" fill="var(--ink)" />
        <circle cx="24" cy="25.9" r="1.6" fill="#fff" />
      </svg>
    </span>
  );
}

/** Centered loader for whole regions (page/route loading). */
export function RegionLoader({ label = "טוען נתונים…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-sm font-semibold text-fg-muted", className)}>
      <NeedleLoader size={48} label={label} />
      <span aria-hidden>{label}</span>
    </div>
  );
}

/** Fade-up entrance with a gentle spring; `index` staggers siblings. */
export function Reveal({ children, index = 0, className, as = "div" }: { children: React.ReactNode; index?: number; className?: string; as?: "div" | "section" | "li" }) {
  const C = as === "section" ? motion.section : as === "li" ? motion.li : motion.div;
  return (
    <C className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: Math.min(index, 12) * 0.045 }}>
      {children}
    </C>
  );
}

/**
 * Smoothly interpolates map positions between live updates so markers glide
 * instead of jumping. `items` must be referentially stable between updates.
 */
export function useGlide<T extends { id: string; lat: number; lng: number }>(items: T[], ms = 1100): T[] {
  const reduce = useReducedMotion();
  const shown = useRef(new Map<string, { lat: number; lng: number }>());
  const [frame, setFrame] = useState<Map<string, { lat: number; lng: number }> | null>(null);

  useEffect(() => {
    if (reduce) return;
    const from = new Map(shown.current);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const next = new Map<string, { lat: number; lng: number }>();
      for (const it of items) {
        const f = from.get(it.id);
        next.set(it.id, f ? { lat: f.lat + (it.lat - f.lat) * e, lng: f.lng + (it.lng - f.lng) * e } : { lat: it.lat, lng: it.lng });
      }
      shown.current = next;
      setFrame(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items, ms, reduce]);

  if (reduce || !frame) return items;
  return items.map((it) => {
    const p = frame.get(it.id);
    return p ? { ...it, lat: p.lat, lng: p.lng } : it;
  });
}

/** Hebrew count phrase: (1, "נהג אחד", "נהגים") → "נהג אחד"; (3, …) → "3 נהגים". */
export function countHe(n: number, one: string, many: string) {
  return n === 1 ? one : `${new Intl.NumberFormat("he-IL").format(n)} ${many}`;
}
