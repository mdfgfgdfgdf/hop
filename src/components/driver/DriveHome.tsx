"use client";
/**
 * Driver home: full-bleed map, a floating glass top bar with the living HOP
 * mark, and one glass sheet that switches between idle (availability + stats),
 * active ride and completion. Offers are shown by the global OfferOverlay.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu } from "lucide-react";
import { api } from "@/lib/api";
import { formatILS } from "@/lib/format";
import type { EarningsDTO, LatLng, Polyline } from "@/lib/types";
import { AnimatedMark, type LogoMode } from "@/components/brand/AnimatedLogo";
import { DemoBanner, Sheet, Skeleton, cn } from "@/components/ui";
import { useDriverRuntime } from "./DriverRuntime";
import { useElementHeight, useHydrated, useIsDesktop } from "./hooks";
import { DriverMap } from "./DriverMap";
import { DriverMenu } from "./DriverMenu";
import { HomePanel } from "./HomePanel";
import { ActiveRidePanel } from "./ActiveRidePanel";
import { CompletionPanel } from "./CompletionPanel";
import { PHASE_SHORT_HE, payoutOf, ridePhase } from "./labels";
import { firstName, useGreeting } from "./copy";
import { useSession } from "@/components/app/session";
import { Plate } from "./Plate";
import { TEXT } from "./tone";

/** Counts changes of `value` after mount (undefined until the first change). */
function useChangeCount(value: string) {
  const [state, setState] = useState<{ v: string; n?: number }>({ v: value });
  if (state.v !== value) setState({ v: value, n: (state.n ?? 0) + 1 });
  return state.n;
}

function shortAddress(address: string) {
  return address.split(",")[0]?.trim() || address;
}

export function DriveHome() {
  const { profile, activeRide, offer, completed, geo, rideLoaded, approved, busy, demoMode } = useDriverRuntime();
  const { user } = useSession();
  const greeting = useGreeting(user?.name);
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
  const online = profile?.availability != null && profile.availability !== "offline";

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
        ? { top: 120, bottom: 70, left: 70, right: 490 }
        : offer && !activeRide && !completed
          ? { top: 100, bottom: 540, left: 40, right: 40 }
          : { top: 120, bottom: sheetBucket + 50, left: 40, right: 40 },
    [isDesktop, offer, activeRide, completed, sheetBucket],
  );

  const panel = completed ? "completed" : activeRide && phase ? "ride" : "home";
  const showHomeSkeleton = approved && !rideLoaded && panel === "home";

  // The living mark: idle offline, moving while online / driving, loading while
  // an offer waits or an action is in flight, success right after a ride.
  const hydrated = useHydrated();
  const markMode: LogoMode = !hydrated ? "idle" : completed ? "success" : offer || busy ? "loading" : activeRide || online ? "moving" : "idle";
  const hopKey = useChangeCount(`${online}:${phase ?? ""}:${offer?.id ?? ""}`);

  const status = completed
    ? { key: "done", title: "נסיעה הושלמה", line: `הרווחתם ${formatILS(payoutOf(completed))} בנסיעה הזו`, live: false }
    : activeRide && phase
      ? { key: `ride:${phase}`, title: PHASE_SHORT_HE[phase], line: `${firstName(activeRide.rider?.name) || "נוסע"} · ${shortAddress((phase === "on_trip" ? activeRide.dropoff : activeRide.pickup).address)}`, live: true }
      : offer
        ? { key: "offer", title: greeting, line: "הצעה חדשה ממתינה לתשובה", live: true }
        : online
          ? { key: "online", title: greeting, line: "זמינים · מחפשים לך נסיעה", live: true }
          : { key: "offline", title: greeting, line: earnings ? `לא זמינים · היום ${formatILS(earnings.netAgorot)}` : "לא זמינים כרגע", live: false };

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
        recenterClassName="end-3 top-[calc(var(--safe-top)+5.5rem)] lg:end-4 lg:top-24"
      />

      {/* floating glass top bar (beside the side sheet on desktop) */}
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 safe-top lg:absolute lg:start-[452px] lg:end-0 lg:px-4 lg:pt-4"
      >
        <div className="glass glass-strong glass-pill pointer-events-auto flex h-16 items-center gap-2.5 ps-2.5 pe-2">
          <AnimatedMark size={44} mode={markMode} hopOn="both" hopKey={hopKey} title="HOP" className="shrink-0 cursor-pointer" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="relative h-5 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={status.title}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }}
                  transition={{ duration: 0.26 }}
                  className="truncate text-[15px] font-extrabold"
                  data-testid="greeting"
                >
                  {status.title}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="relative h-4 overflow-hidden" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={status.key + status.line}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.26 }}
                  className={cn("flex items-center gap-1.5 text-xs font-semibold", TEXT.muted)}
                  role="status"
                >
                  {status.live && (
                    <span aria-hidden className="relative inline-flex h-1.5 w-1.5 shrink-0">
                      <span className="absolute inset-0 animate-ping rounded-full bg-brand/60 [animation-duration:2s]" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                    </span>
                  )}
                  <span className="truncate">{status.line}</span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          {demoMode && <DemoBanner compact text="הדגמה" className="shrink-0" />}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] transition-colors hover:bg-[color-mix(in_oklab,var(--fg)_10%,transparent)]"
            aria-label="פתיחת תפריט"
            data-testid="menu-button"
          >
            <Menu size={21} aria-hidden />
          </button>
        </div>
      </motion.header>

      {/* On phones the offer card replaces the sheet (no glass stacked on glass). */}
      <Sheet open={!(offer && panel === "home" && !isDesktop)} aria-label={panel === "ride" ? "נסיעה פעילה" : panel === "completed" ? "סיכום נסיעה" : "מצב נהג"} className="lg:bottom-auto! lg:max-h-[calc(100dvh-2rem)]!">
        <div ref={sheetRef} className="grid gap-4">
          <div className={cn(panel === "home" && "animate-fade-up")} key={panel}>
            {showHomeSkeleton ? (
              <div className="grid gap-3" aria-busy>
                <Skeleton className="h-28 w-full rounded-[26px]" />
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
            <div className="flex items-center justify-between gap-3 px-1 text-xs text-fg-muted">
              <span className="truncate">{[profile.vehicleMake, profile.vehicleModel, profile.vehicleColor].filter(Boolean).join(" · ")}</span>
              <Plate plate={profile.vehiclePlate} size="sm" />
            </div>
          )}
        </div>
      </Sheet>

      <DriverMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </main>
  );
}
