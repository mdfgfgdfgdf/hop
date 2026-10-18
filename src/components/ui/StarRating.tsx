"use client";
import { Star } from "lucide-react";
import { cn } from "./cn";

export function StarRating({ value, onChange, size = 32, readOnly }: { value: number; onChange?: (v: number) => void; size?: number; readOnly?: boolean }) {
  return (
    <div className="inline-flex gap-1" role={readOnly ? undefined : "radiogroup"} aria-label="דירוג" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role={readOnly ? undefined : "radio"}
          aria-checked={!readOnly ? n === value : undefined}
          aria-label={`${n} כוכבים`}
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={cn("transition-transform", !readOnly && "hover:scale-110 active:scale-95")}
        >
          <Star size={size} className={n <= value ? "fill-amber-400 text-amber-400" : "text-mist"} />
        </button>
      ))}
    </div>
  );
}
