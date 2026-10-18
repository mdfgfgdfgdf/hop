"use client";
/**
 * A celebratory "hop": brand rings, a spray of dots and needle sparks burst
 * from the centre whenever `burstKey` changes (driver found, ride complete).
 * Purely decorative; renders nothing under reduced motion.
 */
import { motion, useReducedMotion } from "motion/react";

const DOTS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
  const r = i % 3 === 0 ? 1 : i % 3 === 1 ? 0.78 : 0.62;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: i % 4 === 0 ? 9 : 6, c: i % 5 === 0 ? "#ffd34d" : i % 2 ? "#2457FF" : "#7d9cff" };
});

export function HopBurst({ burstKey, size = 220, className }: { burstKey: unknown; size?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce || burstKey == null || burstKey === false) return null;
  const R = size / 2;
  return (
    <div key={String(burstKey)} className={className} style={{ position: "absolute", width: size, height: size, pointerEvents: "none" }} aria-hidden>
      {[0, 1].map((i) => (
        <motion.span
          key={`r${i}`}
          style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${i ? 2 : 3}px solid rgba(36,87,255,${i ? 0.35 : 0.6})` }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.9, delay: i * 0.12, ease: [0.15, 0.7, 0.3, 1] }}
        />
      ))}
      {DOTS.map((d, i) => (
        <motion.span
          key={i}
          style={{ position: "absolute", left: R - d.s / 2, top: R - d.s / 2, width: d.s, height: d.s, borderRadius: d.s, background: d.c }}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
          animate={{ x: d.x * R * 0.92, y: d.y * R * 0.92, scale: [0.4, 1.2, 0.6], opacity: [1, 1, 0] }}
          transition={{ duration: 0.85, ease: [0.2, 0.8, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
