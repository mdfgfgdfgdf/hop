"use client";
/**
 * Living HOP marks.
 *
 *   <AnimatedLogo />  the "hop" wordmark. The letters literally hop (staggered
 *                     jump) and the needle cut in the "o" behaves like a gauge.
 *   <AnimatedMark />  the "h" app icon with the same needle.
 *
 * mode:
 *   idle     needle rests, sways gently
 *   loading  needle sweeps back and forth like a revving gauge (searching, waiting)
 *   moving   needle leans forward and trembles (ride in progress / online)
 *   success  needle snaps to full and settles; letters hop once
 * hopOn:     "hover" | "mount" | "both" | "none" — when the letters hop
 * `hopKey`:  change it to trigger a hop programmatically (e.g. on submit).
 * Reduced motion: everything static.
 */
import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";

export type LogoMode = "idle" | "loading" | "moving" | "success";

const NEEDLE_REST = 0; // the cut points to the upper right in the static logo

function needleAnimation(mode: LogoMode, reduce: boolean): { animate: { rotate: number | number[] }; transition: Transition } {
  if (reduce) return { animate: { rotate: NEEDLE_REST }, transition: { duration: 0 } };
  switch (mode) {
    case "loading":
      return { animate: { rotate: [-150, 20, -150] }, transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } };
    case "moving":
      return { animate: { rotate: [8, 14, 6, 12, 8] }, transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" } };
    case "success":
      return { animate: { rotate: [NEEDLE_REST, 40, 18] }, transition: { duration: 0.9, ease: [0.2, 0.9, 0.2, 1] } };
    default:
      return { animate: { rotate: [NEEDLE_REST, -10, NEEDLE_REST] }, transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" } };
  }
}

function useHop(hopOn: "hover" | "mount" | "both" | "none", hopKey: unknown, mode: LogoMode) {
  const [count, setCount] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    if (hopOn === "mount" || hopOn === "both") {
      const t = setTimeout(() => setCount((c) => c + 1), 250);
      return () => clearTimeout(t);
    }
  }, [hopOn, reduce]);
  useEffect(() => {
    if (reduce || hopKey === undefined) return;
    const t = setTimeout(() => setCount((c) => c + 1), 0);
    return () => clearTimeout(t);
  }, [hopKey, reduce]);
  useEffect(() => {
    if (reduce || mode !== "success") return;
    const t = setTimeout(() => setCount((c) => c + 1), 0);
    return () => clearTimeout(t);
  }, [mode, reduce]);
  const trigger = () => {
    if (!reduce && (hopOn === "hover" || hopOn === "both")) setCount((c) => c + 1);
  };
  return { count, trigger, reduce: !!reduce };
}

const hopTransition = (i: number): Transition => ({ duration: 0.55, delay: i * 0.09, ease: [0.3, 0.0, 0.2, 1], times: [0, 0.38, 0.62, 1] });
const HOP = { y: [0, -26, 4, 0], scaleY: [1, 1.06, 0.94, 1] };

export function AnimatedLogo({
  height = 28,
  color = "var(--brand)",
  mode = "idle",
  hopOn = "hover",
  hopKey,
  className,
  title = "HOP",
}: {
  height?: number;
  color?: string;
  mode?: LogoMode;
  hopOn?: "hover" | "mount" | "both" | "none";
  hopKey?: unknown;
  className?: string;
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const { count, trigger, reduce } = useHop(hopOn, hopKey, mode);
  const needle = needleAnimation(mode, reduce);
  return (
    <svg
      viewBox="0 -30 318 200"
      height={height * (200 / 170)}
      width={(318 / 170) * height}
      className={className}
      role="img"
      aria-label={title}
      onPointerEnter={trigger}
      onClick={trigger}
      style={{ overflow: "visible" }}
    >
      <defs>
        <mask id={`m-o-${id}`} maskUnits="userSpaceOnUse" x="100" y="20" width="130" height="130">
          <rect x="100" y="20" width="130" height="130" fill="#fff" />
          <motion.line
            x1="165"
            y1="85"
            x2="206"
            y2="44"
            stroke="#000"
            strokeWidth="9"
            strokeLinecap="round"
            style={{ originX: "165px", originY: "85px" }}
            initial={false}
            animate={needle.animate}
            transition={needle.transition}
          />
        </mask>
      </defs>
      <motion.g key={`h${count}`} fill={color} style={{ originY: "130px" }} animate={count ? HOP : undefined} transition={hopTransition(0)}>
        <path d="M0 0h30v130H0z" />
        <path d="M30 72a20 20 0 0 1 40 0v58h30V72a50 50 0 0 0-100 0z" />
      </motion.g>
      <motion.g key={`o${count}`} style={{ originY: "130px" }} animate={count ? HOP : undefined} transition={hopTransition(1)}>
        <path fill={color} fillRule="evenodd" mask={`url(#m-o-${id})`} d="M165 40a45 45 0 1 0 0 90a45 45 0 1 0 0-90zm0 28a17 17 0 1 1 0 34a17 17 0 1 1 0-34z" />
      </motion.g>
      <motion.g key={`p${count}`} fill={color} style={{ originY: "130px" }} animate={count ? HOP : undefined} transition={hopTransition(2)}>
        <path d="M226 40h30v128h-30z" />
        <path fillRule="evenodd" d="M271 40a45 45 0 1 0 0 90a45 45 0 1 0 0-90zm0 28a17 17 0 1 1 0 34a17 17 0 1 1 0-34z" />
      </motion.g>
    </svg>
  );
}

export function AnimatedMark({
  size = 44,
  mode = "idle",
  hopOn = "hover",
  hopKey,
  className,
  title = "HOP",
}: {
  size?: number;
  mode?: LogoMode;
  hopOn?: "hover" | "mount" | "both" | "none";
  hopKey?: unknown;
  className?: string;
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const { count, trigger, reduce } = useHop(hopOn, hopKey, mode);
  const needle = needleAnimation(mode, reduce);
  return (
    <motion.svg
      key={`mark${count}`}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      onPointerEnter={trigger}
      onClick={trigger}
      animate={count ? { scale: [1, 0.9, 1.08, 1], y: [0, 2, -6, 0] } : undefined}
      transition={{ duration: 0.5, ease: [0.3, 0, 0.2, 1] }}
    >
      <defs>
        <mask id={`m-h-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect width="120" height="120" fill="#fff" />
          <motion.line
            x1="66"
            y1="62"
            x2="84"
            y2="36"
            stroke="#000"
            strokeWidth="6"
            strokeLinecap="round"
            style={{ originX: "66px", originY: "62px" }}
            initial={false}
            animate={needle.animate}
            transition={needle.transition}
          />
        </mask>
        <linearGradient id={`g-h-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a76ff" />
          <stop offset="0.55" stopColor="#2457ff" />
          <stop offset="1" stopColor="#1d4ae6" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill={`url(#g-h-${id})`} />
      <rect x="1.5" y="1.5" width="117" height="58" rx="27" fill="#fff" opacity="0.14" />
      <g mask={`url(#m-h-${id})`} transform="translate(26 24) scale(0.66)">
        <path fill="#fff" d="M0 0h30v130H0z" />
        <path fill="#fff" d="M30 72a20 20 0 0 1 40 0v58h30V72a50 50 0 0 0-100 0z" />
      </g>
    </motion.svg>
  );
}
