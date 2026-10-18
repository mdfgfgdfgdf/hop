"use client";
/**
 * Landing-page device mock: a gray liquid-glass phone over a light "positron"
 * style map, a blue route with a car gliding along it, the glass top bar with
 * the living HOP mark and the ride sheet. Purely decorative (aria-hidden);
 * static under reduced motion.
 */
import { useReducedMotion } from "motion/react";
import { Lock, ShieldCheck, Star, Wallet } from "lucide-react";
import { AnimatedMark } from "@/components/brand/AnimatedLogo";
import { useHydrated } from "@/lib/use-hydrated";

// The ride: Carmel Market → Rabin Square, drawn on the mock map's roads.
const ROUTE = "M122 470 C 134 432, 150 398, 166 368 S 204 300, 232 280 C 250 268, 270 262, 290 260 C 292 222, 290 190, 288 156";
const PICKUP = { x: 122, y: 470 };
const DROPOFF = { x: 288, y: 156 };

export function PhoneMock() {
  // Render the animated map for SSR + hydration, then honour reduced motion.
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  const still = hydrated && !!reduce;
  return (
    <div className="relative mx-auto w-full max-w-[340px]" aria-hidden>
      {/* soft blue pool under the device */}
      <div className="absolute -inset-x-10 top-16 -bottom-6 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(36,87,255,.28),transparent)] blur-2xl" />

      <div className="glass glass-strong rounded-[46px]! p-[9px]">
        <div className="relative aspect-[9/19] overflow-hidden rounded-[38px] bg-[#EEF1F6] shadow-[inset_0_0_0_1px_rgba(17,19,24,.06)]">
          <MockMap animate={!still} />

          {/* status-bar notch */}
          <div className="absolute top-2 left-1/2 h-[18px] w-[86px] -translate-x-1/2 rounded-full bg-ink/90" />

          {/* glass top bar */}
          <div className="glass glass-strong glass-pill absolute inset-x-3 top-9 flex h-[50px] items-center gap-2.5 ps-1.5 pe-1.5">
            <AnimatedMark size={38} mode="moving" hopOn="none" title="" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-extrabold">ערב טוב, נועה</div>
              <div className="truncate text-[11px] font-semibold text-fg-muted">בנסיעה · המחיר נעול</div>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-bold text-white ring-2 ring-white/80">נכ</span>
          </div>

          {/* glass ride sheet */}
          <div className="glass glass-strong absolute inset-x-2 bottom-2 rounded-[30px]! px-3.5 pt-2 pb-3.5">
            <div className="grab-handle mb-2.5 h-1! w-9!" />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="display text-[19px]">בנסיעה</div>
                <div className="truncate text-[11px] text-fg-muted">בדרך אל כיכר רבין</div>
              </div>
              <div className="shrink-0 rounded-2xl bg-[linear-gradient(180deg,#4a76ff,var(--brand)_55%,var(--brand-600))] px-2.5 py-1.5 text-center text-white shadow-[0_10px_20px_-10px_rgba(36,87,255,.9),inset_0_1px_0_rgba(255,255,255,.4)]">
                <div className="text-[15px] leading-none font-extrabold tabular-nums">~9 דק׳</div>
                <div className="mt-0.5 text-[9px] font-bold text-white/85">ליעד · משוער</div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2.5 rounded-[18px] border border-white/70 bg-white/75 px-2.5 py-2 shadow-[0_1px_2px_rgba(17,19,24,.05)]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <Lock size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-[#0f7a43]">המחיר נעול — בלי הפתעות</div>
                <div className="display text-[18px] ltr-nums">₪42.30</div>
              </div>
              <div className="text-end">
                <div className="text-[10px] font-bold text-fg-muted">הגעה משוערת</div>
                <div className="text-[13px] font-extrabold tabular-nums">18:42</div>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2.5 rounded-[18px] border border-white/70 bg-white/75 px-2.5 py-2 shadow-[0_1px_2px_rgba(17,19,24,.05)]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-bold text-white">דכ</span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-center gap-1 text-[12px] font-extrabold">
                  דני כהן
                  <Star size={10} className="fill-amber-400 text-amber-400" />
                  <span className="text-[11px] tabular-nums">4.9</span>
                </div>
                <div className="truncate text-[10px] text-fg-muted">טויוטה קורולה · לבן</div>
              </div>
              <span dir="ltr" className="inline-flex shrink-0 overflow-hidden rounded-md border-[1.5px] border-ink">
                <span className="grid w-3 place-items-center bg-brand text-[6px] font-black text-white">IL</span>
                <span className="bg-[#FFD21F] px-1.5 py-0.5 text-[11px] font-black tracking-[0.05em] text-ink tabular-nums">12‑345‑67</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* floating glass chips around the device (desktop) */}
      <div className="glass glass-strong glass-pill animate-float absolute top-[30%] -end-16 hidden items-center gap-2 py-2 ps-2 pe-3.5 lg:flex">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-brand">
          <Wallet size={16} />
        </span>
        <span className="leading-tight">
          <span className="block text-[11px] font-bold text-fg-muted">המחיר לפני ההזמנה</span>
          <span className="block text-sm font-extrabold ltr-nums">₪42.30</span>
        </span>
      </div>
      <div className="glass glass-strong glass-pill animate-float absolute top-[52%] -start-12 hidden items-center gap-2 py-2 ps-2 pe-3.5 [animation-delay:-2s] lg:flex">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-success/15 text-success">
          <ShieldCheck size={16} />
        </span>
        <span className="leading-tight">
          <span className="block text-[11px] font-bold text-fg-muted">נהג מאומת</span>
          <span className="block text-sm font-extrabold">רישיונות נבדקו</span>
        </span>
      </div>
    </div>
  );
}

/** Light vector-map look (OpenFreeMap positron): pale land, white streets, soft sea. */
function MockMap({ animate }: { animate: boolean }) {
  const road = { stroke: "#fff", strokeLinecap: "round" as const, fill: "none" };
  const casing = { stroke: "#DCE1EA", strokeLinecap: "round" as const, fill: "none" };
  const majors = [
    "M84 760 C 112 640, 140 540, 170 436 S 226 250, 262 -20",
    "M40 474 C 140 462, 250 482, 380 452",
    "M40 300 C 140 302, 240 286, 380 296",
    "M300 760 C 284 560, 296 420, 286 -20",
  ];
  const minors = [
    "M60 640 L 380 612",
    "M50 560 L 380 548",
    "M60 390 L 380 380",
    "M60 214 L 380 206",
    "M60 130 L 380 118",
    "M200 760 L 220 0",
    "M120 300 L 150 -10",
    "M350 760 L 344 -10",
  ];
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 760" preserveAspectRatio="xMidYMid slice">
      <rect width="360" height="760" fill="#EEF1F6" />
      {/* sea (the coast runs along the west edge) */}
      <path d="M0 0 H66 C 58 120, 80 230, 62 350 S 36 570, 54 760 H0 Z" fill="#D8E3F3" />
      <path d="M66 0 C 58 120, 80 230, 62 350 S 36 570, 54 760" stroke="#E7EDF7" strokeWidth="6" fill="none" />
      {/* parks / blocks */}
      <rect x="214" y="340" width="56" height="96" rx="14" fill="#E2EAE5" />
      <rect x="110" y="140" width="70" height="52" rx="12" fill="#E7EAF0" />
      <rect x="236" y="510" width="48" height="78" rx="12" fill="#E7EAF0" />
      {minors.map((d) => (
        <g key={d}>
          <path d={d} {...casing} strokeWidth="8" />
          <path d={d} {...road} strokeWidth="5.5" />
        </g>
      ))}
      {[...majors, ROUTE].map((d) => (
        <g key={d}>
          <path d={d} {...casing} strokeWidth="15" />
          <path d={d} {...road} strokeWidth="11.5" />
        </g>
      ))}
      <g fontFamily="Heebo, sans-serif" fontSize="9.5" fontWeight="600" fill="#9AA1AE">
        <text x="30" y="420" transform="rotate(-84 30 420)" fill="#93A6C4" letterSpacing="2">הים התיכון</text>
        <text x="312" y="676" transform="rotate(-86 312 676)">אבן גבירול</text>
        <text x="262" y="468">ארלוזורוב</text>
        <text x="96" y="292">בן גוריון</text>
      </g>

      {/* route: traveled part faded, remaining part bright blue */}
      <path d={ROUTE} stroke="#fff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={ROUTE} stroke="#2457FF" strokeOpacity="0.28" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={ROUTE} stroke="#2457FF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={100} strokeDasharray="100 200">
        {animate && <animate attributeName="stroke-dashoffset" values="0;-100;-100" keyTimes="0;0.86;1" dur="11s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.3 1; 0 0 1 1" />}
      </path>

      {/* pickup + dropoff */}
      <circle cx={PICKUP.x} cy={PICKUP.y} r="9" fill="#2457FF" stroke="#fff" strokeWidth="4" />
      <rect x={DROPOFF.x - 9} y={DROPOFF.y - 9} width="18" height="18" rx="5" fill="#111318" stroke="#fff" strokeWidth="4" />
      <g transform={`translate(${PICKUP.x - 30} ${PICKUP.y + 30})`}>
        <rect x="-4" y="-14" width="70" height="22" rx="11" fill="#fff" opacity="0.94" />
        <text x="31" y="1" textAnchor="middle" fontFamily="Heebo, sans-serif" fontSize="10.5" fontWeight="800" fill="#111318">שוק הכרמל</text>
      </g>
      <g transform={`translate(${DROPOFF.x - 78} ${DROPOFF.y - 4})`}>
        <rect x="-4" y="-14" width="74" height="22" rx="11" fill="#fff" opacity="0.94" />
        <text x="33" y="1" textAnchor="middle" fontFamily="Heebo, sans-serif" fontSize="10.5" fontWeight="800" fill="#111318">כיכר רבין</text>
      </g>

      {/* the car */}
      <g transform={animate ? undefined : "translate(166 368) rotate(-62)"}>
        {animate && <animateMotion dur="11s" repeatCount="indefinite" rotate="auto" path={ROUTE} keyPoints="0;1;1" keyTimes="0;0.86;1" calcMode="spline" keySplines="0.45 0 0.3 1; 0 0 1 1" />}
        <circle r="17" fill="#2457FF" opacity="0.14" />
        <circle r="12" fill="#fff" stroke="rgba(17,19,24,.1)" strokeWidth="1" />
        <path d="M-5 -5.5 L7 0 L-5 5.5 L-2.2 0 Z" fill="#2457FF" />
      </g>
    </svg>
  );
}
