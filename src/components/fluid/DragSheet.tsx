"use client";
/**
 * A physical bottom sheet: drag it by its header between snap points, flick
 * it with velocity, rubber-band past the ends. On desktop (≥ lg) it becomes
 * a fixed glass side panel. Non-modal: the map stays live behind it.
 *
 *   <DragSheet snaps={[180, 0.55, 0.92]} snap={i} onSnapChange={setI} header={<Handle/>}>…</DragSheet>
 *
 * Snap values ≤ 1 are fractions of the viewport height, larger ones pixels.
 * `onVisibleHeight` reports how much of the sheet covers the map (for padding).
 */
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from "motion/react";
import { cn } from "@/components/ui/cn";

type Props = {
  snaps?: number[];
  /** Controlled snap index. */
  snap?: number;
  defaultSnap?: number;
  onSnapChange?: (index: number) => void;
  /** Visible height in px whenever it settles or the viewport changes. */
  onVisibleHeight?: (px: number) => void;
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Desktop side: start = right in RTL. */
  side?: "start" | "end";
  "aria-label"?: string;
  "data-testid"?: string;
};

const DESKTOP = "(min-width: 1024px)";
const subscribeMQ = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  window.addEventListener("resize", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("resize", cb);
  };
};
const viewport = () => `${window.matchMedia(DESKTOP).matches ? 1 : 0}:${window.innerHeight}`;

function useViewport() {
  const v = useSyncExternalStore(subscribeMQ, viewport, () => "0:800");
  const [d, h] = v.split(":");
  return { desktop: d === "1", vh: Number(h) };
}

const SPRING = { type: "spring" as const, stiffness: 420, damping: 42, mass: 0.9 };

export function DragSheet({ snaps = [0.42, 0.9], snap, defaultSnap = 0, onSnapChange, onVisibleHeight, header, children, className, side = "start", ...rest }: Props) {
  const { desktop, vh } = useViewport();
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const [inner, setInner] = useState(defaultSnap);
  const index = Math.max(0, Math.min(snaps.length - 1, snap ?? inner));
  const heights = useMemo(() => snaps.map((s) => Math.round(s <= 1 ? s * vh : Math.min(s, vh * 0.95))), [snaps, vh]);
  const maxH = Math.max(...heights);
  const y = useMotionValue(maxH - heights[index]);
  const [headerH, setHeaderH] = useState(28);
  const headerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(() => setHeaderH(node.offsetHeight));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  const reportHeight = useEffectEvent((px: number) => onVisibleHeight?.(px));

  const settle = (i: number, velocity = 0) => {
    const target = maxH - heights[i];
    if (reduce) y.set(target);
    else animate(y, target, { ...SPRING, velocity });
  };

  // Follow controlled changes and viewport changes.
  useEffect(() => {
    if (desktop) return;
    const target = maxH - heights[index];
    if (reduce) y.set(target);
    else animate(y, target, SPRING);
  }, [index, heights, maxH, reduce, y, desktop]);

  useEffect(() => {
    reportHeight(desktop ? 0 : heights[index]);
  }, [desktop, heights, index]);

  const choose = (i: number) => {
    if (snap === undefined) setInner(i);
    onSnapChange?.(i);
    if (i === index) settle(i);
  };

  // A drag that ends over the handle must not also count as a tap on it.
  const draggedAt = useRef(0);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    draggedAt.current = performance.now();
    // Project the flick forward, then snap to the nearest visible height.
    const projected = y.get() + info.velocity.y * 0.18;
    const visible = maxH - projected;
    let best = 0;
    for (let i = 1; i < heights.length; i++) if (Math.abs(heights[i] - visible) < Math.abs(heights[best] - visible)) best = i;
    if (best === index) settle(best, info.velocity.y);
    else choose(best);
  };

  const cycle = () => {
    if (performance.now() - draggedAt.current < 400) return;
    choose(index === heights.length - 1 ? 0 : index + 1);
  };
  const atTop = index === heights.length - 1;

  if (desktop) {
    return (
      <section
        role="region"
        aria-label={rest["aria-label"]}
        data-testid={rest["data-testid"]}
        className={cn("drag-sheet glass glass-strong pointer-events-auto absolute top-4 bottom-4 z-20 flex w-[420px] flex-col overflow-hidden rounded-[22px]", side === "start" ? "right-4" : "left-4", className)}
      >
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </section>
    );
  }

  return (
    <motion.section
      role="region"
      aria-label={rest["aria-label"]}
      data-testid={rest["data-testid"]}
      data-snap={index}
      className={cn("drag-sheet glass glass-strong pointer-events-auto fixed inset-x-2 bottom-0 z-20 flex flex-col rounded-t-[22px] rounded-b-none", className)}
      style={{ height: maxH + 40, y, paddingBottom: 40, marginBottom: -40 }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: maxH - Math.min(...heights) }}
      dragElastic={{ top: 0.08, bottom: 0.25 }}
      dragMomentum={false}
      onDragEnd={onDragEnd}
    >
      <div ref={headerRef} className="drag-sheet-header shrink-0 touch-none select-none" onPointerDown={(e) => controls.start(e)}>
        <button type="button" className="drag-sheet-handle" onClick={cycle} aria-label={atTop ? "כיווץ הלוח" : "הרחבת הלוח"} aria-expanded={atTop}>
          <span aria-hidden />
        </button>
        {header}
      </div>
      <div className="safe-bottom min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ maxHeight: Math.max(0, heights[index] - headerH) }}>
        {children}
      </div>
    </motion.section>
  );
}
