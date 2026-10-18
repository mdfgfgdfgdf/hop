"use client";
/**
 * HOP's loading element: the logo's needle sweeping around a ring.
 * Use instead of a generic spinner for brand moments (searching for a driver,
 * computing a price, waiting for offers).
 */
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/components/ui/cn";

export function NeedleLoader({ size = 56, className, label = "טוען…", color = "var(--brand)", speed = 1.6 }: { size?: number; className?: string; label?: string; color?: string; speed?: number }) {
  const reduce = useReducedMotion();
  const r = 40;
  return (
    <span role="status" aria-label={label} className={cn("inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="10" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * r * 0.22} ${2 * Math.PI * r}`}
          style={{ originX: "50%", originY: "50%" }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration: speed }}
        />
        <motion.line
          x1="50"
          y1="50"
          x2="50"
          y2="14"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          style={{ originX: "50%", originY: "50%" }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration: speed }}
        />
        <circle cx="50" cy="50" r="7" fill={color} />
      </svg>
    </span>
  );
}
