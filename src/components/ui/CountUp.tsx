"use client";
/** Animates a number from its previous value to the next (for prices, KPIs). */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 700, className }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduce) return;
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  const shown = reduce ? value : display;
  return (
    <span className={className} aria-label={format(value)}>
      {format(shown)}
    </span>
  );
}
