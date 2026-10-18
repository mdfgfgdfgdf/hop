"use client";
/**
 * Slide to confirm. The knob rides a liquid track from the start edge (right
 * in RTL) to the end; past 85 % it locks, fills and fires `onConfirm`.
 * It is also a real button: a click, Enter or Space confirms too (unless
 * `requireSwipe`, where a click only nudges the knob as a hint) — so it
 * works with keyboards, switch access and tests.
 */
import { useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ChevronsLeft, Check } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { haptic } from "@/lib/haptics";

type Props = {
  label: string;
  /** Shown after confirming, while `loading`. */
  doneLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  disabled?: boolean;
  loading?: boolean;
  tone?: "brand" | "success" | "danger";
  requireSwipe?: boolean;
  icon?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
};

const KNOB = 56;
const PAD = 5;

export function SwipeConfirm({ label, doneLabel, onConfirm, disabled, loading, tone = "brand", requireSwipe = false, icon, className, ...rest }: Props) {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const [done, setDone] = useState(false);
  const dragged = useRef(false);
  const range = () => {
    const w = trackRef.current?.clientWidth ?? 300;
    return Math.max(1, w - KNOB - PAD * 2);
  };
  // RTL: the knob travels toward the left (negative x).
  const dir = () => (trackRef.current && getComputedStyle(trackRef.current).direction === "rtl" ? -1 : 1);
  const progress = useTransform(x, (v) => Math.min(1, Math.abs(v) / range()));
  const fill = useTransform(progress, (p) => `${KNOB + PAD + p * range()}px`);
  const labelOpacity = useTransform(progress, [0, 0.6], [1, 0]);

  const confirm = async () => {
    if (disabled || loading || done) return;
    setDone(true);
    haptic("success");
    animate(x, dir() * range(), reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 });
    try {
      await onConfirm();
    } finally {
      // Re-arm in case the caller keeps this control on screen (e.g. an error).
      setTimeout(() => {
        setDone(false);
        animate(x, 0, { type: "spring", stiffness: 400, damping: 36 });
      }, 900);
    }
  };

  const onDragEnd = () => {
    if (progress.get() > 0.85) void confirm();
    else animate(x, 0, { type: "spring", stiffness: 600, damping: 32 });
    setTimeout(() => (dragged.current = false), 0);
  };

  const onClick = () => {
    if (dragged.current) return;
    if (!requireSwipe) {
      void confirm();
      return;
    }
    // Hint: nudge the knob along the path.
    if (!reduce) animate(x, [0, dir() * 36, 0], { duration: 0.6, ease: "easeInOut" });
  };

  return (
    <button
      ref={trackRef}
      type="button"
      className={cn("swipe-confirm", `swipe-${tone}`, (disabled || loading) && "is-disabled", done && "is-done", className)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void confirm();
        }
      }}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-label={label}
      data-testid={rest["data-testid"]}
    >
      <motion.span className="swipe-fill" style={{ width: fill }} aria-hidden />
      <motion.span className="swipe-label" style={{ opacity: labelOpacity }} aria-hidden>
        <span className="swipe-shimmer">{done && doneLabel ? doneLabel : label}</span>
      </motion.span>
      <motion.span
        className="swipe-knob"
        style={{ x }}
        drag={disabled || loading || done ? false : "x"}
        dragConstraints={trackRef}
        dragElastic={0.04}
        dragMomentum={false}
        onDragStart={() => {
          dragged.current = true;
          haptic("tap");
        }}
        onDragEnd={onDragEnd}
        aria-hidden
      >
        {done ? <Check size={24} strokeWidth={3} /> : (icon ?? <ChevronsLeft size={26} strokeWidth={2.6} className="swipe-chevrons" />)}
      </motion.span>
    </button>
  );
}
