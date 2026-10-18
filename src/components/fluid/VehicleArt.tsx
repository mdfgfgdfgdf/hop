"use client";
/**
 * Side-view vehicle illustrations for the service carousel, drawn in HOP
 * colours (white body, brand glass, soft floor shadow). `moving` spins the
 * wheels and adds a gentle suspension bob; reduced motion keeps them still.
 * Cars face left — the direction of travel in an RTL layout.
 */
import { useId } from "react";
import { cn } from "@/components/ui/cn";

export type VehicleKind = "taxi" | "taxi_xl" | "premium" | "accessible" | "rideshare";

type Shape = { body: string; glass: string; wheels: [number, number]; roof?: React.ReactNode; extra?: React.ReactNode };

// viewBox 0 0 220 96 — ground at y = 84.
const SHAPES: Record<VehicleKind, Shape> = {
  taxi: {
    body: "M14 70c0-9 5-14 14-16l22-4 24-17c5-3 10-5 16-5h46c7 0 12 2 17 7l17 16 22 4c8 2 12 7 12 15v4c0 4-3 7-7 7H21c-4 0-7-3-7-7z",
    glass: "M60 50l20-15c3-2 7-3 11-3h20v18zM117 32h17c5 0 9 2 12 5l13 13h-42z",
    wheels: [52, 166],
    roof: <rect x="94" y="16" width="34" height="11" rx="3" fill="#ffd34d" stroke="#e0b42e" strokeWidth="1" />,
  },
  taxi_xl: {
    body: "M10 68c0-9 4-14 12-16l20-3 18-20c4-4 9-6 15-6h80c6 0 10 2 13 7l13 19 22 4c7 2 11 7 11 15v6c0 4-3 7-7 7H17c-4 0-7-3-7-7z",
    glass: "M50 49l15-17c3-3 6-4 10-4h22v21zM103 28h28v21h-28zM137 28h14c4 0 7 2 9 5l11 16h-34z",
    wheels: [48, 172],
    roof: <rect x="104" y="12" width="34" height="11" rx="3" fill="#ffd34d" stroke="#e0b42e" strokeWidth="1" />,
  },
  premium: {
    body: "M10 72c0-8 5-13 13-15l30-6 28-16c6-3 12-5 19-5h34c8 0 15 3 21 8l19 15 24 5c7 2 11 6 11 13v3c0 4-3 7-7 7H17c-4 0-7-3-7-7z",
    glass: "M64 51l22-13c4-2 8-3 12-3h18v16zM122 35h13c6 0 11 2 15 6l11 10h-39z",
    wheels: [54, 168],
    extra: <path d="M24 66h170" stroke="#c8cfdd" strokeWidth="1.5" strokeLinecap="round" />,
  },
  accessible: {
    body: "M12 70c0-9 4-14 12-16l20-3 14-24c3-5 8-7 14-7h86c7 0 12 3 15 9l12 22 21 4c7 2 11 7 11 15v4c0 4-3 7-7 7H19c-4 0-7-3-7-7z",
    glass: "M50 51l12-21c2-3 5-5 9-5h24v26zM101 25h32v26h-32zM139 25h12c4 0 7 2 9 6l10 20h-31z",
    wheels: [50, 170],
    extra: (
      <g transform="translate(108 56)" fill="#2457FF">
        <circle cx="9" cy="-3" r="2.4" />
        <path d="M8 1h3v6h6l3 6h-2.5l-2.4-4H8z" />
        <path d="M5.5 6a6 6 0 1 0 9 6.6" fill="none" stroke="#2457FF" strokeWidth="2" />
      </g>
    ),
  },
  rideshare: {
    body: "M14 70c0-9 5-14 14-16l22-4 24-17c5-3 10-5 16-5h46c7 0 12 2 17 7l17 16 22 4c8 2 12 7 12 15v4c0 4-3 7-7 7H21c-4 0-7-3-7-7z",
    glass: "M60 50l20-15c3-2 7-3 11-3h20v18zM117 32h17c5 0 9 2 12 5l13 13h-42z",
    wheels: [52, 166],
  },
};

export function VehicleArt({ kind, width = 132, moving = false, muted = false, className, title }: { kind: string; width?: number; moving?: boolean; muted?: boolean; className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  const shape = SHAPES[(kind in SHAPES ? kind : "taxi") as VehicleKind];
  return (
    <svg
      viewBox="0 0 220 96"
      width={width}
      height={(width * 96) / 220}
      className={cn("vehicle-art", moving && "is-moving", muted && "is-muted", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`vb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.62" stopColor="#f1f4fa" />
          <stop offset="1" stopColor="#d9dfeb" />
        </linearGradient>
        <linearGradient id={`vg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5d86ff" />
          <stop offset="1" stopColor="#1a3fd6" />
        </linearGradient>
        <radialGradient id={`vs-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(17,19,24,.28)" />
          <stop offset="1" stopColor="rgba(17,19,24,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="86" rx="98" ry="7" fill={`url(#vs-${id})`} />
      <g className="vehicle-body">
        {shape.roof}
        <path d={shape.body} fill={`url(#vb-${id})`} stroke="#c7cdd9" strokeWidth="1.3" />
        <path d={shape.glass} fill={`url(#vg-${id})`} />
        {/* specular streak across the glass */}
        <path d="M70 46l14-10" stroke="rgba(255,255,255,.55)" strokeWidth="3" strokeLinecap="round" />
        {/* brand line + lights */}
        <path d="M24 64h172" stroke="#2457FF" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
        <rect x="16" y="58" width="9" height="5" rx="2.5" fill="#fff4c2" stroke="#e8d68a" strokeWidth=".8" />
        <rect x="197" y="58" width="8" height="5" rx="2.5" fill="#ff5a6a" />
        {shape.extra}
      </g>
      {shape.wheels.map((cx) => (
        <g key={cx} className="vehicle-wheel" style={{ transformOrigin: `${cx}px 78px` }}>
          <circle cx={cx} cy="78" r="13" fill="#1b1e26" />
          <circle cx={cx} cy="78" r="7.5" fill="#e6e9f0" />
          <path d={`M${cx} 71.5v13M${cx - 6.5} 78h13`} stroke="#9aa2b3" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
