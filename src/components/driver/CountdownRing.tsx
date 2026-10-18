"use client";
/** Circular countdown (SVG) with the remaining seconds in the middle. */
import { useState } from "react";
import { motion } from "motion/react";

export function CountdownRing({ expiresAt, remainingMs, totalMs, size = 92 }: { expiresAt: number; remainingMs: number; totalMs: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // One linear sweep from "now" to the deadline — smooth regardless of render cadence.
  const [sweep] = useState(() => {
    const rem = Math.max(0, expiresAt - Date.now());
    return { from: c * (1 - Math.min(1, totalMs > 0 ? rem / totalMs : 0)), duration: rem / 1000 };
  });
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const color = frac > 0.5 ? "var(--success)" : frac > 0.25 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="timer" aria-label={`נותרו ${secs} שניות לאישור`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in oklab, var(--fg) 12%, transparent)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: sweep.from }}
          animate={{ strokeDashoffset: c }}
          transition={{ duration: sweep.duration, ease: "linear" }}
          style={{ transition: "stroke 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div className="text-3xl font-extrabold tabular-nums">{secs}</div>
          <div className="mt-0.5 text-[10px] font-bold text-fg-muted">שניות</div>
        </div>
      </div>
    </div>
  );
}
