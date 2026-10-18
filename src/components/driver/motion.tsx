"use client";
/**
 * Driver-app motion + brand primitives: the HOP needle gauge (our loader /
 * "waiting" element), count-up numbers, crossfading labels, staggered lists
 * and the spring availability switch. All respect prefers-reduced-motion.
 */
import { useEffect } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";
import { Power } from "lucide-react";
import { cn } from "@/components/ui";

/** The HOP needle: a gauge arc with a sweeping needle (brand loader). */
export function NeedleLoader({ size = 40, className, label = "טוען…", tone = "brand", still }: { size?: number; className?: string; label?: string | null; tone?: "brand" | "ink" | "white"; still?: boolean }) {
  const reduce = useReducedMotion();
  const color = tone === "brand" ? "var(--brand)" : tone === "white" ? "#fff" : "var(--ink)";
  const sweep = !reduce && !still;
  // Arc from 150° to 390° (240° gauge), centre 24,24, radius 17.
  const r = 17;
  const a0 = (150 * Math.PI) / 180;
  const a1 = (390 * Math.PI) / 180;
  const p0 = [24 + r * Math.cos(a0), 24 + r * Math.sin(a0)];
  const p1 = [24 + r * Math.cos(a1), 24 + r * Math.sin(a1)];
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role={label ? "status" : undefined} aria-label={label ?? undefined} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
        <path d={`M ${p0[0]} ${p0[1]} A ${r} ${r} 0 1 1 ${p1[0]} ${p1[1]}`} fill="none" stroke={color} strokeOpacity={0.28} strokeWidth={5} strokeLinecap="round" />
      </svg>
      <motion.svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        className="absolute inset-0"
        aria-hidden
        initial={{ rotate: sweep ? -110 : 45 }}
        animate={sweep ? { rotate: [-110, 110, -110] } : { rotate: 45 }}
        transition={sweep ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
      >
        <line x1="24" y1="24" x2="24" y2="9" stroke={color} strokeWidth={4.5} strokeLinecap="round" />
        <circle cx="24" cy="24" r="4.2" fill={color} />
      </motion.svg>
    </span>
  );
}

/** Animated number (counts from the previous value). Screen readers get the final value. */
export function CountUp({ value, format, duration = 0.9, className, from = 0 }: { value: number; format: (n: number) => string; duration?: number; className?: string; from?: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : from);
  const text = useTransform(mv, (v) => format(Math.round(v)));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [value, reduce, duration, mv]);
  return (
    <span className={className}>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

/** Crossfades between labels (e.g. the ride step button). */
export function SwapText({ children, k, className }: { children: React.ReactNode; k: string; className?: string }) {
  return (
    <span className={cn("relative inline-grid", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={k}
          initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="inline-flex items-center gap-2"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const listVariants: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } } };
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 32 } },
};

export function StaggerList({ children, className, as = "ul" }: { children: React.ReactNode; className?: string; as?: "ul" | "ol" | "div" }) {
  const Comp = as === "ol" ? motion.ol : as === "div" ? motion.div : motion.ul;
  return (
    <Comp className={className} variants={listVariants} initial="hidden" animate="show">
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = "li" }: { children: React.ReactNode; className?: string; as?: "li" | "div" }) {
  const Comp = as === "div" ? motion.div : motion.li;
  return (
    <Comp className={className} variants={itemVariants}>
      {children}
    </Comp>
  );
}

/** Big availability switch with a spring knob and brand glow when on. */
export function BigSwitch({ checked, onChange, disabled, busy, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; busy?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-testid="availability-switch"
      className={cn(
        "relative flex h-[60px] w-[96px] shrink-0 items-center rounded-full p-1.5 transition-[background-color,box-shadow] duration-300 disabled:opacity-70",
        checked
          ? "justify-end bg-brand shadow-[0_0_0_1px_rgba(255,255,255,0.18)_inset,0_12px_40px_-8px_rgba(36,87,255,0.9)]"
          : "justify-start bg-[color-mix(in_oklab,var(--fg)_14%,transparent)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]",
      )}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 560, damping: 30 }} className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-[0_6px_16px_-4px_rgba(0,0,0,0.5)]">
        {busy || checked ? <NeedleLoader size={30} tone={checked ? "brand" : "ink"} label={null} /> : <Power size={22} strokeWidth={2.6} className="text-ink-500" aria-hidden />}
      </motion.span>
    </button>
  );
}
