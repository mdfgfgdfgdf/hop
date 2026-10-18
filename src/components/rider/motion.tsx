"use client";
/**
 * HOP motion + brand primitives for the rider app. Everything respects
 * prefers-reduced-motion (static fallbacks, instant value changes).
 */
import { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion, type Variants } from "motion/react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

// ───────────────────────────── needle motif ─────────────────────────────

/**
 * The HOP "needle" loader: a speedometer arc with a sweeping needle — the cut
 * in the logo's "o". Use instead of a generic spinner.
 */
export function NeedleGauge({ size = 36, label = "טוען…", className, tone = "brand" }: { size?: number; label?: string; className?: string; tone?: "brand" | "white" }) {
  const reduce = useReducedMotion();
  const color = tone === "white" ? "#fff" : "var(--brand)";
  const track = tone === "white" ? "rgba(255,255,255,.3)" : "color-mix(in oklab, var(--brand) 18%, transparent)";
  // 270° gauge, open at the bottom
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <span role="status" aria-label={label} className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className="absolute inset-0">
        <circle cx="24" cy="24" r={r} fill="none" stroke={track} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * 0.75} ${c}`} transform="rotate(135 24 24)" />
        <motion.circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          transform="rotate(135 24 24)"
          initial={{ strokeDasharray: `${c * 0.12} ${c}` }}
          animate={reduce ? undefined : { strokeDasharray: [`${c * 0.12} ${c}`, `${c * 0.75} ${c}`, `${c * 0.12} ${c}`] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
      {/* The needle rotates as an HTML layer so its origin is the gauge centre. */}
      <motion.span
        className="absolute inset-0"
        initial={{ rotate: -135 }}
        animate={reduce ? { rotate: 20 } : { rotate: [-135, 135, -135] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <svg viewBox="0 0 48 48" width={size} height={size}>
          <line x1="24" y1="24" x2="24" y2="11" stroke={tone === "white" ? "#fff" : "var(--ink)"} strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      </motion.span>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className="absolute inset-0">
        <circle cx="24" cy="24" r="3.6" fill={color} />
      </svg>
    </span>
  );
}

/** Searching halo for the pickup: ring-pulse + a slowly orbiting needle arc. */
export function NeedleOrbit({ size = 132 }: { size?: number }) {
  const reduce = useReducedMotion();
  const r = 56;
  const c = 2 * Math.PI * r;
  const tip = (-90 + 57.6) * (Math.PI / 180);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} aria-hidden>
      <div className="ring-pulse absolute inset-[30%] rounded-full bg-brand/15" />
      <svg viewBox="0 0 132 132" width={size} height={size} className="absolute inset-0">
        <circle cx="66" cy="66" r={r} fill="none" stroke="color-mix(in oklab, var(--brand) 22%, transparent)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
      </svg>
      <motion.div className="absolute inset-0" animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}>
        <svg viewBox="0 0 132 132" width={size} height={size}>
          <circle cx="66" cy="66" r={r} fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * 0.16} ${c}`} transform="rotate(-90 66 66)" />
          <circle cx={66 + r * Math.cos(tip)} cy={66 + r * Math.sin(tip)} r="4.5" fill="#fff" stroke="var(--brand)" strokeWidth="2.5" />
        </svg>
      </motion.div>
      <div className="relative z-[1] grid h-7 w-7 place-items-center rounded-full border-[3px] border-white bg-brand shadow-[0_8px_20px_-6px_rgba(36,87,255,.8)]">
        <div className="h-2 w-2 rounded-full bg-white" />
      </div>
    </div>
  );
}

// ───────────────────────────── count-up numbers ─────────────────────────────

/** Animates a number from its previous value (0 on first reveal) to `value`. */
export function CountUp({ value, format, duration = 0.7, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      from.current = value;
      const t = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(t);
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);
  return <span className={className}>{format(Math.round(shown))}</span>;
}

// ───────────────────────────── primary CTA ─────────────────────────────

/** The one big primary pill: soft breathing glow + springy press. */
export function GlowButton({ className, glow = true, ...props }: ButtonProps & { glow?: boolean }) {
  const reduce = useReducedMotion();
  const active = glow && !props.disabled && !props.loading;
  return (
    <motion.div className="relative" whileTap={reduce || props.disabled ? undefined : { scale: 0.975 }} transition={{ type: "spring", stiffness: 600, damping: 30 }}>
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 -bottom-1 top-3 rounded-full bg-brand blur-xl"
          initial={{ opacity: 0.35 }}
          animate={reduce ? { opacity: 0.4 } : { opacity: [0.28, 0.55, 0.28] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <Button size="lg" block {...props} className={cn("relative h-[58px] text-[17px]", className)} />
    </motion.div>
  );
}

// ───────────────────────────── stagger lists ─────────────────────────────

export const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 34 } },
};

export function StaggerList({
  children,
  className,
  as = "ul",
  testId,
  label,
  role,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "ul" | "div" | "ol";
  testId?: string;
  label?: string;
  role?: string;
}) {
  const Comp = as === "div" ? motion.div : as === "ol" ? motion.ol : motion.ul;
  return (
    <Comp className={className} variants={listVariants} initial="hidden" animate="show" data-testid={testId} aria-label={label} role={role}>
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

// ───────────────────────────── gliding car ─────────────────────────────

type Glide = { lat: number; lng: number; heading: number | null };

/** Smoothly interpolates the driver's position between ~2.5s location pings. */
export function useGlidingPosition(target: Glide | null, durationMs = 2300): Glide | null {
  const reduce = useReducedMotion();
  const [pos, setPos] = useState<Glide | null>(target);
  const current = useRef<Glide | null>(target);
  const tLat = target?.lat;
  const tLng = target?.lng;
  const tHeading = target?.heading ?? null;
  useEffect(() => {
    if (tLat == null || tLng == null) {
      current.current = null;
      const t = setTimeout(() => setPos(null), 0);
      return () => clearTimeout(t);
    }
    const start = current.current;
    const end = { lat: tLat, lng: tLng, heading: tHeading };
    if (!start || reduce) {
      current.current = end;
      const t = setTimeout(() => setPos(end), 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    let lastPaint = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / durationMs);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const next = { lat: start.lat + (end.lat - start.lat) * e, lng: start.lng + (end.lng - start.lng) * e, heading: end.heading ?? start.heading };
      current.current = next;
      // ~25 fps is plenty for a car marker and keeps the map page cheap to re-render.
      if (k >= 1 || now - lastPaint > 40) {
        lastPaint = now;
        setPos(next);
      }
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tLat, tLng, tHeading, durationMs, reduce]);
  return pos;
}
