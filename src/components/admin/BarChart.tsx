"use client";
/**
 * Inline-SVG column chart (single series, brand blue). RTL-aware: time runs
 * from right (earliest) to left, the value axis sits on the start (right)
 * side. Thin columns (≤24px) with 4px rounded data-ends, hairline grid,
 * per-column hover/focus tooltip and an accessible table fallback.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/components/ui";

export type BarDatum = { key: string; label: string; value: number; detail?: string };

function niceStep(max: number, ticks: number) {
  if (max <= 0) return 1;
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

export function BarChart({
  data,
  formatValue,
  formatTick,
  height = 260,
  ariaLabel,
  className,
}: {
  data: BarDatum[];
  formatValue: (v: number) => string;
  formatTick?: (v: number) => string;
  height?: number;
  ariaLabel: string;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 14, bottom: 30, start: 64, end: 8 };
  const plotW = Math.max(0, width - pad.start - pad.end);
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(0, ...data.map((d) => d.value));
  const step = niceStep(max, 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const n = Math.max(1, data.length);
  const slot = plotW / n;
  const barW = Math.max(2, Math.min(24, slot - 2, slot * 0.62));
  const right = pad.end + plotW; // inline-start edge of the plot (RTL: right side)
  const xCenter = (i: number) => right - slot * i - slot / 2;
  const y = (v: number) => pad.top + plotH - (top ? (v / top) * plotH : 0);
  const labelEvery = Math.max(1, Math.ceil(56 / Math.max(slot, 1)));
  const fmtTick = formatTick ?? formatValue;

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className={cn("relative", className)}>
      <div ref={wrap} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.end} x2={right} y1={y(t)} y2={y(t)} stroke="var(--line-strong)" strokeOpacity={t === 0 ? 1 : 0.55} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={right + 10} y={y(t)} dy="0.32em" textAnchor="start" fontSize={11} fill="var(--fg-muted)" style={{ fontVariantNumeric: "tabular-nums" }} direction="ltr">
                  {fmtTick(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = xCenter(i);
              const h = Math.max(0, pad.top + plotH - y(d.value));
              const x0 = cx - barW / 2;
              const yb = pad.top + plotH;
              const r = Math.min(4, barW / 2, h);
              const path = h <= 0 ? "" : `M${x0},${yb} V${yb - h + r} Q${x0},${yb - h} ${x0 + r},${yb - h} H${x0 + barW - r} Q${x0 + barW},${yb - h} ${x0 + barW},${yb - h + r} V${yb} Z`;
              return (
                <g key={d.key}>
                  {path && (
                    <motion.path
                      d={path}
                      fill="var(--brand)"
                      fillOpacity={hover === null || hover === i ? 1 : 0.45}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 30, delay: Math.min(i, 30) * 0.012 }}
                      style={{ transformOrigin: `${cx}px ${yb}px` }}
                    />
                  )}
                  {(i % labelEvery === 0 || i === data.length - 1) && (
                    <text x={cx} y={height - 10} textAnchor="middle" fontSize={11} fill="var(--fg-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {d.label}
                    </text>
                  )}
                  <rect
                    x={cx - slot / 2}
                    y={pad.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${d.label}: ${formatValue(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="cursor-default outline-none"
                  />
                </g>
              );
            })}
          </svg>
        )}
        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[0_12px_30px_-12px_rgba(17,19,24,.45)]"
            style={{ left: xCenter(hover), top: Math.max(8, y(hovered.value) - 8) }}
            role="status"
          >
            <div className="font-bold text-fg-muted">{hovered.label}</div>
            <div className="mt-0.5 text-sm font-extrabold tabular-nums">{formatValue(hovered.value)}</div>
            {hovered.detail && <div className="text-fg-muted">{hovered.detail}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
