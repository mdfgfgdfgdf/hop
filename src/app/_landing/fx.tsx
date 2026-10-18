"use client";
/**
 * Landing-only motion helpers: subtle and purposeful. Everything renders as
 * a static, fully readable element under prefers-reduced-motion.
 */
import { useSyncExternalStore, type ReactNode } from "react";
import { motion } from "motion/react";

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeReduce(cb: () => void) {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** True when the visitor asked for reduced motion (false on the server and during hydration). */
export function useStill() {
  return useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
}

/**
 * Fades and slides its content in the first time it scrolls into view.
 * The `lp-reveal` class lets the page's <noscript> style show it without JS.
 */
export function Reveal({ children, className, delay = 0, y = 18 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const still = useStill();
  if (still) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={["lp-reveal", className].filter(Boolean).join(" ")}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
