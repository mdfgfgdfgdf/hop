"use client";
import { useState } from "react";
import { Banknote, CreditCard, Timer } from "lucide-react";
import { api } from "@/lib/api";
import { formatDistance, formatDuration, formatILS } from "@/lib/format";
import type { RideDTO } from "@/lib/types";
import { Button, DemoBanner, Segmented, Skeleton, useToast } from "@/components/ui";
import { CountUp, GlowButton, NeedleGauge, StaggerItem, StaggerList } from "../motion";
import { describeError, errorCode, type FriendlyError } from "../lib/errors";
import { formatClock, useNow } from "../lib/hooks";
import { usePaymentPreference, type PaymentMethod } from "../lib/storage";
import { InlineError } from "../InlineError";
import { RouteSummary } from "../RouteSummary";
import { PromoField } from "./PromoField";
import { QuoteCard } from "./QuoteCard";
import { SheetFooter } from "./SheetLayout";
import { placeLabel, type SelectedPlace } from "./types";
import type { useQuote } from "./useQuote";

type QuoteState = ReturnType<typeof useQuote>;

export function QuoteSheet({
  pickup,
  dropoff,
  quote,
  onEditPickup,
  onEditDropoff,
  onOrdered,
  onRideActive,
  onOrderingChange,
}: {
  pickup: SelectedPlace;
  dropoff: SelectedPlace;
  quote: QuoteState;
  onEditPickup: () => void;
  onEditDropoff: () => void;
  onOrdered: (ride: RideDTO) => void;
  onRideActive: () => void;
  /** Lets the map chrome show the "sending" state while the order is in flight. */
  onOrderingChange?: (ordering: boolean) => void;
}) {
  const toast = useToast();
  const preferred = usePaymentPreference();
  const [payment, setPayment] = useState<PaymentMethod>(preferred);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState<FriendlyError | null>(null);
  const now = useNow(1000);

  const data = quote.data;
  const quotes = data?.quotes ?? [];
  const selected = quotes.find((q) => q.serviceType.id === selectedId && q.availableDrivers > 0) ?? quotes.find((q) => q.availableDrivers > 0) ?? null;
  const expiresIn = data?.quotes[0] ? (Date.parse(data.quotes[0].expiresAt) - now) / 1000 : null;
  const error = quote.error;
  const noneAvailable = data != null && quotes.length > 0 && !selected;

  async function order() {
    if (!selected) return;
    setOrdering(true);
    onOrderingChange?.(true);
    setOrderError(null);
    try {
      const { ride } = await api.rides.create({ quoteId: selected.id, paymentMethod: payment });
      onOrderingChange?.(false);
      onOrdered(ride);
    } catch (err) {
      const code = errorCode(err);
      if (code === "quote_expired" || code === "quote_used" || code === "service_unavailable") {
        quote.refresh();
        toast.info("המחיר עודכן", "ביקשנו הצעת מחיר חדשה — בדקו ואשרו שוב.");
      } else if (code === "ride_active") {
        toast.info("כבר יש לכם נסיעה פעילה", "העברנו אתכם אליה.");
        onRideActive();
      } else {
        setOrderError(describeError(err));
      }
      setOrdering(false);
      onOrderingChange?.(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="tile mb-3 rounded-[20px] px-3 py-1">
        <RouteSummary
          compact
          pickup={{ address: placeLabel(pickup) }}
          dropoff={{ address: placeLabel(dropoff) }}
          pickupAction={<EditLink onClick={onEditPickup} label="שינוי נקודת האיסוף" />}
          dropoffAction={<EditLink onClick={onEditDropoff} label="שינוי היעד" />}
        />
      </div>

      <div className={error && !data ? "hidden" : "mb-3 flex flex-wrap items-center gap-2 text-xs"}>
        {data ? (
          <span className="pill well tabular-nums text-fg">
            {formatDistance(data.route.distanceM)} · {formatDuration(data.route.durationS)}
          </span>
        ) : (
          <Skeleton className="h-7 w-28 rounded-full" />
        )}
        {data?.isDemoTariff && <DemoBanner compact text="תעריף הדגמה" />}
        {expiresIn != null && !error && (
          <span className="ms-auto inline-flex items-center gap-1 font-semibold text-fg-muted" aria-live="off" title="הצעת המחיר תקפה לזמן מוגבל ומתעדכנת אוטומטית">
            {quote.refreshing ? (
              <>
                <NeedleGauge size={16} label="מעדכנים מחיר" /> מעדכנים מחיר…
              </>
            ) : (
              <>
                <Timer size={12} aria-hidden /> תקף <span className="ltr-nums">{formatClock(expiresIn)}</span>
              </>
            )}
          </span>
        )}
      </div>

      {error && !data && <InlineError error={error} className="mb-3" />}

      {!data && !error && (
        <div className="space-y-2" aria-busy="true">
          <div className="flex items-center gap-2 px-1 pb-1 text-sm font-semibold text-fg-muted">
            <NeedleGauge size={22} label="מחשבים מחיר" /> מחשבים את המחיר המדויק לנסיעה שלכם…
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="tile flex items-center gap-3 rounded-[22px] px-3 py-3">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      )}

      {data && (
        <StaggerList as="div" role="radiogroup" label="סוג נסיעה" className="space-y-2">
          {quotes.map((q) => (
            <StaggerItem as="div" key={q.serviceType.id}>
              <QuoteCard
                quote={q}
                selected={selected?.serviceType.id === q.serviceType.id}
                expanded={expanded}
                onSelect={() => setSelectedId(q.serviceType.id)}
                onToggleBreakdown={() => setExpanded((v) => !v)}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {data && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold">אמצעי תשלום</span>
            <Segmented<PaymentMethod>
              className="w-full sm:w-auto [&>button]:min-h-10 [&>button]:flex-1"
              value={payment}
              onChange={setPayment}
              options={[
                { value: "cash", label: <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Banknote size={15} aria-hidden />מזומן</span> },
                { value: "card_demo", label: <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CreditCard size={15} aria-hidden />כרטיס (הדגמה)</span> },
              ]}
            />
          </div>
          {payment === "card_demo" && <p className="px-1 text-xs text-fg-muted">כרטיס הדגמה בלבד — לא יבוצע חיוב אמיתי.</p>}
          <PromoField applied={quote.promo} onApply={quote.applyPromo} onClear={quote.clearPromo} />
        </div>
      )}

      {orderError && <InlineError error={orderError} className="mt-3" />}
      {noneAvailable && (
        <InlineError className="mt-3" error={{ title: "אין כרגע נהגים זמינים", message: "כל הנהגים בסביבה עסוקים. נסו שוב בעוד דקה." }} action={<Button size="sm" variant="glass" onClick={quote.refresh}>רענון</Button>} />
      )}

      <SheetFooter>
        {error && !data ? (
          <GlowButton onClick={error.code === "outside_service_area" ? onEditPickup : error.code === "same_point" ? onEditDropoff : quote.refresh} data-testid="quote-error-action">
            {error.code === "outside_service_area" ? "בחירת נקודת איסוף אחרת" : error.code === "same_point" ? "שינוי יעד" : "ניסיון חוזר"}
          </GlowButton>
        ) : (
          <GlowButton onClick={order} loading={ordering} disabled={!selected || quote.loading} data-testid="order-button">
            {selected ? (
              <>
                הזמנת {selected.serviceType.nameHe} · <CountUp className="ltr-nums" value={selected.riderTotalAgorot} format={(n) => formatILS(n)} />
              </>
            ) : (
              "בחרו סוג נסיעה"
            )}
          </GlowButton>
        )}
      </SheetFooter>
    </div>
  );
}

function EditLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="min-h-10 shrink-0 rounded-full px-3 text-xs font-bold text-brand hover:bg-brand-50">
      שינוי
    </button>
  );
}
