"use client";
/**
 * Morphing container: when `k` changes, the old content dissolves upward
 * while the new content rises in, and the container springs to the new
 * height — screens merge into each other instead of cutting.
 */
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/components/ui/cn";

const SPRING = { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.9 };

export function Morph({ k, children, className, innerClassName }: { k: string; children: React.ReactNode; className?: string; innerClassName?: string }) {
  const reduce = useReducedMotion();
  const [height, setHeight] = useState<number | "auto">("auto");
  const current = useRef(k);
  useLayoutEffect(() => {
    current.current = k;
  });

  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(() => {
      if (node.dataset.morphKey === current.current) setHeight(node.offsetHeight);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div className={cn("relative", className)} style={{ overflow: "clip", overflowClipMargin: 24 }} initial={false} animate={{ height }} transition={reduce ? { duration: 0 } : SPRING}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={k}
          ref={measure}
          data-morph-key={k}
          className={innerClassName}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.985, filter: "blur(4px)" }}
          transition={reduce ? { duration: 0.12 } : { ...SPRING, opacity: { duration: 0.22 } }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
