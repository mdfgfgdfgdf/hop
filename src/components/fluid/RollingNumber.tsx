"use client";
/**
 * Odometer text: every digit is a vertical 0–9 strip that rolls to its new
 * value; other characters (₪, ., spaces, minus) stay put. Digits are keyed
 * from the right so units stay in place when the number grows.
 * Pass the already-formatted string (e.g. formatILS(agorot)).
 */
import { cn } from "@/components/ui/cn";

const DIGITS = "0123456789";

export function RollingNumber({ value, className, label }: { value: string; className?: string; /** Screen-reader text; defaults to the value. */ label?: string }) {
  const chars = [...value];
  return (
    <span className={cn("rolling-number", className)} dir="ltr" role="text" aria-label={label ?? value}>
      {chars.map((ch, i) => {
        const fromEnd = chars.length - i;
        const d = DIGITS.indexOf(ch);
        if (d < 0) {
          return (
            <span key={`c${fromEnd}-${ch}`} className="rn-char" aria-hidden>
              {ch === " " || ch === " " ? " " : ch}
            </span>
          );
        }
        return (
          <span key={`d${fromEnd}`} className="rn-digit" aria-hidden>
            <span className="rn-strip" style={{ transform: `translateY(${-d * 10}%)`, transitionDelay: `${Math.min(fromEnd, 6) * 35}ms` }}>
              {DIGITS.split("").map((x) => (
                <span key={x}>{x}</span>
              ))}
            </span>
            {/* Invisible copy sizes the slot to the current digit. */}
            <span className="rn-sizer">{ch}</span>
          </span>
        );
      })}
    </span>
  );
}
