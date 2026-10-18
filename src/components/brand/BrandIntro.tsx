"use client";
/**
 * Animated HOP intro: the wordmark draws in letter by letter and the needle
 * sweeps around the "o", then the overlay dissolves into the app. Shown once
 * per browser session on first entry to an app route.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const KEY = "hop.intro.seen";

export function BrandIntro({ theme = "light", force = false, onDone }: { theme?: "light" | "dark"; force?: boolean; onDone?: () => void }) {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {
      /* private mode */
    }
    if (force || !seen) {
      // Defer to the next frame so the first paint is never blocked.
      const t = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(t);
    }
  }, [force]);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(
      () => {
        setShow(false);
        try {
          sessionStorage.setItem(KEY, "1");
        } catch {
          /* ignore */
        }
        onDone?.();
      },
      reduce ? 600 : 1900,
    );
    return () => clearTimeout(t);
  }, [show, reduce, onDone]);

  const bg = theme === "dark" ? "#111318" : "#F5F4F0";
  const ink = theme === "dark" ? "#F5F4F0" : "#111318";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[200] grid place-items-center"
          style={{ background: bg }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
          transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          aria-hidden
        >
          <div className="relative">
            <motion.div
              className="absolute -inset-16 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(36,87,255,.25), transparent 60%)" }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1.1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            <svg viewBox="0 0 318 170" width={220} height={118} className="relative">
              <defs>
                <mask id="intro-o-mask" maskUnits="userSpaceOnUse" x="110" y="30" width="110" height="110">
                  <rect x="110" y="30" width="110" height="110" fill="#fff" />
                  <motion.line
                    x1="165"
                    y1="85"
                    x2="206"
                    y2="44"
                    stroke="#000"
                    strokeWidth="9"
                    strokeLinecap="round"
                    style={{ originX: "165px", originY: "85px" }}
                    initial={{ rotate: reduce ? 0 : -300 }}
                    animate={{ rotate: 0 }}
                    transition={{ duration: 1.1, ease: [0.2, 0.9, 0.2, 1], delay: 0.25 }}
                  />
                </mask>
              </defs>
              <motion.g fill="#2457FF" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
                <path d="M0 0h30v130H0z" />
                <path d="M30 72a20 20 0 0 1 40 0v58h30V72a50 50 0 0 0-100 0z" />
              </motion.g>
              <motion.path
                fill="#2457FF"
                fillRule="evenodd"
                mask="url(#intro-o-mask)"
                d="M165 40a45 45 0 1 0 0 90a45 45 0 1 0 0-90zm0 28a17 17 0 1 1 0 34a17 17 0 1 1 0-34z"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ originX: "165px", originY: "85px" }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 }}
              />
              <motion.g fill="#2457FF" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.35 }}>
                <path d="M226 40h30v128h-30z" />
                <path fillRule="evenodd" d="M271 40a45 45 0 1 0 0 90a45 45 0 1 0 0-90zm0 28a17 17 0 1 1 0 34a17 17 0 1 1 0-34z" />
              </motion.g>
            </svg>
            <motion.div
              className="mt-5 text-center text-sm font-bold tracking-[0.3em]"
              style={{ color: ink, opacity: 0.7 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 0.7, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
            >
              MOVE WITH HOP
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
