/**
 * HOP brand marks (inline SVG, no font dependency).
 *  - <Logo />      the "hop" wordmark with the speedometer-needle cut in the "o"
 *  - <LogoMark />  the "h" app icon on a rounded brand square
 */
import type { CSSProperties } from "react";

type Props = { height?: number; color?: string; className?: string; style?: CSSProperties; title?: string };

/** Wordmark. Default colour is the brand blue; pass color="currentColor" to inherit. */
export function Logo({ height = 28, color = "var(--brand)", className, style, title = "HOP" }: Props) {
  const id = "hop-o-mask";
  return (
    <svg
      viewBox="0 0 318 170"
      height={height}
      width={(318 / 170) * height}
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="110" y="30" width="110" height="110">
          <rect x="110" y="30" width="110" height="110" fill="#fff" />
          {/* needle cut: from the centre to the upper-right rim */}
          <line x1="165" y1="85" x2="206" y2="44" stroke="#000" strokeWidth="9" strokeLinecap="round" />
        </mask>
      </defs>
      {/* h */}
      <path fill={color} d="M0 0h30v130H0z" />
      <path fill={color} d="M30 72a20 20 0 0 1 40 0v58h30V72a50 50 0 0 0-100 0z" />
      {/* o (ring with needle cut) */}
      <path
        fill={color}
        fillRule="evenodd"
        mask={`url(#${id})`}
        d="M165 40a45 45 0 1 0 0 90a45 45 0 1 0 0-90zm0 28a17 17 0 1 1 0 34a17 17 0 1 1 0-34z"
      />
      {/* p */}
      <path fill={color} d="M226 40h30v128h-30z" />
      <path
        fill={color}
        fillRule="evenodd"
        d="M271 40a45 45 0 1 0 0 90a45 45 0 1 0 0-90zm0 28a17 17 0 1 1 0 34a17 17 0 1 1 0-34z"
      />
      <path fill={color} d="M226 72h45v26h-45z" opacity="0" />
    </svg>
  );
}

/** App icon: "h" with the needle cut on a rounded brand square. */
export function LogoMark({ size = 44, className, style, title = "HOP", rounded = true }: { size?: number; className?: string; style?: CSSProperties; title?: string; rounded?: boolean }) {
  const id = "hop-h-mask";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} style={style} role="img" aria-label={title}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect width="120" height="120" fill="#fff" />
          <line x1="66" y1="62" x2="84" y2="36" stroke="#000" strokeWidth="6" strokeLinecap="round" />
        </mask>
      </defs>
      {rounded && <rect width="120" height="120" rx="28" fill="var(--brand)" />}
      <g mask={`url(#${id})`} transform="translate(26 24) scale(0.66)">
        <path fill="#fff" d="M0 0h30v130H0z" />
        <path fill="#fff" d="M30 72a20 20 0 0 1 40 0v58h30V72a50 50 0 0 0-100 0z" />
      </g>
    </svg>
  );
}
