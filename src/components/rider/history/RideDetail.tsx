"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, SearchX } from "lucide-react";
import { AnimatedLogo } from "@/components/brand/AnimatedLogo";
import { api } from "@/lib/api";
import { formatDateTime, formatTime } from "@/lib/format";
import { CANCELLED_BY_HE } from "@/lib/labels";
import type { RideDTO, RideEventDTO } from "@/lib/types";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { isLive } from "../ActiveRideProvider";
import { DriverCard } from "../DriverCard";
import { InlineError } from "../InlineError";
import { RateRide } from "../RateRide";
import { Receipt } from "../Receipt";
import { RiderMap, type MapMarker } from "../RiderMap";
import { RiderPage, Section } from "../RiderPage";
import { RouteSummary } from "../RouteSummary";
import { StatusPill } from "../StatusPill";
import { cancelReasonText } from "../flow/CancelledSheet";
import { describeError, type FriendlyError } from "../lib/errors";
import { eventLabel } from "../lib/events";
import { StaggerItem, StaggerList } from "../motion";

const MAP_PADDING = { top: 36, bottom: 36, left: 36, right: 36 };

export function RideDetail({ id }: { id: string }) {
  const [ride, setRide] = useState<RideDTO | null>(null);
  const [events, setEvents] = useState<RideEventDTO[] | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.rides.get(id), api.rides.events(id).catch(() => ({ events: [] as RideEventDTO[] }))])
      .then(([r, e]) => {
        if (cancelled) return;
        setRide(r.ride);
        setEvents(e.events);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(describeError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const markers = useMemo<MapMarker[]>(
    () => (ride ? [{ id: "pickup", kind: "pickup", ...ride.pickup }, { id: "dropoff", kind: "dropoff", ...ride.dropoff }] : []),
    [ride],
  );
  const fit = useMemo(() => (ride ? [ride.pickup, ride.dropoff] : null), [ride]);
  const notFound = error != null && (error.code === "not_found" || error.code === "forbidden");

  return (
    <RiderPage title="פרטי נסיעה" subtitle={ride ? formatDateTime(ride.requestedAt) : undefined} back="/ride/history" backLabel="חזרה להיסטוריה">
      {notFound && (
        <div className="card">
          <EmptyState icon={<SearchX size={26} aria-hidden />} title="לא מצאנו את הנסיעה הזו" description="ייתכן שהקישור שגוי או שהנסיעה שייכת לחשבון אחר." action={<Link href="/ride/history" className="btn btn-glass">לכל הנסיעות</Link>} />
        </div>
      )}
      {error && !notFound && <InlineError error={error} action={<Button size="sm" variant="glass" onClick={() => setAttempt((a) => a + 1)}>ניסיון חוזר</Button>} />}
      {!ride && !error && <DetailSkeleton />}
      {ride && (
        <div data-testid="ride-detail">
          <div className="card mb-4 overflow-hidden p-0">
            <div className="relative h-48 sm:h-56">
              <RiderMap markers={markers} polyline={ride.polyline} fit={fit} fitPadding={MAP_PADDING} interactive={false} zoom={13} center={ride.pickup} />
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold">{ride.serviceType.nameHe}</div>
                  <div className="text-xs text-fg-muted">{formatDateTime(ride.requestedAt)}</div>
                </div>
                <StatusPill status={ride.status} />
              </div>
              <RouteSummary pickup={{ address: ride.pickup.address }} dropoff={{ address: ride.dropoff.address }} />
              {isLive(ride) && (
                <Link href="/ride" className="btn btn-primary btn-sm mt-3">
                  למעקב אחרי הנסיעה <ArrowLeft size={16} aria-hidden />
                </Link>
              )}
            </div>
          </div>

          {ride.status === "cancelled" && (
            <div className="well mb-4 rounded-2xl px-4 py-3 text-sm">
              <b>הנסיעה בוטלה{ride.cancelledBy ? ` על ידי ${CANCELLED_BY_HE[ride.cancelledBy]}` : ""}</b>
              {ride.cancelledAt ? ` · ${formatTime(ride.cancelledAt)}` : ""}
              {cancelReasonText(ride) && <div className="text-fg-muted">סיבה: {cancelReasonText(ride)}</div>}
            </div>
          )}

          {ride.status === "completed" && ride.riderRating == null && (
            <div className="mb-4">
              <RateRide ride={ride} onRated={setRide} />
            </div>
          )}

          {ride.driver && (
            <Section title="הנהג">
              <div className="card p-4">
                <DriverCard driver={ride.driver} compact />
              </div>
            </Section>
          )}

          <Section title="קבלה" action={<AnimatedLogo height={16} hopOn="hover" title="HOP" />}>
            <div className="card p-4">
              <Receipt ride={ride} />
            </div>
          </Section>

          <Section title="ציר זמן">
            <div className="card p-4">
              {events && events.length > 0 ? (
                <StaggerList as="ol" className="relative">
                  {events.map((e, i) => (
                    <StaggerItem key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < events.length - 1 && <span className="absolute start-[5px] top-5 -bottom-1 w-0.5 rounded-full bg-brand/25" aria-hidden />}
                      <span className={i === events.length - 1 ? "mt-1.5 h-3 w-3 shrink-0 rounded-full bg-brand" : "mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-brand bg-surface"} aria-hidden />
                      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                        <span className="text-sm font-semibold">{eventLabel(e.type)}</span>
                        <span className="shrink-0 text-xs text-fg-muted tabular-nums">{formatTime(e.createdAt)}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              ) : (
                <p className="text-sm text-fg-muted">אין אירועים להצגה.</p>
              )}
            </div>
          </Section>

          <Link href={`/ride/support?new=1&rideId=${ride.id}`} className="btn btn-glass btn-block" data-testid="report-problem">
            <Flag size={18} aria-hidden /> דיווח על בעיה בנסיעה
          </Link>
        </div>
      )}
    </RiderPage>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="טוען פרטי נסיעה">
      <div className="card mb-4 overflow-hidden p-0">
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="space-y-2 p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="card space-y-2 p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
