"use client";
import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Accessibility, Car, ChevronDown, Clock3, Gem, Users } from "lucide-react";
import { formatEta, formatILS } from "@/lib/format";
import type { QuoteDTO } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { FareLines } from "../FareLines";
import { CountUp } from "../motion";

function ServiceIcon({ quote }: { quote: QuoteDTO }) {
  const id = quote.serviceType.id;
  const classes = quote.serviceType.vehicleClasses;
  const Icon = id.includes("accessible") || (classes.length === 1 && classes[0] === "accessible") ? Accessibility : id.includes("premium") || (classes.length === 1 && classes[0] === "premium") ? Gem : quote.serviceType.seats >= 6 ? Users : Car;
  return <Icon size={22} aria-hidden />;
}

export function QuoteCard({
  quote,
  selected,
  expanded,
  onSelect,
  onToggleBreakdown,
}: {
  quote: QuoteDTO;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleBreakdown: () => void;
}) {
  const unavailable = quote.availableDrivers === 0;
  const discount = quote.fare.discountAgorot;
  const breakdownRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className={cn(
        "rounded-[22px] transition-[box-shadow,background-color] duration-200",
        selected ? "tile-selected" : "tile tile-hover",
        unavailable && "opacity-60",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-disabled={unavailable || undefined}
        disabled={unavailable}
        onClick={onSelect}
        className="flex min-h-[72px] w-full items-center gap-3 rounded-[22px] px-3 py-2.5 text-start disabled:cursor-not-allowed"
        data-testid={`quote-${quote.serviceType.id}`}
      >
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors",
            selected ? "bg-brand-100 text-brand shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_22%,transparent)]" : "well text-fg-muted",
          )}
        >
          <ServiceIcon quote={quote} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-base font-extrabold">{quote.serviceType.nameHe}</span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-fg-muted" aria-label={`עד ${quote.serviceType.seats} נוסעים`}>
              <Users size={13} aria-hidden />
              <span className="tabular-nums">{quote.serviceType.seats}</span>
            </span>
          </span>
          {unavailable ? (
            <span className="block text-xs font-semibold text-danger">אין נהגים זמינים כרגע</span>
          ) : (
            <span className="flex min-w-0 items-center gap-1 text-xs whitespace-nowrap text-fg-muted">
              <Clock3 size={12} className="shrink-0" aria-hidden />
              <span>{quote.etaToPickupS != null ? `איסוף בעוד ${formatEta(quote.etaToPickupS)}` : "זמן הגעה לא ידוע"}</span>
              <span aria-hidden>·</span>
              <span className="truncate">{quote.availableDrivers === 1 ? "נהג אחד" : `${quote.availableDrivers} נהגים`}</span>
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <CountUp className={cn("text-lg font-extrabold ltr-nums", selected && "text-brand-700")} value={quote.riderTotalAgorot} format={(n) => formatILS(n)} />
          {discount > 0 && <span className="text-[11px] font-semibold text-fg-muted line-through ltr-nums">{formatILS(quote.riderTotalAgorot + discount)}</span>}
        </span>
      </button>
      {selected && !unavailable && (
        <div className="px-3 pb-2.5">
          <button
            type="button"
            onClick={onToggleBreakdown}
            aria-expanded={expanded}
            className="flex min-h-9 items-center gap-1 rounded-full px-2 text-xs font-bold text-brand hover:bg-brand-50"
          >
            פירוט המחיר
            <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                ref={breakdownRef}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
                exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                transition={{ duration: 0.25 }}
                onAnimationComplete={() => breakdownRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                className="scroll-mb-28 overflow-hidden"
              >
                <FareLines fare={quote.fare} className="px-2 pt-2 pb-1" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
