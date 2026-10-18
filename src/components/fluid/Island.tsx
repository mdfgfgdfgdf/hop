"use client";
/**
 * The HOP Island: a living status pill at the top of the map. Its shape
 * springs between states (compact ↔ expanded) and its text dissolves into
 * the next state, so the ride narrates itself in one place.
 *
 *   <Island tone="brand" mark="moving" title="דני בדרך אליך" subtitle="טויוטה קורולה · 12-345-67" trailing={<Eta min={4} />} />
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnimatedMark, type LogoMode } from "@/components/brand/AnimatedLogo";
import { cn } from "@/components/ui/cn";

export type IslandTone = "brand" | "glass" | "success" | "danger" | "ink";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Animated HOP mark state; pass `null` to hide the mark. */
  mark?: LogoMode | null;
  /** Hop the mark whenever this changes (e.g. the ride status). */
  hopKey?: unknown;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: IslandTone;
  /** Extra content revealed under the header when expanded. */
  children?: React.ReactNode;
  expanded?: boolean;
  /** Changing it crossfades the header text (defaults to the title when it is a string). */
  contentKey?: string;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
};

const SPRING = { type: "spring" as const, stiffness: 500, damping: 40, mass: 0.8 };

export function Island({ title, subtitle, mark = "idle", hopKey, leading, trailing, tone = "brand", children, expanded = false, contentKey, onClick, className, ...rest }: Props) {
  const reduce = useReducedMotion();
  const key = contentKey ?? (typeof title === "string" ? title : "island");
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      layout
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-expanded={onClick && children ? expanded : undefined}
      aria-label={rest["aria-label"]}
      data-testid={rest["data-testid"]}
      data-tone={tone}
      className={cn("island pointer-events-auto", tone === "glass" ? "glass glass-strong" : "", expanded && "island-expanded", className)}
      style={{ borderRadius: expanded ? 20 : 999 }}
      transition={reduce ? { duration: 0 } : SPRING}
    >
      <motion.div layout="position" className="flex min-w-0 items-center gap-3">
        {mark !== null && (
          <span className="island-mark shrink-0">
            <AnimatedMark size={34} mode={mark} hopOn="both" hopKey={hopKey} title="HOP" />
          </span>
        )}
        {leading}
        <span className="relative min-w-0 flex-1 text-start" aria-live="polite">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={key}
              className="block min-w-0"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.28, ease: [0.3, 0.7, 0.3, 1] }}
            >
              <span className="island-title block truncate">{title}</span>
              {subtitle && <span className="island-sub block truncate">{subtitle}</span>}
            </motion.span>
          </AnimatePresence>
        </span>
        {trailing && <span className="shrink-0">{trailing}</span>}
      </motion.div>
      <AnimatePresence initial={false}>
        {expanded && children && (
          <motion.div
            key="more"
            layout="position"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.08, duration: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="island-more"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </Tag>
  );
}

/** A compact ETA badge for the Island's trailing slot: big minutes, small unit. */
export function IslandEta({ minutes, unit = "דק׳", label }: { minutes: number; unit?: string; label?: string }) {
  return (
    <span className="island-eta" role="text" aria-label={label ?? `${minutes} ${unit}`}>
      <span className="island-eta-num" aria-hidden>
        {Math.max(0, Math.round(minutes))}
      </span>
      <span className="island-eta-unit" aria-hidden>
        {unit}
      </span>
    </span>
  );
}
