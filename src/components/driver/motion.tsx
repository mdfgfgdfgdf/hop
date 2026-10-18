"use client";
/**
 * Driver-app motion + brand primitives: the HOP needle gauge (our loader /
 * "waiting" element), count-up numbers, crossfading labels, staggered lists
 * and the spring availability switch. All respect prefers-reduced-motion.
 */
import { useEffect } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";
import { Power } from "lucide-react";
import { AnimatedMark } from "@/components/brand/AnimatedLogo";
import { NeedleLoader as BrandNeedleLoader } from "@/components/brand/NeedleLoader";
import { cn } from "@/components/ui";
import { useHydrated } from "./hooks";

/**
 * The HOP needle loader (ring + sweeping needle) — the brand's waiting element.
 * `label={null}` renders it decoratively (inside a labelled button, etc.).
 */
export function NeedleLoader({ size = 40, className, label = "טוען…", tone = "brand", speed }: { size?: number; className?: string; label?: string | null; tone?: "brand" | "ink" | "white"; speed?: number }) {
  const color = tone === "brand" ? "var(--brand)" : tone === "white" ? "#fff" : "var(--ink)";
  const loader = <BrandNeedleLoader size={size} color={color} label={label ?? ""} speed={speed} className={className} />;
  return label ? loader : <span aria-hidden className="inline-grid shrink-0">{loader}</span>;
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

/**
 * Big availability switch. Off: a gray glass track with a power knob.
 * On: the knob slides over and becomes the HOP mark with its needle sweeping —
 * the "searching for rides" brand moment. `onBrand` adapts the track for a
 * blue-glass panel.
 */
export function BigSwitch({ checked, onChange, disabled, busy, label, onBrand }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; busy?: boolean; label: string; onBrand?: boolean }) {
  const hydrated = useHydrated();
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
        "relative flex h-[60px] w-[100px] shrink-0 items-center rounded-full p-1.5 transition-[background-color,box-shadow] duration-300 disabled:cursor-wait",
        checked ? "justify-end" : "justify-start",
        checked && onBrand
          ? "bg-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45),inset_0_3px_8px_rgba(10,30,120,0.35)]"
          : checked
            ? "bg-brand shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3),inset_0_3px_8px_rgba(10,30,120,0.35),0_10px_24px_-12px_rgba(36,87,255,0.8)]"
            : "bg-[color-mix(in_oklab,var(--fg)_11%,transparent)] shadow-[inset_0_0_0_1px_rgba(17,19,24,0.06),inset_0_3px_7px_rgba(17,19,24,0.12)]",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 560, damping: 32 }}
        className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-[0_8px_18px_-6px_rgba(17,19,24,0.45),inset_0_-2px_4px_rgba(17,19,24,0.08),inset_0_1px_0_#fff]"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={busy ? "busy" : checked ? "on" : "off"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="grid place-items-center"
            aria-hidden
          >
            {busy ? <NeedleLoader size={28} label={null} speed={1.1} /> : checked ? <AnimatedMark size={34} mode={hydrated ? "loading" : "idle"} hopOn="mount" title="" /> : <Power size={22} strokeWidth={2.6} className="text-ink-500" />}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
