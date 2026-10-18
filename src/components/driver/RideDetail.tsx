"use client";
/** One past ride: mini map, payout breakdown, rating, timeline, report an incident. */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleDot, Flag, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, formatDistance, formatDuration, formatTime } from "@/lib/format";
import { CANCELLED_BY_HE, RIDE_STATUS_HE } from "@/lib/labels";
import type { RideDTO, RideEventDTO } from "@/lib/types";
import { Avatar, Button, Pill, Skeleton, StarRating, useToast } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { DriverPage, Section } from "./DriverPage";
import { DriverMap } from "./DriverMap";
import { PayoutBreakdown } from "./PayoutBreakdown";
import { AddressStack } from "./AddressStack";
import { NeedleLoader, StaggerItem, StaggerList } from "./motion";
import { Notice } from "./Notice";
import { errorCode, errorMessage } from "./errors";
import { RIDE_EVENT_HE } from "./labels";

const HIDDEN_EVENTS = new Set(["searching", "offer_declined", "offer_expired"]);

function eventText(e: RideEventDTO, meId: string | null) {
  const d = e.data ?? {};
  if (e.type === "offered") return d.driverId === meId ? "הנסיעה הוצעה לך" : null;
  if (e.type === "rated") {
    const stars = typeof d.stars === "number" ? ` · ${d.stars}★` : "";
    return d.by === "driver" ? `דירגתם את הנוסע${stars}` : `הנוסע דירג את הנסיעה${stars}`;
  }
  if (e.type === "cancelled") {
    const by = typeof d.by === "string" && d.by in CANCELLED_BY_HE ? CANCELLED_BY_HE[d.by as keyof typeof CANCELLED_BY_HE] : null;
    return by ? `הנסיעה בוטלה על ידי ${by}` : RIDE_EVENT_HE.cancelled;
  }
  return RIDE_EVENT_HE[e.type] ?? e.type;
}

export function RideDetail({ id }: { id: string }) {
  const { user } = useSession();
  const toast = useToast();
  const [ride, setRide] = useState<RideDTO | null>(null);
  const [events, setEvents] = useState<RideEventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [rating, setRating] = useState(false);

  useEffect(() => {
    let active = true;
    api.rides
      .get(id)
      .then(({ ride: r }) => active && setRide(r))
      .catch((err: unknown) => active && setError(errorCode(err) === "forbidden" || errorCode(err) === "not_found" ? "הנסיעה לא נמצאה או שאינה משויכת אליך." : errorMessage(err)));
    api.rides
      .events(id)
      .then(({ events: ev }) => active && setEvents(ev))
      .catch(() => active && setEvents([]));
    return () => {
      active = false;
    };
  }, [id]);

  const frame = useMemo(() => (ride ? [ride.pickup, ride.dropoff] : null), [ride]);
  const timeline = (events ?? []).map((e) => ({ e, text: eventText(e, user?.id ?? null) })).filter((x) => x.text && !HIDDEN_EVENTS.has(x.e.type));

  async function rate() {
    if (!ride || !stars) return;
    setRating(true);
    try {
      const { ride: r } = await api.rides.rate(ride.id, stars);
      setRide(r);
      toast.success("תודה! הדירוג נשמר");
    } catch (err) {
      toast.error("הדירוג לא נשמר", errorMessage(err));
    } finally {
      setRating(false);
    }
  }

  return (
    <DriverPage title="פרטי נסיעה" subtitle={ride ? formatDateTime(ride.requestedAt) : undefined} back="/drive/history" backLabel="חזרה להיסטוריה" wide>
      {error ? (
        <Notice tone="danger" live title="לא ניתן להציג את הנסיעה">
          {error}
        </Notice>
      ) : !ride ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-3xl" />
          <div className="grid content-start gap-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24" />
            <Skeleton className="h-32" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <div className="grid gap-4">
            <div className="relative h-60 overflow-hidden rounded-[28px] border border-line sm:h-72">
              <DriverMap pickup={ride.pickup} dropoff={ride.dropoff} polyline={ride.polyline} frame={frame} viewKey={ride.id} interactive={false} showRecenter={false} padding={{ top: 40, bottom: 40, left: 40, right: 40 }} />
            </div>
            <Section>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Pill tone={ride.status === "completed" ? "success" : ride.status === "cancelled" ? "muted" : "brand"} className={ride.status !== "completed" && ride.status !== "cancelled" ? "bg-brand/20! text-[#b8caff]!" : undefined}>{RIDE_STATUS_HE[ride.status]}</Pill>
                <Pill tone="ink">{ride.serviceType.nameHe}</Pill>
                {ride.isDemo && <Pill tone="warning">נסיעת הדגמה</Pill>}
              </div>
              <AddressStack pickup={ride.pickup.address} dropoff={ride.dropoff.address} pickupHint={ride.startedAt ? `נאסף ב-${formatTime(ride.startedAt)}` : undefined} dropoffHint={ride.completedAt ? `הגעה ב-${formatTime(ride.completedAt)}` : undefined} />
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] p-3">
                  <dt className="text-xs text-fg-muted">מרחק</dt>
                  <dd className="font-extrabold tabular-nums">{formatDistance(ride.actualDistanceM ?? ride.estimatedDistanceM)}</dd>
                </div>
                <div className="rounded-2xl bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] p-3">
                  <dt className="text-xs text-fg-muted">משך</dt>
                  <dd className="font-extrabold tabular-nums">{formatDuration(ride.actualDurationS ?? ride.estimatedDurationS)}</dd>
                </div>
              </dl>
              {ride.status === "cancelled" && ride.cancelReason && <p className="mt-3 text-xs text-fg-muted">סיבת ביטול: {ride.cancelReason === "no_drivers_available" ? "לא נמצא נהג זמין" : ride.cancelReason}</p>}
            </Section>
          </div>

          <div className="grid gap-4">
            <Section title="תשלום">
              <PayoutBreakdown ride={ride} />
            </Section>

            {ride.rider && (
              <Section title="הנוסע">
                <div className="flex items-center gap-3">
                  <Avatar name={ride.rider.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{ride.rider.name}</div>
                    <div className="text-xs text-fg-muted">{ride.driverRating != null ? "הדירוג שנתתם" : ride.status === "completed" ? "עוד לא דירגתם" : "—"}</div>
                  </div>
                  {ride.driverRating != null && <StarRating value={ride.driverRating} readOnly size={20} />}
                </div>
                {ride.status === "completed" && ride.driverRating == null && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] p-3">
                    <StarRating value={stars} onChange={setStars} size={30} />
                    <Button size="sm" variant="glass" disabled={!stars} loading={rating} onClick={() => void rate()}>
                      שליחת דירוג
                    </Button>
                  </div>
                )}
              </Section>
            )}

            <Section title="ציר זמן">
              {!events ? (
                <NeedleLoader size={30} />
              ) : timeline.length === 0 ? (
                <p className="text-sm text-fg-muted">אין אירועים להצגה.</p>
              ) : (
                <StaggerList as="ol" className="relative grid gap-3 ps-1">
                  <span aria-hidden className="absolute start-[13px] top-2 bottom-2 w-px bg-line" />
                  {timeline.map(({ e, text }) => (
                    <StaggerItem key={e.id} className="relative flex items-start gap-3">
                      <span className={"relative z-10 mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full " + (e.type === "completed" ? "bg-success text-white" : e.type.includes("cancel") ? "bg-danger/80 text-white" : "bg-surface text-[#8fb0ff] ring-1 ring-line")}>
                        <CircleDot size={13} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{text}</div>
                        <div className="text-xs text-fg-muted tabular-nums">{formatTime(e.createdAt)}</div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              )}
            </Section>

            <div className="grid gap-2 sm:grid-cols-2">
              <Link href={`/drive/support?new=incident&rideId=${ride.id}`} className="btn btn-glass h-14" data-testid="report-incident">
                <Flag size={18} aria-hidden /> דיווח על אירוע
              </Link>
              <Link href={`/drive/support?new=payment&rideId=${ride.id}`} className="btn btn-ghost h-14">
                <Wallet size={18} aria-hidden /> שאלה על התשלום
              </Link>
            </div>
          </div>
        </div>
      )}
    </DriverPage>
  );
}
