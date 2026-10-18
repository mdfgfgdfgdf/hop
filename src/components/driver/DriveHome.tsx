"use client";
/**
 * Driver home: full-bleed night map + one glass sheet that switches between
 * idle (availability + stats), active ride and completion. Offers are shown by
 * the global OfferOverlay on top.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { api } from "@/lib/api";
import { formatILS } from "@/lib/format";
import type { EarningsDTO, LatLng, Polyline } from "@/lib/types";
import { Sheet, Skeleton, cn } from "@/components/ui";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { useDriverRuntime } from "./DriverRuntime";
import { useElementHeight, useIsDesktop } from "./hooks";
import { DriverMap } from "./DriverMap";
import { DriverMenu } from "./DriverMenu";
import { HomePanel } from "./HomePanel";
import { ActiveRidePanel } from "./ActiveRidePanel";
import { CompletionPanel } from "./CompletionPanel";
import { PHASE_SHORT_HE, ridePhase } from "./labels";

export function DriveHome() {
  const { profile, activeRide, offer, completed, geo, rideLoaded, approved } = useDriverRuntime();
  const isDesktop = useIsDesktop();
  const [menuOpen, setMenuOpen] = useState(false);
  const [earnings, setEarnings] = useState<EarningsDTO | null>(null);
  const [earningsError, setEarningsError] = useState(false);
  const [sheetRef, sheetH] = useElementHeight<HTMLDivElement>();

  const completedId = completed?.id ?? null;
  const activeRideId = activeRide?.id ?? null;
  useEffect(() => {
    if (!approved || completedId) return;
    let active = true;
    api.driver
      .earnings("today")
      .then(({ earnings: e }) => {
        if (!active) return;
        setEarnings(e);
        setEarningsError(false);
      })
      .catch(() => active && setEarningsError(true));
    return () => {
      active = false;
    };
  }, [approved, completedId, activeRideId]);

  const pos = geo.position;
  const meLat = pos?.lat;
  const meLng = pos?.lng;
  const meHeading = pos?.heading ?? null;
  const me = useMemo(() => (meLat != null && meLng != null ? { lat: meLat, lng: meLng, heading: meHeading } : null), [meLat, meLng, meHeading]);

  const phase = activeRide ? ridePhase(activeRide) : null;

  const view = useMemo(() => {
    let pickup: LatLng | null = null;
    let dropoff: LatLng | null = null;
    let polyline: Polyline | null = null;
    let guide = false;
    let frame: LatLng[] | null = null;
    let key = "idle";
    if (completed) {
      pickup = completed.pickup;
      dropoff = completed.dropoff;
      polyline = completed.polyline;
      frame = [completed.pickup, completed.dropoff];
      key = `done:${completed.id}`;
    } else if (activeRide && phase) {
      pickup = activeRide.pickup;
      dropoff = activeRide.dropoff;
      if (phase === "on_trip") {
        polyline = activeRide.polyline;
        frame = [me ?? activeRide.pickup, activeRide.dropoff];
      } else {
        polyline = me ? [[me.lat, me.lng], [activeRide.pickup.lat, activeRide.pickup.lng]] : null;
        guide = true;
        frame = me ? [me, activeRide.pickup] : [activeRide.pickup];
      }
      key = `ride:${activeRide.id}:${phase === "on_trip" ? "trip" : "pickup"}`;
    } else if (offer) {
      pickup = offer.pickup;
      dropoff = offer.dropoff;
      polyline = offer.polyline;
      frame = [...(me ? [me] : []), offer.pickup, offer.dropoff];
      key = `offer:${offer.id}`;
    }
    return { pickup, dropoff, polyline, guide, frame, key };
  }, [completed, activeRide, phase, offer, me]);

  const sheetBucket = Math.round(sheetH / 40) * 40;
  const padding = useMemo(
    () =>
      isDesktop
        ? { top: 70, bottom: 70, left: 70, right: 490 }
        : offer && !activeRide && !completed
          ? { top: 70, bottom: 520, left: 40, right: 40 }
          : { top: 130, bottom: sheetBucket + 60, left: 40, right: 40 },
    [isDesktop, offer, activeRide, completed, sheetBucket],
  );

  const panel = completed ? "completed" : activeRide && phase ? "ride" : "home";
  const showHomeSkeleton = approved && !rideLoaded && panel === "home";
  const center = !completed && !activeRide && earnings ? (
    <Link href="/drive/earnings" className="glass glass-pill pointer-events-auto flex h-12 items-center gap-2 px-4 text-sm font-bold" aria-label="הכנסות היום">
      <span className="text-fg-muted">היום</span>
      <span className="text-base font-extrabold tabular-nums">{formatILS(earnings.netAgorot)}</span>
    </Link>
  ) : activeRide && phase ? (
    <div className="glass glass-pill flex h-12 items-center gap-2 px-4 text-sm font-bold" role="status">
      <span className="relative flex h-2.5 w-2.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
      </span>
      {PHASE_SHORT_HE[phase]}
    </div>
  ) : null;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <h1 className="sr-only">HOP לנהגים</h1>
      <DriverMap
        className="absolute inset-0"
        me={me}
        meKind={activeRide ? "driver" : "me"}
        pickup={view.pickup}
        dropoff={view.dropoff}
        polyline={view.polyline}
        guide={view.guide}
        frame={view.frame}
        viewKey={`${view.key}:${isDesktop ? "d" : "m"}`}
        padding={padding}
        pulse={!activeRide && !completed && profile?.availability === "online"}
        recenterClassName="end-3 top-[calc(var(--safe-top)+3.25rem)] lg:end-4 lg:top-4"
      />

      {/* mobile top bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-[calc(var(--safe-top)+3.25rem)] lg:hidden">
        <button type="button" onClick={() => setMenuOpen(true)} className="glass glass-pill pointer-events-auto flex h-12 shrink-0 items-center gap-1.5 ps-1.5 pe-3" aria-label="פתיחת תפריט" data-testid="menu-button">
          <LogoMark size={36} title="HOP" />
          <Menu size={20} aria-hidden />
        </button>
        <div className="flex min-w-0 justify-center">{center}</div>
        <span className="w-12 shrink-0" aria-hidden />
      </div>

      <Sheet aria-label={panel === "ride" ? "נסיעה פעילה" : panel === "completed" ? "סיכום נסיעה" : "מצב נהג"} className="lg:bottom-auto! lg:max-h-[calc(100dvh-2rem)]!">
        <div ref={sheetRef} className="grid gap-4">
          <div className="hidden items-center justify-between lg:flex">
            <span className="flex items-center gap-2.5">
              <LogoMark size={38} />
              <Logo height={22} color="currentColor" />
            </span>
            <button type="button" onClick={() => setMenuOpen(true)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[color-mix(in_oklab,var(--fg)_8%,transparent)]" aria-label="פתיחת תפריט">
              <Menu size={22} aria-hidden />
            </button>
          </div>
          <div className={cn(panel === "home" && "animate-fade-up")} key={panel}>
            {showHomeSkeleton ? (
              <div className="grid gap-3" aria-busy>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : panel === "completed" && completed ? (
              <CompletionPanel ride={completed} />
            ) : panel === "ride" && activeRide ? (
              <ActiveRidePanel ride={activeRide} me={me} />
            ) : (
              <HomePanel earnings={earnings} earningsError={earningsError} showNav={isDesktop} />
            )}
          </div>
          {profile && panel === "home" && isDesktop && profile.vehiclePlate && (
            <p className="text-xs text-fg-muted">
              {[profile.vehicleMake, profile.vehicleModel, profile.vehicleColor].filter(Boolean).join(" · ")} · <span className="ltr-nums">{profile.vehiclePlate}</span>
            </p>
          )}
        </div>
      </Sheet>

      <DriverMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </main>
  );
}
