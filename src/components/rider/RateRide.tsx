"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart } from "lucide-react";
import { api } from "@/lib/api";
import type { RideDTO } from "@/lib/types";
import { Button, StarRating, Textarea, useToast } from "@/components/ui";
import { describeError, errorCode, type FriendlyError } from "./lib/errors";
import { InlineError } from "./InlineError";

const STAR_COPY = ["", "גרוע", "לא משהו", "בסדר", "טוב מאוד", "מעולה!"];

/** Star rating + optional comment → api.rides.rate. */
export function RateRide({ ride, onRated }: { ride: RideDTO; onRated?: (ride: RideDTO) => void }) {
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [done, setDone] = useState<number | null>(ride.riderRating);

  async function submit() {
    if (!stars) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.rides.rate(ride.id, stars, comment.trim() || null);
      setDone(stars);
      toast.success("תודה על הדירוג!", "המשוב עוזר לנו לשמור על נסיעות טובות.");
      onRated?.(res.ride);
    } catch (err) {
      if (errorCode(err) === "already_rated") setDone(stars);
      else setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  if (done != null) {
    return (
      <div className="tile flex items-center gap-3 rounded-[22px] p-4" role="status">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-brand">
          <Heart size={18} aria-hidden />
        </span>
        <div className="flex-1">
          <div className="text-sm font-bold">תודה! דירגתם את הנסיעה</div>
          <StarRating value={done} readOnly size={18} />
        </div>
      </div>
    );
  }

  return (
    <div className="tile rounded-[22px] p-4" data-testid="rate-ride">
      <div className="text-sm font-bold">{ride.driver ? `איך הייתה הנסיעה עם ${ride.driver.name.split(/\s+/)[0]}?` : "איך הייתה הנסיעה?"}</div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <StarRating value={stars} onChange={setStars} size={34} />
        <span className="text-sm font-bold text-fg-muted" aria-live="polite">
          {STAR_COPY[stars]}
        </span>
      </div>
      <AnimatePresence initial={false}>
        {stars > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }} exit={{ height: 0, opacity: 0, overflow: "hidden" }} className="-mx-1 overflow-hidden px-1 pb-1.5">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={stars >= 4 ? "רוצים להוסיף מחמאה לנהג? (לא חובה)" : "ספרו לנו מה אפשר לשפר (לא חובה)"}
              aria-label="הערה לדירוג"
              maxLength={500}
              rows={2}
              className="mt-3 min-h-[76px]!"
            />
            {error && <InlineError error={error} className="mt-3" />}
            <Button variant="glass" block className="mt-3 text-brand-700" onClick={submit} loading={busy} data-testid="rate-submit">
              שליחת דירוג
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
