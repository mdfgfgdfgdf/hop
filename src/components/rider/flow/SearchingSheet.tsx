"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, CreditCard } from "lucide-react";
import { formatILS } from "@/lib/format";
import { PAYMENT_METHOD_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { Button } from "@/components/ui";
import { formatClock, useIsDesktop, useNow } from "../lib/hooks";
import { SearchGauge } from "../motion";
import { RouteSummary } from "../RouteSummary";
import { CancelRideDialog } from "./CancelRideDialog";
import { SheetFooter } from "./SheetLayout";

const SEARCH_LINES = ["בודקים מי הכי קרוב אליכם", "שולחים את הבקשה לנהגים בסביבה", "עוד רגע — כמעט שם"];

/** Micro-copy that keeps talking while we search. */
export function searchingCopy(status: RideDTO["status"], elapsedS: number) {
  if (status === "offered") return { title: "מצאנו נהג קרוב!", line: "ממתינים שיאשר — זה לוקח שניות." };
  if (elapsedS > 75) return { title: "מחפשים נהג…", line: "לוקח קצת יותר מהרגיל. אנחנו לא מוותרים." };
  return { title: "מחפשים נהג…", line: SEARCH_LINES[Math.floor(elapsedS / 4) % SEARCH_LINES.length] };
}

export function SearchingSheet({ ride, onCancelled }: { ride: RideDTO; onCancelled: (ride: RideDTO) => void }) {
  const now = useNow(1000);
  const [confirming, setConfirming] = useState(false);
  const elapsed = Math.max(0, (now - Date.parse(ride.requestedAt)) / 1000);
  const offered = ride.status === "offered";
  const PayIcon = ride.paymentMethod === "cash" ? Banknote : CreditCard;
  const copy = searchingCopy(ride.status, elapsed);
  // Phone: gauge beside the copy so the pickup halo stays visible above the sheet.
  // Desktop side panel: the gauge is the centred hero of the moment.
  const isDesktop = useIsDesktop();

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-4 lg:flex-col lg:gap-1 lg:pt-6 lg:text-center">
        <SearchGauge found={offered} size={isDesktop ? 168 : 88} label={offered ? "נמצא נהג קרוב" : "מחפשים נהג"} />
        <div className="min-w-0 flex-1 lg:flex lg:flex-col lg:items-center">
          <div role="status" aria-live="polite" className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2 key={copy.title} className="display text-[26px] lg:text-[30px]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
                {copy.title}
              </motion.h2>
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={copy.line} className="mt-0.5 text-sm text-fg-muted" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                {copy.line}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 lg:mt-3 lg:justify-center">
            <span className="pill pill-brand tabular-nums" aria-label={`זמן חיפוש ${formatClock(elapsed)}`}>
              <span className="relative flex h-2 w-2" aria-hidden>
                {!offered && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" />}
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              <span className="ltr-nums">{formatClock(elapsed)}</span>
            </span>
            {/* phone: the ride summary line lives here so the sheet stays short */}
            <span className="truncate text-xs font-semibold text-fg-muted lg:hidden">
              {ride.serviceType.nameHe} · {PAYMENT_METHOD_HE[ride.paymentMethod]} · <span className="ltr-nums text-fg">{formatILS(ride.quotedTotalAgorot)}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 hidden h-1 overflow-hidden rounded-full bg-brand-100 lg:block" aria-hidden>
        <motion.div
          className={offered ? "h-full w-1/3 rounded-full bg-brand" : "h-full w-1/3 rounded-full bg-[linear-gradient(90deg,transparent,var(--brand),transparent)]"}
          animate={offered ? { x: "0%", width: "100%" } : { x: ["150%", "-300%"] }}
          transition={offered ? { duration: 0.6 } : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="tile mt-4 rounded-[22px] px-3 py-1.5 lg:py-2">
        <RouteSummary compact pickup={{ address: ride.pickup.address }} dropoff={{ address: ride.dropoff.address }} />
        <div className="divider my-1.5 hidden lg:block" />
        <div className="hidden items-center justify-between gap-3 py-1 text-sm lg:flex">
          <span className="font-bold">{ride.serviceType.nameHe}</span>
          <span className="flex items-center gap-2 text-fg-muted">
            <PayIcon size={16} aria-hidden />
            {PAYMENT_METHOD_HE[ride.paymentMethod]}
            <span className="font-extrabold text-fg ltr-nums">{formatILS(ride.quotedTotalAgorot)}</span>
          </span>
        </div>
      </div>

      <SheetFooter>
        <Button block variant="glass" onClick={() => setConfirming(true)} data-testid="cancel-search">
          ביטול החיפוש · ללא עלות
        </Button>
      </SheetFooter>
      <CancelRideDialog ride={ride} open={confirming} onClose={() => setConfirming(false)} onCancelled={onCancelled} feeLikely={false} />
    </div>
  );
}
