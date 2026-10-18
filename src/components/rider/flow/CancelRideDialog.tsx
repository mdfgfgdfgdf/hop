"use client";
import { useState } from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { RideDTO } from "@/lib/types";
import { Button } from "@/components/ui";
import { describeError, type FriendlyError } from "../lib/errors";
import { Dialog } from "../Dialog";
import { InlineError } from "../InlineError";

const REASONS = ["הנהג מתעכב", "שיניתי את התוכניות", "הזמנתי בטעות", "אחר"] as const;
export const FREE_CANCEL_SEC = 120;

export function CancelRideDialog({
  ride,
  open,
  onClose,
  onCancelled,
  feeLikely,
}: {
  ride: RideDTO;
  open: boolean;
  onClose: () => void;
  onCancelled: (ride: RideDTO) => void;
  feeLikely: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const searching = !ride.acceptedAt;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.rides.cancel(ride.id, reason ?? (searching ? "ביטול חיפוש" : null));
      onCancelled(res.ride);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title={searching ? "לבטל את החיפוש?" : "לבטל את הנסיעה?"}
      description={searching ? "הביטול חינם — עוד לא שובץ נהג." : "הנהג כבר בדרך אליכם."}
      icon={<XCircle size={22} aria-hidden />}
    >
      {!searching && (
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-bold">מה הסיבה? (לא חובה)</legend>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason((cur) => (cur === r ? null : r))}
                aria-pressed={reason === r}
                className={
                  reason === r
                    ? "min-h-10 rounded-full bg-ink px-4 text-sm font-bold text-white"
                    : "min-h-10 rounded-full border border-line bg-surface px-4 text-sm font-semibold"
                }
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {feeLikely && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-warning/15 px-3 py-2.5 text-sm" role="note">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
          <span>
            <b>ייתכנו דמי ביטול.</b> עברו יותר מ־2 דקות מאז שהנהג אישר את הנסיעה.
          </span>
        </div>
      )}
      {error && <InlineError error={error} className="mb-4" />}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="glass" onClick={onClose} disabled={busy} data-autofocus>
          {searching ? "להמשיך לחפש" : "לא, להמשיך"}
        </Button>
        <Button variant="danger" onClick={confirm} loading={busy} data-testid="confirm-cancel">
          {searching ? "ביטול החיפוש" : "ביטול הנסיעה"}
        </Button>
      </div>
    </Dialog>
  );
}
