"use client";
/**
 * /ride — the live map experience. One persistent MapView; the sheet content
 * follows the rider's journey: home → destination search / pin → quote →
 * searching → driver on the way → in ride → receipt (or cancellation).
 * An active ride from the server always wins over the local planning stage.
 */
import { useCallback, useMemo, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, LocateFixed } from "lucide-react";
import { RiderMap, type MapMarker } from "../RiderMap";
import { DemoBanner, Sheet, Skeleton, useToast } from "@/components/ui";
import { formatILS } from "@/lib/format";
import type { LatLng, PlaceDTO, Polyline, RideDTO } from "@/lib/types";
import { isLive, useActiveRide } from "../ActiveRideProvider";
import { MapAnchor } from "../MapAnchor";
import { NeedleOrbit, useGlidingPosition } from "../motion";
import { CenterPin } from "../CenterPin";
import { TopBar } from "../TopBar";
import { useRiderInfo } from "../RiderContext";
import { remainingRoute } from "../lib/geo";
import { useElementHeight, useGeolocation, useIsDesktop, useViewportHeight } from "../lib/hooks";
import { addRecent, useRecents, type RecentPlace } from "../lib/storage";
import { ActiveSheet, driverFirstName } from "./ActiveSheet";
import { CancelledSheet } from "./CancelledSheet";
import { CompletedSheet } from "./CompletedSheet";
import { DestinationSearch } from "./DestinationSearch";
import { HomeSheet } from "./HomeSheet";
import { PinSheet } from "./PinSheet";
import { QuoteSheet } from "./QuoteSheet";
import { SearchingSheet } from "./SearchingSheet";
import { SheetBody } from "./SheetLayout";
import { fromPlace, type SelectedPlace, type Stage } from "./types";
import { quoteKey, useQuote } from "./useQuote";
import { useReverseGeocode } from "./useReverseGeocode";

type View = "loading" | "searching" | "active" | "completed" | "cancelled" | Stage["kind"];
const SEARCHING: RideDTO["status"][] = ["requested", "searching", "offered"];
const SHEET_LABEL: Record<View, string> = {
  loading: "טוען",
  home: "לאן נוסעים",
  search: "חיפוש יעד",
  pin: "בחירה על המפה",
  quote: "בחירת נסיעה",
  searching: "מחפשים נהג",
  active: "הנסיעה שלכם",
  completed: "סיכום נסיעה",
  cancelled: "הנסיעה בוטלה",
};

const pt = (p: { lat: number; lng: number }): LatLng => ({ lat: p.lat, lng: p.lng });
/** A ~150 m box around a point: lets MapView fitBounds (honouring the sheet padding) frame a single point. */
const around = (p: { lat: number; lng: number }): LatLng[] => [
  { lat: p.lat - 0.0011, lng: p.lng - 0.0013 },
  { lat: p.lat + 0.0011, lng: p.lng + 0.0013 },
];

export function RideApp() {
  const toast = useToast();
  const { ride, loaded, endedRide, driverPos, adoptRide, markEnded, clearEnded, refresh } = useActiveRide();
  const { demoMode } = useRiderInfo();
  const geo = useGeolocation();
  const isDesktop = useIsDesktop();
  const recents = useRecents();
  const [map, setMap] = useState<MLMap | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "home" });
  const [manualPickup, setManualPickup] = useState<SelectedPlace | null>(null);
  const [dropoff, setDropoff] = useState<SelectedPlace | null>(null);
  const [pinCenter, setPinCenter] = useState<LatLng | null>(null);
  const [moving, setMoving] = useState(false);
  const [sheetEl, setSheetEl] = useState<HTMLElement | null>(null);
  const sheetH = useElementHeight(sheetEl);
  const sheetRef = useCallback((node: HTMLDivElement | null) => setSheetEl(node?.closest("section") ?? null), []);

  // ── pickup: current location (reverse-geocoded) unless chosen on the map ──
  const gpsReady = geo.status !== "pending";
  const gpsReverse = useReverseGeocode(gpsReady && !manualPickup ? geo.pos : null);
  const gpsPickup = useMemo<SelectedPlace | null>(() => {
    if (!gpsReady) return null;
    const place = gpsReverse.place;
    const near = !place || place.name.startsWith("נקודה ליד");
    // An approximate fix shows the resolved address rather than "current location".
    const name = geo.status === "approx" ? undefined : near ? "המיקום הנוכחי" : place.name;
    return { lat: geo.pos.lat, lng: geo.pos.lng, address: place?.address ?? "המיקום הנוכחי", name, provider: place?.provider };
  }, [gpsReady, geo.pos, geo.status, gpsReverse.place]);
  const pickup = manualPickup ?? gpsPickup;
  const pickupLoading = !manualPickup && (!gpsReady || gpsReverse.loading);

  // ── view resolution ──
  const live = isLive(ride);
  const shownRide = live ? ride : endedRide;
  const view: View = !loaded
    ? "loading"
    : live && ride
      ? SEARCHING.includes(ride.status)
        ? "searching"
        : "active"
      : endedRide
        ? endedRide.status === "completed"
          ? "completed"
          : "cancelled"
        : stage.kind;

  const quoteInput = useMemo(() => (view === "quote" && pickup && dropoff && !pickupLoading ? { pickup, dropoff } : null), [view, pickup, dropoff, pickupLoading]);
  const quote = useQuote(quoteInput);
  const pinTarget = stage.kind === "pin" ? stage.target : null;
  const pinReverse = useReverseGeocode(view === "pin" ? pinCenter : null);

  // ── map content ──
  const carPos = useGlidingPosition(view === "active" ? driverPos : null);
  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (view === "loading") return list;
    if (view === "home" || view === "search" || view === "pin" || view === "quote") {
      if (gpsReady && view !== "quote") list.push({ id: "me", kind: "me", ...pt(geo.pos) });
      if (pickup && (view === "quote" || (manualPickup && pinTarget !== "pickup"))) list.push({ id: "pickup", kind: "pickup", ...pt(pickup) });
      if (dropoff && (view === "quote" || (view === "pin" && pinTarget === "pickup"))) list.push({ id: "dropoff", kind: "dropoff", ...pt(dropoff) });
      return list;
    }
    if (!shownRide) return list;
    if (view !== "active" || shownRide.status !== "in_progress") list.push({ id: "pickup", kind: "pickup", ...pt(shownRide.pickup) });
    list.push({ id: "dropoff", kind: "dropoff", ...pt(shownRide.dropoff) });
    if (view === "active" && carPos) list.push({ id: "driver", kind: "driver", lat: carPos.lat, lng: carPos.lng, heading: carPos.heading });
    return list;
  }, [view, gpsReady, geo.pos, pickup, manualPickup, dropoff, pinTarget, shownRide, carPos]);

  const polyline = useMemo<Polyline | null>(() => {
    if (view === "quote") return quote.data?.route.polyline ?? null;
    if (!shownRide || (view !== "searching" && view !== "active" && view !== "completed" && view !== "cancelled")) return null;
    if (view === "active") {
      if (shownRide.status === "in_progress") return driverPos ? remainingRoute(shownRide.polyline, driverPos) : shownRide.polyline;
      return driverPos ? [[driverPos.lat, driverPos.lng], [shownRide.pickup.lat, shownRide.pickup.lng]] : null;
    }
    return shownRide.polyline;
  }, [view, quote.data, shownRide, driverPos]);

  // Re-frame the camera only when the journey moves to a new phase (not on every GPS ping).
  const quoteData = view === "quote" ? quote.data : undefined;
  const fitKey = (() => {
    switch (view) {
      case "home":
        return pickup ? `home|${pickup.lat.toFixed(5)},${pickup.lng.toFixed(5)}` : "home";
      case "quote":
        return quoteData && quoteInput ? `quote|${quoteKey(quoteInput)}` : "quote";
      case "searching":
      case "completed":
      case "cancelled":
        return `${view}|${shownRide?.id}`;
      case "active":
        return `active|${shownRide?.id}|${shownRide?.status}|${shownRide?.arrivedAt ? "arrived" : ""}|${driverPos ? "driver" : ""}`;
      default:
        return view;
    }
  })();
  const [fitState, setFitState] = useState<{ key: string; points: LatLng[] | null }>({ key: "", points: null });
  if (fitState.key !== fitKey) {
    // Single points become a small box so MapView uses fitBounds (which honours
    // the sheet padding) instead of a plain centre — keeps them above the sheet.
    let points: LatLng[] | null = null;
    if (view === "home" && pickup) points = around(pickup);
    else if (view === "quote" && quoteData) points = [pt(quoteData.pickup), pt(quoteData.dropoff), ...quoteData.route.polyline.map(([lat, lng]) => ({ lat, lng }))];
    else if ((view === "searching" || view === "completed" || view === "cancelled") && shownRide) points = [pt(shownRide.pickup), pt(shownRide.dropoff)];
    else if (view === "active" && shownRide) {
      const target = shownRide.status === "in_progress" ? shownRide.dropoff : shownRide.pickup;
      points = driverPos ? [pt(driverPos), pt(target), ...around(target)] : around(target);
    }
    setFitState({ key: fitKey, points });
  }

  // Padding keeps the framed points clear of the top bar and the sheet; it is
  // capped so at least ~150px of map stays usable (MapLibre returns NaN when
  // padding exceeds the canvas — e.g. Safari's 664px viewport with toolbars).
  const viewportH = useViewportHeight();
  const padBucket = Math.round(sheetH / 32) * 32;
  const fitPadding = useMemo(() => {
    if (isDesktop) return { top: 130, bottom: 90, left: 90, right: 520 };
    const top = view === "quote" || view === "pin" ? 76 : 104; // no top bar on quote/pin
    const extra = view === "searching" ? 72 : 40; // room for the searching halo
    return { top, bottom: Math.max(40, Math.min(padBucket + extra, viewportH - top - 120)), left: 76, right: 76 };
  }, [isDesktop, padBucket, viewportH, view]);

  // ── handlers ──
  const recenter = () => {
    if (!map) return;
    const pts = fitState.points;
    if (view === "home" || view === "pin" || !pts || pts.length === 0) {
      map.easeTo({ center: [geo.pos.lng, geo.pos.lat], zoom: Math.max(map.getZoom(), 15.5), duration: 500 });
      return;
    }
    if (pts.length === 1) {
      map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 15, duration: 500 });
      return;
    }
    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: fitPadding, maxZoom: 16, duration: 600 },
    );
  };

  const startPin = (target: "pickup" | "dropoff", returnTo: "home" | "quote" | "search") => {
    const base = target === "pickup" ? (pickup ?? geo.pos) : (dropoff ?? pickup ?? geo.pos);
    setPinCenter(pt(base));
    setMoving(false);
    map?.easeTo({ center: [base.lng, base.lat], zoom: Math.max(map.getZoom(), 16), duration: 500 });
    setStage({ kind: "pin", target, returnTo });
  };

  const confirmPin = () => {
    if (stage.kind !== "pin" || !pinCenter) return;
    const place = pinReverse.place;
    const chosen: SelectedPlace = {
      lat: pinCenter.lat,
      lng: pinCenter.lng,
      address: place?.address ?? "נקודה שנבחרה על המפה",
      name: place?.name ?? "נקודה על המפה",
      provider: place?.provider,
      id: place?.id,
    };
    if (stage.target === "pickup") {
      setManualPickup(chosen);
      setStage(stage.returnTo === "quote" && dropoff ? { kind: "quote" } : stage.returnTo === "search" ? { kind: "search" } : { kind: "home" });
    } else {
      setDropoff(chosen);
      addRecent({ id: chosen.id ?? `pin-${chosen.lat}-${chosen.lng}`, name: chosen.name ?? chosen.address, address: chosen.address, lat: chosen.lat, lng: chosen.lng, provider: chosen.provider ?? "demo" });
      setStage({ kind: "quote" });
    }
  };

  const pickDestination = (p: PlaceDTO | RecentPlace) => {
    addRecent(p);
    setDropoff(fromPlace(p));
    setStage({ kind: "quote" });
  };

  const back = () => {
    if (stage.kind === "pin") setStage({ kind: stage.returnTo === "quote" && !dropoff ? "home" : stage.returnTo });
    else setStage({ kind: "home" });
  };

  const onOrdered = (r: RideDTO) => {
    adoptRide(r);
    setStage({ kind: "home" });
    setDropoff(null);
    setManualPickup(null);
  };

  const onCancelled = (r: RideDTO) => {
    const fee = r.cancellationFeeAgorot;
    markEnded(r, fee > 0);
    setStage({ kind: "home" });
    if (fee > 0) toast.info("הנסיעה בוטלה", `חויבו דמי ביטול בסך ${formatILS(fee)}.`);
    else toast.success("הנסיעה בוטלה", "לא חויבתם.");
  };

  const retry = (r: RideDTO) => {
    setManualPickup({ lat: r.pickup.lat, lng: r.pickup.lng, address: r.pickup.address, name: r.pickup.address });
    setDropoff({ lat: r.dropoff.lat, lng: r.dropoff.lng, address: r.dropoff.address, name: r.dropoff.address });
    clearEnded();
    setStage({ kind: "quote" });
  };

  const done = () => {
    clearEnded();
    setStage({ kind: "home" });
  };

  const topNote = (() => {
    if (view === "searching") return "מחפשים לך נהג…";
    if (view === "active" && shownRide) {
      const first = driverFirstName(shownRide);
      if (shownRide.status === "in_progress") return "בנסיעה · המחיר נעול";
      if (shownRide.arrivedAt) return `${first} מחכה לך`;
      return `${first} בדרך אליך`;
    }
    if (view === "completed") return "תודה שנסעתם עם HOP";
    if (view === "cancelled") return "אפשר לנסות שוב בכל רגע";
    return undefined;
  })();

  const showTopBar = view === "home" || view === "loading" || view === "searching" || view === "active" || view === "completed" || view === "cancelled";
  const showBack = view === "quote" || view === "pin";
  const showLocate = view === "home" || view === "pin" || view === "quote" || view === "active" || view === "searching";
  const center = (view === "home" || view === "loading" || view === "search") && gpsReady ? geo.pos : undefined;

  return (
    <div className="relative h-dvh w-full overflow-hidden" style={{ ["--sheet-h" as string]: `${sheetH}px` } as React.CSSProperties}>
      <div className="absolute inset-0">
        <RiderMap
          center={center}
          zoom={15}
          markers={markers}
          polyline={polyline}
          fit={fitState.points}
          fitPadding={fitPadding}
          onReady={setMap}
          onMoveStart={() => {
            if (view === "pin") setMoving(true);
          }}
          onMoveEnd={(c) => {
            setMoving(false);
            if (view === "pin") setPinCenter(c);
          }}
          theme="light"
        >
          {view === "pin" && <CenterPin lifted={moving} kind={pinTarget ?? "pickup"} />}
          {view === "searching" && shownRide && (
            <MapAnchor map={map} lat={shownRide.pickup.lat} lng={shownRide.pickup.lng}>
              <NeedleOrbit />
            </MapAnchor>
          )}
        </RiderMap>
      </div>

      {showTopBar && <TopBar note={topNote} />}
      {showBack && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-3 pt-3 safe-top lg:absolute lg:start-[452px] lg:px-4 lg:pt-4">
          <button type="button" onClick={back} className="btn btn-glass btn-icon pointer-events-auto h-12 w-12 shadow-lg" aria-label="חזרה" data-testid="map-back">
            <ArrowRight size={22} aria-hidden />
          </button>
          {demoMode && <DemoBanner compact text="הדגמה" className="pointer-events-auto" />}
        </div>
      )}

      {showLocate && (
        <button
          type="button"
          onClick={recenter}
          aria-label={view === "home" || view === "pin" ? "חזרה למיקום שלי" : "מרכוז המסלול"}
          className="btn btn-glass btn-icon fixed end-3 z-20 h-12 w-12 bottom-[calc(var(--sheet-h)+20px)] lg:absolute lg:end-6 lg:bottom-6"
        >
          <LocateFixed size={20} aria-hidden />
        </button>
      )}

      <AnimatePresence>
        {view === "search" && (
          <DestinationSearch
            key="search"
            pickup={pickup}
            recents={recents}
            onClose={() => setStage({ kind: "home" })}
            onPick={pickDestination}
            onPickOnMap={() => startPin("dropoff", "search")}
            onEditPickup={() => startPin("pickup", "search")}
          />
        )}
      </AnimatePresence>

      <Sheet open={view !== "search"} aria-label={SHEET_LABEL[view]} className={view === "quote" ? "max-h-[62dvh]! lg:max-h-none!" : view === "completed" || view === "cancelled" ? undefined : "max-h-[74dvh]! lg:max-h-none!"}>
        <div ref={sheetRef} />
        <SheetBody>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view === "active" ? `active-${shownRide?.id}` : view}
              initial={{ opacity: 0, y: 14, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="flex flex-1 flex-col"
            >
              {view === "loading" && <LoadingContent />}
              {view === "home" && (
                <HomeSheet
                  pickup={pickup}
                  pickupLoading={pickupLoading}
                  approx={!manualPickup && geo.status === "approx"}
                  recents={recents}
                  onSearch={() => setStage({ kind: "search" })}
                  onEditPickup={() => startPin("pickup", "home")}
                  onPickRecent={pickDestination}
                />
              )}
              {view === "pin" && pinTarget && (
                <PinSheet target={pinTarget} place={pinReverse.place} loading={pinReverse.loading} moving={moving} error={pinReverse.error} onConfirm={confirmPin} />
              )}
              {view === "quote" && pickup && dropoff && (
                <QuoteSheet
                  pickup={pickup}
                  dropoff={dropoff}
                  quote={quote}
                  onEditPickup={() => startPin("pickup", "quote")}
                  onEditDropoff={() => setStage({ kind: "search" })}
                  onOrdered={onOrdered}
                  onRideActive={refresh}
                />
              )}
              {view === "quote" && (!pickup || !dropoff) && <LoadingContent />}
              {view === "searching" && shownRide && <SearchingSheet ride={shownRide} onCancelled={onCancelled} />}
              {view === "active" && shownRide && <ActiveSheet ride={shownRide} driverPos={driverPos} onCancelled={onCancelled} />}
              {view === "completed" && shownRide && <CompletedSheet ride={shownRide} onDone={done} />}
              {view === "cancelled" && shownRide && <CancelledSheet ride={shownRide} onRetry={() => retry(shownRide)} onDone={done} />}
            </motion.div>
          </AnimatePresence>
        </SheetBody>
      </Sheet>
    </div>
  );
}

function LoadingContent() {
  return (
    <div aria-busy="true" aria-label="טוען…">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-4 h-[60px] w-full rounded-[20px]" />
      <Skeleton className="mt-3 h-14 w-full rounded-2xl" />
      <div className="mt-5 space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
