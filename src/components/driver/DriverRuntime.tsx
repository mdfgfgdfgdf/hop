"use client";
/**
 * DriverRuntime — lives in the /drive layout so it survives navigation between
 * driver pages. It owns everything that must keep running while the driver is
 * online: the geolocation watch + location reporting, the active ride / offer
 * (SSE hints + 4 s polling fallback), and the driver actions (availability,
 * accept/decline, ride steps, cancel). Pages render from this state.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { DriverProfileDTO, RideDTO, SseEvent } from "@/lib/types";
import { useToast } from "@/components/ui";
import { useGeolocation, useLocationReporter, type DriverPosition, type GeoStatus } from "./hooks";
import { errorCode, errorMessage } from "./errors";

export type StepAction = "arriving" | "arrived" | "start" | "complete";
type Busy = "online" | "offline" | "accept" | "decline" | "cancel" | StepAction | null;

export type DriverRuntime = {
  demoMode: boolean;
  profile: DriverProfileDTO | null;
  approved: boolean;
  refreshProfile: () => Promise<void>;
  geo: { status: GeoStatus; position: DriverPosition | null; retry: () => void };
  reportingFailing: boolean;
  realtimeConnected: boolean;
  /** Active ride (accepted → in_progress), never the offer. */
  activeRide: RideDTO | null;
  /** Pending offer addressed to this driver (status "offered"). */
  offer: RideDTO | null;
  rideLoaded: boolean;
  refreshRide: () => Promise<void>;
  completed: RideDTO | null;
  setCompleted: (r: RideDTO | null) => void;
  dismissCompleted: () => void;
  busy: Busy;
  availabilityError: string | null;
  clearAvailabilityError: () => void;
  setOnline: (online: boolean) => Promise<boolean>;
  acceptOffer: () => Promise<void>;
  declineOffer: () => Promise<void>;
  expireOffer: (rideId: string) => void;
  advance: (action: StepAction) => Promise<boolean>;
  cancelRide: (reason: string) => Promise<boolean>;
  /** Bumped when a document / ticket changed server-side (refetch hints). */
  docsVersion: number;
  ticketsVersion: number;
};

const Ctx = createContext<DriverRuntime | null>(null);
const COMPLETED_KEY = "hop.driver.completedRide";

const DENIED_MSG = "אין גישה למיקום. אפשרו גישה למיקום בהגדרות הדפדפן/המכשיר עבור HOP ונסו שוב — בלי מיקום לא ניתן לקבל הצעות.";
const NO_FIX_MSG = "לא הצלחנו לאתר את המיקום שלכם. ודאו שה-GPS פעיל ונסו שוב.";

function storeCompleted(id: string | null) {
  try {
    if (id) sessionStorage.setItem(COMPLETED_KEY, id);
    else sessionStorage.removeItem(COMPLETED_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function DriverRuntimeProvider({ initialProfile, demoMode = false, children }: { initialProfile: DriverProfileDTO | null; demoMode?: boolean; children: React.ReactNode }) {
  const toast = useToast();
  const pathname = usePathname();
  const [profile, setProfile] = useState<DriverProfileDTO | null>(initialProfile);
  const [ride, setRide] = useState<RideDTO | null>(null);
  const [rideLoaded, setRideLoaded] = useState(false);
  const [completed, setCompletedState] = useState<RideDTO | null>(null);
  const [hiddenOffers, setHiddenOffers] = useState<string[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [docsVersion, setDocsVersion] = useState(0);
  const [ticketsVersion, setTicketsVersion] = useState(0);

  const lastRide = useRef<RideDTO | null>(null);
  const seq = useRef(0);
  const announcedOffers = useRef(new Set<string>());
  const vibratedOffers = useRef(new Set<string>());
  const handledEnds = useRef(new Set<string>());

  const approved = profile?.verificationStatus === "approved";
  const availability = profile?.availability ?? "offline";
  const activeRide = ride && ride.status !== "offered" ? ride : null;
  const offer = ride && ride.status === "offered" && ride.offer && !hiddenOffers.includes(ride.id) ? ride : null;
  const hasRide = ride != null;

  const geoEnabled = approved && (pathname === "/drive" || availability !== "offline" || hasRide);
  const geo = useGeolocation(geoEnabled);
  const reporter = useLocationReporter(geo.position, approved && availability !== "offline");

  const refreshProfile = useCallback(async () => {
    try {
      const { profile: p } = await api.driver.profile();
      setProfile(p);
    } catch {
      /* keep previous */
    }
  }, []);

  const setCompleted = useCallback((r: RideDTO | null) => {
    setCompletedState(r);
    storeCompleted(r?.id ?? null);
  }, []);

  const hideOffer = useCallback((id: string) => setHiddenOffers((xs) => (xs.includes(id) ? xs : [...xs.slice(-20), id])), []);

  const announceOfferGone = useCallback(
    (id: string, title: string, description?: string) => {
      if (announcedOffers.current.has(id)) return;
      announcedOffers.current.add(id);
      hideOffer(id);
      toast.info(title, description);
    },
    [hideOffer, toast],
  );

  /** A ride we were part of disappeared from /rides/active: find out why. */
  const onRideGone = useCallback(
    async (prev: RideDTO) => {
      if (prev.status === "offered") {
        announceOfferGone(prev.id, "ההצעה כבר אינה זמינה", "הנוסע ביטל או שההצעה הועברה לנהג אחר");
        return;
      }
      if (handledEnds.current.has(prev.id)) return;
      handledEnds.current.add(prev.id);
      try {
        const { ride: final } = await api.rides.get(prev.id);
        if (final.status === "completed") setCompleted(final);
        else if (final.status === "cancelled") {
          toast.error(
            "הנסיעה בוטלה",
            final.cancelledBy === "rider" ? "הנוסע ביטל את הנסיעה. אתם שוב זמינים להצעות." : "הנסיעה בוטלה על ידי מוקד HOP. אתם שוב זמינים להצעות.",
          );
        }
      } catch {
        /* no longer visible to us */
      }
      void refreshProfile();
    },
    [announceOfferGone, refreshProfile, setCompleted, toast],
  );

  const applyRide = useCallback(
    (next: RideDTO | null) => {
      const prev = lastRide.current;
      lastRide.current = next;
      setRide(next);
      setRideLoaded(true);
      if (prev && (!next || next.id !== prev.id)) void onRideGone(prev);
      if (next?.status === "offered" && next.offer && !vibratedOffers.current.has(next.id)) {
        vibratedOffers.current.add(next.id);
        try {
          navigator.vibrate?.([250, 120, 250]);
        } catch {
          /* not supported */
        }
      }
      if (prev && next && prev.id === next.id && prev.status !== next.status) void refreshProfile();
    },
    [onRideGone, refreshProfile],
  );

  const refreshRide = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const { ride: next } = await api.rides.active();
      if (mine !== seq.current) return; // a newer response / action already applied
      applyRide(next);
    } catch {
      /* transient; next poll retries */
    }
  }, [applyRide]);

  /** Apply the result of a driver action, dropping any in-flight poll. */
  const applyAction = useCallback(
    (next: RideDTO | null) => {
      seq.current++;
      applyRide(next);
    },
    [applyRide],
  );

  // Restore an unacknowledged completion screen after a reload.
  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(COMPLETED_KEY);
    } catch {
      id = null;
    }
    if (!id) return;
    let active = true;
    api.rides
      .get(id)
      .then(({ ride: r }) => {
        if (!active) return;
        if (r.status === "completed") {
          handledEnds.current.add(r.id);
          setCompletedState(r);
        } else storeCompleted(null);
      })
      .catch(() => storeCompleted(null));
    return () => {
      active = false;
    };
  }, []);

  // Poll the active ride / offer (fallback for SSE).
  useEffect(() => {
    if (!approved) return;
    const first = setTimeout(() => void refreshRide(), 0);
    if (availability === "offline" && !hasRide) return () => clearTimeout(first);
    const id = setInterval(() => void refreshRide(), 4000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [approved, availability, hasRide, refreshRide]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshRide();
        void refreshProfile();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshRide, refreshProfile]);

  const onEvent = (e: SseEvent) => {
    const data = (e.data ?? {}) as Record<string, unknown>;
    switch (e.type) {
      case "ride.offer":
      case "ride.updated":
        void refreshRide();
        break;
      case "ride.offer.cancelled": {
        const rideId = typeof data.rideId === "string" ? data.rideId : null;
        if (rideId) {
          if (data.reason === "expired") announceOfferGone(rideId, "ההצעה פגה", "לא התקבלה תשובה בזמן — ההצעה הועברה לנהג אחר");
          else announceOfferGone(rideId, "ההזמנה בוטלה", "הנוסע ביטל לפני שהספקתם לאשר");
        }
        void refreshRide();
        break;
      }
      case "driver.availability":
        void refreshProfile();
        break;
      case "notification": {
        const kind = data.kind;
        if (kind === "driver.verification") {
          void refreshProfile();
          setDocsVersion((v) => v + 1);
          if (data.status === "approved") toast.success("החשבון אושר!", "אפשר לעבור למצב זמין ולהתחיל לקבל נסיעות");
          else if (data.status === "rejected") toast.error("הבקשה לא אושרה", typeof data.reason === "string" ? data.reason : "פרטים במסך ההצטרפות");
          else if (data.status === "suspended") toast.error("החשבון הושעה", "לפרטים פנו לתמיכה");
        } else if (kind === "driver.document") {
          setDocsVersion((v) => v + 1);
          if (data.status === "approved") toast.success("מסמך אושר");
          else if (data.status === "rejected") toast.error("מסמך נדחה", "יש להעלות קובץ חדש במסך המסמכים");
        } else if (kind === "ticket.reply" || kind === "ticket.updated") {
          setTicketsVersion((v) => v + 1);
          if (kind === "ticket.reply") toast.info("התקבלה תשובה מצוות התמיכה");
        }
        break;
      }
    }
  };

  const { connected } = useRealtime({
    onEvent,
    onReconnect: () => {
      void refreshRide();
      void refreshProfile();
    },
  });

  const setOnline = useCallback(
    async (online: boolean) => {
      setAvailabilityError(null);
      setBusy(online ? "online" : "offline");
      try {
        if (online) {
          let pos = geo.position;
          if (!pos || Date.now() - pos.at > 60_000) {
            try {
              pos = await geo.getOnce();
            } catch (err) {
              const denied = (err as GeolocationPositionError | undefined)?.code === 1;
              setAvailabilityError(denied ? DENIED_MSG : NO_FIX_MSG);
              return false;
            }
          }
          const { profile: p } = await api.driver.setAvailability(true, { lat: pos.lat, lng: pos.lng });
          setProfile(p);
          api.driver.location({ lat: pos.lat, lng: pos.lng, heading: pos.heading, speedMps: pos.speedMps }).catch(() => {});
          toast.success("אתם זמינים לנסיעות", "נציג לכם הצעה ברגע שתגיע");
        } else {
          const { profile: p } = await api.driver.setAvailability(false);
          setProfile(p);
          toast.info("עברתם למצב לא זמין", "לא תקבלו הצעות עד שתחזרו לזמינות");
        }
        return true;
      } catch (err) {
        const code = errorCode(err);
        setAvailabilityError(
          code === "driver_busy"
            ? "לא ניתן לעבור למצב לא זמין באמצע נסיעה — סיימו את הנסיעה קודם."
            : code === "forbidden" || code === "not_approved"
              ? "החשבון אינו מאושר כרגע לקבלת נסיעות."
              : errorMessage(err),
        );
        if (code === "forbidden" || code === "not_approved" || code === "driver_busy") void refreshProfile();
        return false;
      } finally {
        setBusy(null);
      }
    },
    [geo, refreshProfile, toast],
  );

  const acceptOffer = useCallback(async () => {
    const r = offer;
    if (!r) return;
    setBusy("accept");
    try {
      const { ride: accepted } = await api.driver.acceptOffer(r.id);
      announcedOffers.current.add(r.id);
      applyAction(accepted);
      toast.success("קיבלתם את הנסיעה", "סעו לנקודת האיסוף");
    } catch (err) {
      if (errorCode(err) === "offer_unavailable") announceOfferGone(r.id, "ההצעה כבר אינה זמינה", "ייתכן שפגה או שהנוסע ביטל");
      else toast.error("לא הצלחנו לקבל את הנסיעה", errorMessage(err));
      void refreshRide();
    } finally {
      setBusy(null);
    }
  }, [offer, applyAction, announceOfferGone, refreshRide, toast]);

  const declineOffer = useCallback(async () => {
    const r = offer;
    if (!r) return;
    setBusy("decline");
    announcedOffers.current.add(r.id);
    handledEnds.current.add(r.id);
    hideOffer(r.id);
    toast.info("ההצעה נדחתה", "נמשיך לחפש לך נסיעות");
    try {
      await api.driver.declineOffer(r.id);
    } catch (err) {
      if (errorCode(err) !== "offer_unavailable") toast.error("הדחייה לא נשלחה", errorMessage(err));
    } finally {
      applyAction(null);
      setBusy(null);
      void refreshRide();
    }
  }, [offer, applyAction, hideOffer, refreshRide, toast]);

  const expireOffer = useCallback(
    (rideId: string) => {
      announceOfferGone(rideId, "ההצעה פגה", "לא התקבלה תשובה בזמן — ההצעה הועברה לנהג אחר");
      setTimeout(() => void refreshRide(), 1500);
    },
    [announceOfferGone, refreshRide],
  );

  const advance = useCallback(
    async (action: StepAction) => {
      const r = activeRide;
      if (!r) return false;
      setBusy(action);
      try {
        const call = { arriving: api.driver.arriving, arrived: api.driver.arrived, start: api.driver.start, complete: api.driver.complete }[action];
        const { ride: updated } = await call(r.id);
        if (updated.status === "completed") {
          handledEnds.current.add(updated.id);
          applyAction(null);
          setCompleted(updated);
          void refreshProfile();
        } else applyAction(updated);
        return true;
      } catch (err) {
        const code = errorCode(err);
        if (code === "invalid_transition" || code === "stale") toast.info("מצב הנסיעה עודכן", errorMessage(err));
        else toast.error("הפעולה לא בוצעה", errorMessage(err));
        void refreshRide();
        return false;
      } finally {
        setBusy(null);
      }
    },
    [activeRide, applyAction, refreshProfile, refreshRide, setCompleted, toast],
  );

  const cancelRide = useCallback(
    async (reason: string) => {
      const r = activeRide;
      if (!r) return false;
      setBusy("cancel");
      handledEnds.current.add(r.id);
      try {
        try {
          await api.rides.cancel(r.id, reason);
        } catch (err) {
          // After a driver cancel the ride is re-dispatched and the server may
          // refuse to return it to us (403) even though the cancel succeeded.
          if (!(err instanceof ApiClientError && err.status === 403)) throw err;
          const { ride: still } = await api.rides.active();
          if (still?.id === r.id) throw err;
        }
        applyAction(null);
        toast.info("הנסיעה בוטלה", "הנסיעה חזרה לתור ותוצע לנהג אחר");
        void refreshProfile();
        return true;
      } catch (err) {
        handledEnds.current.delete(r.id);
        toast.error("הביטול לא בוצע", errorMessage(err));
        void refreshRide();
        return false;
      } finally {
        setBusy(null);
      }
    },
    [activeRide, applyAction, refreshProfile, refreshRide, toast],
  );

  const dismissCompleted = useCallback(() => {
    setCompleted(null);
    void refreshProfile();
  }, [setCompleted, refreshProfile]);

  const value = useMemo<DriverRuntime>(
    () => ({
      demoMode,
      profile,
      approved,
      refreshProfile,
      geo: { status: geo.status, position: geo.position, retry: geo.retry },
      reportingFailing: reporter.failing,
      realtimeConnected: connected,
      activeRide,
      offer,
      rideLoaded,
      refreshRide,
      completed,
      setCompleted,
      dismissCompleted,
      busy,
      availabilityError,
      clearAvailabilityError: () => setAvailabilityError(null),
      setOnline,
      acceptOffer,
      declineOffer,
      expireOffer,
      advance,
      cancelRide,
      docsVersion,
      ticketsVersion,
    }),
    [demoMode, profile, approved, refreshProfile, geo.status, geo.position, geo.retry, reporter.failing, connected, activeRide, offer, rideLoaded, refreshRide, completed, setCompleted, dismissCompleted, busy, availabilityError, setOnline, acceptOffer, declineOffer, expireOffer, advance, cancelRide, docsVersion, ticketsVersion],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDriverRuntime() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDriverRuntime must be used within DriverRuntimeProvider");
  return ctx;
}
