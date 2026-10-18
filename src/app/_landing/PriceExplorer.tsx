"use client";
/**
 * The transparent-price card: pick an example trip and see the rider price,
 * HOP's commission and the driver's payout as separate lines. All amounts were
 * computed by the server fare engine from the active tariff — and they are
 * labelled as an example, never a quote.
 */
import { useId, useState } from "react";
import { RollingNumber } from "@/components/fluid";
import { formatILS } from "@/lib/money";
import { percentFromBp } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import type { ExampleTrip } from "./example-fare";

export function PriceExplorer({
  trips,
  commissionPercentBp,
  bookingFeeAgorot,
  demoTariff,
}: {
  trips: ExampleTrip[];
  commissionPercentBp: number;
  bookingFeeAgorot: number;
  demoTariff: boolean;
}) {
  const name = useId();
  const [id, setId] = useState<ExampleTrip["id"]>("city");
  const trip = trips.find((t) => t.id === id) ?? trips[0];
  const driverShare = trip.riderTotal > 0 ? (trip.driverPayout / trip.riderTotal) * 100 : 0;
  const commissionLabel = `${percentFromBp(commissionPercentBp)} מהנסיעה${bookingFeeAgorot > 0 ? " + דמי הזמנה" : ""}`;

  return (
    <div className="lp-card lp-receipt" data-testid="landing-fare-example">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold">פירוט נסיעה</h3>
          <p className="mt-0.5 text-sm text-fg-muted">
            {trip.km} ק״מ · {trip.minutes} דק׳ · שעות היום
          </p>
        </div>
        <span className="pill pill-warning shrink-0">דוגמה</span>
      </div>

      <fieldset className="mt-5">
        <legend className="sr-only">אורך הנסיעה לדוגמה</legend>
        <div className="lp-seg">
          {trips.map((t) => (
            <label key={t.id} className={cn("lp-seg-opt", t.id === id && "is-on")}>
              <input type="radio" name={name} value={t.id} checked={t.id === id} onChange={() => setId(t.id)} className="sr-only" />
              <span className="font-bold">{t.label}</span>
              <span className="text-xs text-fg-muted">{t.km} ק״מ</span>
            </label>
          ))}
        </div>
      </fieldset>

      <dl className="mt-5 grid gap-2.5 text-[15px]">
        {trip.lines.map((l) => (
          <div key={l.key} className="flex items-center justify-between gap-3">
            <dt className="text-fg-muted">{l.label}</dt>
            <dd className="font-semibold">
              <RollingNumber value={formatILS(l.amount)} />
            </dd>
          </div>
        ))}
      </dl>

      <div className="lp-rule my-4" />

      <div className="flex items-end justify-between gap-3">
        <div className="text-[15px] font-bold">הנוסע משלם</div>
        <div className="text-[2rem] leading-none font-black tracking-tight">
          <RollingNumber value={formatILS(trip.riderTotal)} />
        </div>
      </div>

      <div className="mt-5" aria-hidden>
        <div className="lp-split">
          <span className="lp-split-driver" style={{ width: `${driverShare}%` }} />
          <span className="lp-split-hop" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="lp-tile lp-tile-brand">
          <div className="text-xs font-bold">הנהג מקבל</div>
          <div className="mt-1 text-xl font-black">
            <RollingNumber value={formatILS(trip.driverPayout)} />
          </div>
          <div className="mt-0.5 text-xs">נטו, מוצג לו לפני האישור</div>
        </div>
        <div className="lp-tile">
          <div className="text-xs font-bold text-fg-muted">עמלת HOP</div>
          <div className="mt-1 text-xl font-black">
            <RollingNumber value={formatILS(trip.hopCommission)} />
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">{commissionLabel}</div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-fg-muted">
        חישוב לדוגמה לפי {demoTariff ? "תעריף ההדגמה (לא תעריף רשמי)" : "התעריף הפעיל"}, בשעות היום וללא הנחות. זו לא הצעת מחיר: המחיר בפועל מחושב בשרת לפי המסלול והשעה, ומוצג לפני ההזמנה.
      </p>
    </div>
  );
}
