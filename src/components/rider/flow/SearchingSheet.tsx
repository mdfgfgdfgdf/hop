"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, CreditCard } from "lucide-react";
import { formatILS } from "@/lib/format";
import { PAYMENT_METHOD_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { Button } from "@/components/ui";
import { formatClock, useNow } from "../lib/hooks";
import { NeedleGauge } from "../motion";
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <NeedleGauge size={40} label="מחפשים נהג" className="mt-0.5 shrink-0" />
          <div role="status" aria-live="polite" className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2 key={copy.title} className="display text-[26px]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
                {copy.title}
              </motion.h2>
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={copy.line} className="mt-1 text-sm text-fg-muted" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                {copy.line}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <span className="pill pill-brand shrink-0 tabular-nums" aria-label={`זמן חיפוש ${formatClock(elapsed)}`}>
          <span className="ltr-nums">{formatClock(elapsed)}</span>
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-brand-100" aria-hidden>
        <motion.div
          className="h-full w-1/3 rounded-full bg-brand"
          animate={offered ? { x: "0%", width: "100%" } : { x: ["150%", "-300%"] }}
          transition={offered ? { duration: 0.6 } : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="mt-4 rounded-[22px] border border-line bg-surface/70 px-3 py-2">
        <RouteSummary compact pickup={{ address: ride.pickup.address }} dropoff={{ address: ride.dropoff.address }} />
        <div className="divider my-1.5" />
        <div className="flex items-center justify-between gap-3 py-1 text-sm">
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
