"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import { AlertTriangle, ArrowLeft, Ban, Car, CircleDollarSign, MessageSquarePlus, Phone, Star, UserRound } from "lucide-react";
import { api, type AdminRideDetail } from "@/lib/api";
import { formatDateTime, formatDistance, formatDuration, formatEta, formatILS, formatRelative, formatTime } from "@/lib/format";
import { CANCELLED_BY_HE, CANCEL_REASONS_HE, LEDGER_TYPE_HE, PAYMENT_METHOD_HE, PAYMENT_STATUS_HE, VEHICLE_CLASS_HE } from "@/lib/labels";
import { ilsToAgorot } from "@/lib/money";
import type { RideDTO } from "@/lib/types";
import { Button, EmptyState, Field, Input, Pill, useToast, cn } from "@/components/ui";
import { AdminMap as MapView, type MapMarker } from "../AdminMap";
import { readAdminRide, readDriverLocation, useAdminFeed } from "../realtime";
import { errorMessage, shortId, useDebouncedCallback, useLoad } from "../hooks";
import { DetailSkeleton, ErrorState, KV, Ltr, Muted, Page, PageHeader, Panel } from "../ui";
import { DemoPill, FlagSeverityPill, RideStatusPill, isActiveRide } from "../pills";
import { Modal as ModalHost, useConfirm } from "../Dialog";
import { RouteCell } from "../rides";

const FIT_PADDING = { top: 60, bottom: 60, left: 60, right: 60 };
const TRACK_COLOR = "#111318";

const EVENT_HE: Record<string, string> = {
  requested: "ההזמנה נקלטה",
  searching: "החל חיפוש נהג",
  offered: "הוצעה לנהג",
  offer_declined: "הנהג דחה את ההצעה",
  offer_expired: "ההצעה פגה ללא מענה",
  accepted: "הנהג אישר את הנסיעה",
  driver_arriving: "הנהג בדרך לאיסוף",
  driver_arrived: "הנהג הגיע לנקודת האיסוף",
  started: "הנסיעה התחילה",
  completed: "הנסיעה הושלמה",
  cancelled: "הנסיעה בוטלה",
  driver_cancelled: "הנהג ביטל לאחר אישור",
  rated: "התקבל דירוג",
};

const ACTOR_HE: Record<string, string> = { rider: "נוסע", driver: "נהג", admin: "מנהל", support: "תמיכה", system: "מערכת" };
const OFFER_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "muted" }> = {
  pending: { label: "ממתינה", tone: "warning" },
  accepted: { label: "התקבלה", tone: "success" },
  declined: { label: "נדחתה", tone: "danger" },
  expired: { label: "פגה", tone: "muted" },
  cancelled: { label: "בוטלה", tone: "muted" },
};

function eventDetail(e: AdminRideDetail["events"][number], driverNames: Map<string, string>): string | null {
  const d = e.data;
  const num = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : null);
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  switch (e.type) {
    case "offered": {
      const name = str("driverId") ? driverNames.get(str("driverId")!) : null;
      const parts = [name, num("attempt") != null ? `ניסיון ${num("attempt")}` : null, num("distanceM") != null ? formatDistance(num("distanceM")) : null, num("etaS") != null ? `${formatEta(num("etaS"))} לאיסוף` : null];
      return parts.filter(Boolean).join(" · ") || null;
    }
    case "offer_expired":
      return str("driverId") ? driverNames.get(str("driverId")!) ?? null : null;
    case "requested":
      return str("paymentMethod") ? `תשלום: ${PAYMENT_METHOD_HE[str("paymentMethod") as keyof typeof PAYMENT_METHOD_HE] ?? str("paymentMethod")}` : null;
    case "cancelled": {
      const by = str("by");
      const reason = str("reason");
      const fee = num("feeAgorot");
      return [by ? `על ידי ${CANCELLED_BY_HE[by as keyof typeof CANCELLED_BY_HE] ?? by}` : null, reason ? CANCEL_REASONS_HE[reason] ?? reason : null, fee ? `דמי ביטול ${formatILS(fee)}` : null].filter(Boolean).join(" · ") || null;
    }
    case "driver_cancelled":
      return str("reason");
    case "completed": {
      const flags = Array.isArray(d.flags) ? (d.flags as unknown[]).length : 0;
      return [num("actualDistanceM") != null ? formatDistance(num("actualDistanceM")) : null, num("actualDurationS") != null ? formatDuration(num("actualDurationS")) : null, flags ? `${flags} דגלים` : null].filter(Boolean).join(" · ") || null;
    }
    case "rated":
      return num("stars") != null ? `${num("stars")} כוכבים מ${str("by") === "driver" ? "הנהג" : "הנוסע"}` : null;
    default:
      return null;
  }
}

export function RideDetail({ id }: { id: string }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { data, error, loading, reload } = useLoad(`ride:${id}`, () => api.admin.ride(id));
  const drivers = useLoad("drivers-directory", () => api.admin.drivers({ limit: 500 }));
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const [adjustMode, setAdjustMode] = useState<"refund" | "note" | null>(null);
  const debounced = useDebouncedCallback(reload, 600);

  useAdminFeed((e) => {
    const r = readAdminRide(e);
    if ((r && r.rideId === id) || e.type === "reconnect") debounced();
    const loc = readDriverLocation(e);
    if (loc && data?.ride.driver?.id === loc.driverId && isActiveRide(data.ride.status)) setDriverPos({ lat: loc.lat, lng: loc.lng, heading: loc.heading });
  });

  const driverNames = useMemo(() => new Map((drivers.data?.drivers ?? []).map((d) => [d.user.id, d.user.name])), [drivers.data]);

  if (loading)
    return (
      <Page>
        <DetailSkeleton />
      </Page>
    );
  if (!data)
    return (
      <Page>
        <PageHeader title="פרטי נסיעה" back={{ href: "/admin/rides", label: "לכל הנסיעות" }} />
        <div className="card">
          <ErrorState message={error ?? "הנסיעה לא נמצאה"} onRetry={reload} />
        </div>
      </Page>
    );

  const { ride, events, offers, ledger, track } = data;
  const active = isActiveRide(ride.status);
  const final = ride.status === "completed" || ride.status === "cancelled";
  const charged = (ride.finalTotalAgorot ?? 0) + ride.cancellationFeeAgorot;
  const refundable = Math.max(0, charged - ride.refundedAgorot);

  const cancel = () =>
    confirm({
      title: "לבטל את הנסיעה?",
      description: "הנוסע והנהג יקבלו הודעה מיידית. ביטול על ידי מפעיל אינו גובה דמי ביטול מהנוסע.",
      confirmLabel: "ביטול הנסיעה",
      tone: "danger",
      reason: { label: "סיבת הביטול", required: true, placeholder: "למשל: בקשת הנוסע במוקד / חשש בטיחותי" },
      onConfirm: async (reason) => {
        await api.admin.cancelRide(id, reason);
        toast.success("הנסיעה בוטלה");
        reload();
      },
    });

  const adjust = (mode: "refund" | "note") => setAdjustMode(mode);

  return (
    <Page>
      <PageHeader
        back={{ href: "/admin/rides", label: "לכל הנסיעות" }}
        title={
          <span>
            נסיעה <Ltr className="text-fg-muted">#{shortId(ride.id)}</Ltr>
          </span>
        }
        meta={
          <>
            <RideStatusPill status={ride.status} />
            <Pill tone="ink">{ride.serviceType.nameHe}</Pill>
            <Pill tone="muted">{PAYMENT_METHOD_HE[ride.paymentMethod]}</Pill>
            {ride.isDemo && <DemoPill />}
            <span className="text-sm text-fg-muted">הוזמנה {formatDateTime(ride.requestedAt)}</span>
          </>
        }
        actions={
          <>
            {active && (
              <Button variant="danger" size="sm" onClick={cancel}>
                <Ban size={17} aria-hidden />
                ביטול נסיעה
              </Button>
            )}
            {final && (
              <>
                <Button variant="glass" size="sm" onClick={() => adjust("refund")} disabled={refundable === 0} title={refundable === 0 ? "אין סכום להחזר" : undefined}>
                  <CircleDollarSign size={17} aria-hidden />
                  החזר כספי
                </Button>
                <Button variant="ghost" size="sm" onClick={() => adjust("note")}>
                  <MessageSquarePlus size={17} aria-hidden />
                  הוספת הערה
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Panel
            title="מסלול"
            flush
            actions={
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-fg-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-5 rounded-full bg-brand" aria-hidden />
                  מסלול מתוכנן
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-5 rounded-full [background:repeating-linear-gradient(90deg,var(--ink)_0_4px,transparent_4px_7px)]" aria-hidden />
                  מסלול בפועל ({track.length} נקודות)
                </span>
              </div>
            }
          >
            <RideMap ride={ride} track={track} driverPos={driverPos} />
            <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
              <RouteCell ride={ride} />
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>
                  <span className="text-fg-muted">הערכה: </span>
                  <span className="tabular-nums">
                    {formatDistance(ride.estimatedDistanceM)} · {formatDuration(ride.estimatedDurationS)}
                  </span>
                </span>
                <span>
                  <span className="text-fg-muted">בפועל: </span>
                  <span className="tabular-nums">{ride.actualDistanceM != null ? `${formatDistance(ride.actualDistanceM)} · ${formatDuration(ride.actualDurationS)}` : "—"}</span>
                </span>
              </div>
            </div>
          </Panel>

          {ride.flags.length > 0 && (
            <Panel title="דגלים וחריגות" description="זוהו אוטומטית בסיום הנסיעה">
              <ul className="space-y-3">
                {ride.flags.map((f, i) => (
                  <li key={`${f.code}-${i}`} className={cn("flex items-start gap-3 rounded-2xl border p-3", f.severity === "critical" ? "border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger)_5%,var(--surface))]" : "border-line")}>
                    <FlagSeverityPill severity={f.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{f.message}</div>
                      <div className="mt-0.5 text-xs text-fg-muted">
                        <Ltr>{f.code}</Ltr> · {formatDateTime(f.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="ציר זמן" description={`${events.length} אירועים`}>
            {events.length === 0 ? (
              <Muted>אין אירועים</Muted>
            ) : (
              <ol className="relative space-y-0">
                {events.map((e, i) => {
                  const detail = eventDetail(e, driverNames);
                  const last = i === events.length - 1;
                  const tone = e.type === "cancelled" || e.type === "driver_cancelled" ? "bg-danger" : e.type === "completed" ? "bg-success" : e.type.startsWith("offer_") ? "bg-mist" : "bg-brand";
                  return (
                    <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {!last && <span aria-hidden className="absolute top-4 bottom-0 w-px bg-line [inset-inline-start:7px]" />}
                      <span aria-hidden className={cn("relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-[3px] border-surface shadow-[0_0_0_1px_var(--line)]", tone)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-semibold">{EVENT_HE[e.type] ?? e.type}</span>
                          <span className="text-xs text-fg-muted tabular-nums" title={formatDateTime(e.createdAt)}>
                            {formatTime(e.createdAt)}
                          </span>
                        </div>
                        <div className="text-xs text-fg-muted">
                          {ACTOR_HE[e.actorRole ?? "system"] ?? e.actorRole}
                          {detail && <> · {detail}</>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel title="הצעות לנהגים" description={offers.length ? `${offers.length} הצעות נשלחו` : undefined} flush>
            {offers.length === 0 ? (
              <EmptyState title="לא נשלחו הצעות" description="הנסיעה לא הוצעה לנהגים (לדוגמה: נסיעת הדגמה היסטורית או ביטול מוקדם)." className="py-8" />
            ) : (
              <ul className="divide-y divide-line">
                {offers.map((o) => {
                  const st = OFFER_STATUS[o.status] ?? { label: o.status, tone: "muted" as const };
                  return (
                    <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] text-xs font-bold tabular-nums">{o.attempt}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/drivers/${o.driverId}`} className="font-semibold hover:text-brand">
                          {driverNames.get(o.driverId) ?? `נהג ${shortId(o.driverId)}`}
                        </Link>
                        <div className="text-xs text-fg-muted tabular-nums">
                          {formatDistance(o.driverDistanceM)} · {formatEta(o.driverEtaS)} לאיסוף · תשלום לנהג {formatILS(o.driverPayoutAgorot)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-fg-muted tabular-nums">{o.respondedAt ? `נענתה ${formatTime(o.respondedAt)}` : `נשלחה ${formatTime(o.createdAt)}`}</span>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <PeoplePanel ride={ride} />
          <MoneyPanel ride={ride} ledger={ledger} />
          <Panel title="הערות מפעיל">
            {ride.adminNotes ? (
              <ul className="space-y-2">
                {ride.adminNotes.split("\n").filter(Boolean).map((n, i) => (
                  <li key={i} className="rounded-2xl bg-[color-mix(in_oklab,var(--fg)_4%,transparent)] px-3 py-2 text-sm">
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <Muted>אין הערות.</Muted>
            )}
            {!final && <p className="mt-3 text-xs text-fg-muted">ניתן להוסיף הערות והחזרים לאחר שהנסיעה הסתיימה.</p>}
          </Panel>
        </div>
      </div>
      {dialog}
      <AdjustDialog ride={ride} mode={adjustMode} refundable={refundable} onClose={() => setAdjustMode(null)} onDone={reload} />
    </Page>
  );
}

function RideMap({ ride, track, driverPos }: { ride: RideDTO; track: AdminRideDetail["track"]; driverPos: { lat: number; lng: number; heading: number | null } | null }) {
  const [map, setMap] = useState<MLMap | null>(null);
  const active = isActiveRide(ride.status);
  const live = driverPos ?? (active && ride.driver?.location ? ride.driver.location : null);

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [
      { id: "pickup", kind: "pickup", lat: ride.pickup.lat, lng: ride.pickup.lng, label: "איסוף" },
      { id: "dropoff", kind: "dropoff", lat: ride.dropoff.lat, lng: ride.dropoff.lng, label: "יעד" },
    ];
    // Last few actual track points as small dots (the full track is drawn as a line overlay).
    track.slice(-6).forEach((p, i) => m.push({ id: `track-${i}`, kind: "poi", lat: p.lat, lng: p.lng }));
    if (live) m.push({ id: "driver", kind: "driver", lat: live.lat, lng: live.lng, heading: live.heading, label: ride.driver?.name });
    return m;
  }, [ride, track, live]);

  const fit = useMemo(() => {
    const pts = [ride.pickup, ride.dropoff, ...track.map((t) => ({ lat: t.lat, lng: t.lng }))];
    return pts.map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [ride.pickup, ride.dropoff, track]);

  // Actual GPS track as a dashed ink line on top of the planned route.
  useEffect(() => {
    if (!map) return;
    const data = {
      type: "FeatureCollection" as const,
      features: track.length > 1 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: track.map((p) => [p.lng, p.lat]) } }] : [],
    };
    const apply = () => {
      try {
        const src = map.getSource("admin-track") as GeoJSONSource | undefined;
        if (src) src.setData(data);
        else {
          map.addSource("admin-track", { type: "geojson", data });
          map.addLayer({ id: "admin-track-line", type: "line", source: "admin-track", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": TRACK_COLOR, "line-width": 3, "line-dasharray": [1.2, 1.6] } });
        }
      } catch {
        /* style not ready yet — retried on next styledata */
      }
    };
    if (map.isStyleLoaded()) apply();
    map.on("styledata", apply);
    return () => {
      map.off("styledata", apply);
    };
  }, [map, track]);

  return (
    <div className="relative h-[300px] sm:h-[380px]">
      <MapView center={ride.pickup} zoom={13} markers={markers} polyline={ride.polyline} fit={fit} fitPadding={FIT_PADDING} onReady={setMap} />
      {active && (
        <div className="pointer-events-none absolute top-3 [inset-inline-start:12px]">
          <span className="glass glass-pill glass-strong inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold" role="status">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden />
            מעקב חי
          </span>
        </div>
      )}
    </div>
  );
}

function PersonBlock({ title, person, href, icon }: { title: string; person: RideDTO["rider"]; href: string | null; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-fg-muted">{title}</div>
        {person ? (
          <>
            {href ? (
              <Link href={href} className="inline-flex items-center gap-1 font-bold hover:text-brand">
                {person.name}
                <ArrowLeft size={14} aria-hidden />
              </Link>
            ) : (
              <div className="font-bold">{person.name}</div>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
              {person.phoneMasked && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} aria-hidden />
                  <Ltr>{person.phoneMasked}</Ltr>
                </span>
              )}
              {person.rating != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden />
                  {person.rating.toFixed(1)}
                </span>
              )}
            </div>
            {person.vehicle && (
              <div className="mt-1 text-xs">
                {[person.vehicle.make, person.vehicle.model, person.vehicle.color].filter(Boolean).join(" ")} · {VEHICLE_CLASS_HE[person.vehicle.class]}
                {person.vehicle.plate && (
                  <>
                    {" · "}
                    <Ltr className="font-bold">{person.vehicle.plate}</Ltr>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-fg-muted">טרם שובץ נהג</div>
        )}
      </div>
    </div>
  );
}

function PeoplePanel({ ride }: { ride: RideDTO }) {
  return (
    <Panel title="משתתפים">
      <div className="space-y-4">
        <PersonBlock title="נוסע" person={ride.rider} href={ride.rider ? `/admin/users/${ride.rider.id}` : null} icon={<UserRound size={18} aria-hidden />} />
        <div className="divider" />
        <PersonBlock title="נהג" person={ride.driver} href={ride.driver ? `/admin/drivers/${ride.driver.id}` : null} icon={<Car size={18} aria-hidden />} />
        {(ride.riderRating != null || ride.driverRating != null) && (
          <>
            <div className="divider" />
            <KV
              items={[
                { label: "דירוג הנוסע לנהג", value: ride.riderRating != null ? `${ride.riderRating} ★` : "—" },
                { label: "דירוג הנהג לנוסע", value: ride.driverRating != null ? `${ride.driverRating} ★` : "—" },
              ]}
            />
          </>
        )}
        {ride.status === "cancelled" && (
          <>
            <div className="divider" />
            <div className="text-sm">
              <div className="font-bold text-danger">בוטלה {ride.cancelledBy ? `על ידי ${CANCELLED_BY_HE[ride.cancelledBy]}` : ""}</div>
              {ride.cancelReason && <div className="mt-0.5 text-fg-muted">{CANCEL_REASONS_HE[ride.cancelReason] ?? ride.cancelReason}</div>}
              {ride.cancelledAt && <div className="mt-0.5 text-xs text-fg-muted">{formatDateTime(ride.cancelledAt)}</div>}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function MoneyRow({ label, value, strong, tone, hint }: { label: string; value: React.ReactNode; strong?: boolean; tone?: "danger" | "muted"; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className={cn("text-sm", strong ? "font-bold" : "text-fg-muted")}>
        {label}
        {hint && <span className="block text-[11px] font-normal text-fg-muted">{hint}</span>}
      </dt>
      <dd className={cn("shrink-0 tabular-nums", strong ? "text-lg font-extrabold" : "font-semibold", tone === "danger" && "text-danger", tone === "muted" && "text-fg-muted")}>{value}</dd>
    </div>
  );
}

function MoneyPanel({ ride, ledger }: { ride: RideDTO; ledger: AdminRideDetail["ledger"] }) {
  const fare = ride.finalFare ?? ride.quotedFare;
  const isFinal = ride.finalTotalAgorot != null;
  return (
    <Panel title="כספים" description={ride.isDemo || fare.isDemoTariff ? "תעריף הדגמה — הסכומים אינם אמיתיים" : undefined}>
      <dl className="divide-y divide-line">
        <MoneyRow label="הצעת מחיר לנוסע" value={formatILS(ride.quotedTotalAgorot)} />
        <MoneyRow label="מחיר סופי (נוסע שילם)" value={isFinal ? formatILS(ride.finalTotalAgorot!) : <Muted>טרם נקבע</Muted>} strong />
        <MoneyRow label="עמלת HOP" value={ride.commissionAgorot != null ? formatILS(ride.commissionAgorot) : <Muted>—</Muted>} hint={`${(fare.commissionPercentBp / 100).toFixed(fare.commissionPercentBp % 100 ? 1 : 0)}% + דמי הזמנה`} />
        <MoneyRow label="תשלום לנהג" value={ride.driverPayoutAgorot != null ? formatILS(ride.driverPayoutAgorot) : <Muted>—</Muted>} />
        <MoneyRow label="דמי ביטול" value={ride.cancellationFeeAgorot ? formatILS(ride.cancellationFeeAgorot) : <Muted>—</Muted>} />
        <MoneyRow label="הוחזר לנוסע" value={ride.refundedAgorot ? formatILS(-ride.refundedAgorot) : <Muted>—</Muted>} tone={ride.refundedAgorot ? "danger" : undefined} />
        <MoneyRow label="סטטוס תשלום" value={<Pill tone={ride.paymentStatus === "paid" ? "success" : ride.paymentStatus.includes("refunded") ? "danger" : "muted"}>{PAYMENT_STATUS_HE[ride.paymentStatus]}</Pill>} />
      </dl>
      <details className="group mt-3 rounded-2xl border border-line">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-3.5 text-sm font-bold [&::-webkit-details-marker]:hidden">
          פירוט התעריף {isFinal ? "(סופי)" : "(הצעה)"}
          <ArrowLeft size={15} className="transition-transform group-open:-rotate-90" aria-hidden />
        </summary>
        <dl className="border-t border-line px-3.5 py-2">
          {fare.lines.map((l) => (
            <div key={l.key} className="flex justify-between gap-3 py-1 text-sm">
              <dt className="text-fg-muted">{l.label}</dt>
              <dd className="tabular-nums">{formatILS(l.amountAgorot)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2 text-sm font-bold">
            <dt>סה״כ לנוסע</dt>
            <dd className="tabular-nums">{formatILS(fare.riderTotalAgorot)}</dd>
          </div>
        </dl>
      </details>
      <div className="mt-4">
        <div className="mb-2 text-xs font-bold text-fg-muted">תנועות בספר החשבונות</div>
        {ledger.length === 0 ? (
          <Muted>אין תנועות.</Muted>
        ) : (
          <ul className="space-y-1.5">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{LEDGER_TYPE_HE[l.type as keyof typeof LEDGER_TYPE_HE] ?? l.type}</span>
                  <span className="block truncate text-xs text-fg-muted">
                    {formatRelative(l.createdAt)}
                    {l.note ? ` · ${l.note}` : ""}
                  </span>
                </span>
                <span className={cn("shrink-0 tabular-nums", l.amountAgorot < 0 && "text-danger")}>{formatILS(l.amountAgorot)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function AdjustDialog({ ride, mode, refundable, onClose, onDone }: { ride: RideDTO; mode: "refund" | "note" | null; refundable: number; onClose: () => void; onDone: () => void }) {
  return (
    <ModalHost open={mode !== null} onClose={onClose} title={mode === "refund" ? "החזר כספי לנוסע" : "הוספת הערת מפעיל"}>
      {mode && <AdjustForm key={mode} ride={ride} mode={mode} refundable={refundable} onClose={onClose} onDone={onDone} />}
    </ModalHost>
  );
}

function AdjustForm({ ride, mode, refundable, onClose, onDone }: { ride: RideDTO; mode: "refund" | "note"; refundable: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = Number(amount.replace(",", "."));
  const agorot = Number.isFinite(parsed) ? ilsToAgorot(parsed) : NaN;
  const amountError = mode === "refund" && amount !== "" && (!Number.isFinite(parsed) || agorot <= 0 ? "הזינו סכום חיובי בשקלים" : agorot > refundable ? `הסכום המקסימלי להחזר הוא ${formatILS(refundable)}` : null);
  const valid = note.trim().length >= 2 && (mode === "note" || (amount !== "" && !amountError));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.admin.adjustRide(ride.id, { refundAgorot: mode === "refund" ? agorot : undefined, note: note.trim() });
      toast.success(mode === "refund" ? `בוצע החזר של ${formatILS(agorot)}` : "ההערה נשמרה");
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      setStep("form");
    }
  }

  if (step === "confirm")
    return (
      <div className="space-y-4 pb-5">
        <div className="rounded-2xl border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface))] p-4">
          <div className="flex items-center gap-2 font-bold text-danger">
            <AlertTriangle size={18} aria-hidden />
            אישור החזר
          </div>
          <p className="mt-2 text-sm">
            יוחזרו <strong className="tabular-nums">{formatILS(agorot)}</strong> לנוסע {ride.rider?.name ?? ""}. הפעולה נרשמת בספר החשבונות וביומן הביקורת ואינה ניתנת לביטול.
          </p>
          <p className="mt-2 text-xs text-fg-muted">הערה: {note.trim()}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="danger" loading={busy} onClick={submit} className="sm:min-w-36">
            ביצוע ההחזר
          </Button>
          <Button variant="ghost" onClick={() => setStep("form")} disabled={busy}>
            חזרה
          </Button>
        </div>
      </div>
    );

  return (
    <form
      className="space-y-4 pb-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        if (mode === "refund") setStep("confirm");
        else submit();
      }}
    >
      {mode === "refund" && (
        <>
          <div className="rounded-2xl bg-[color-mix(in_oklab,var(--fg)_4%,transparent)] px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-fg-muted">נגבה מהנוסע</span>
              <span className="tabular-nums">{formatILS((ride.finalTotalAgorot ?? 0) + ride.cancellationFeeAgorot)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-fg-muted">הוחזר עד כה</span>
              <span className="tabular-nums">{formatILS(ride.refundedAgorot)}</span>
            </div>
            <div className="mt-1 flex justify-between font-bold">
              <span>ניתן להחזיר</span>
              <span className="tabular-nums">{formatILS(refundable)}</span>
            </div>
          </div>
          <Field label="סכום ההחזר (₪) *" error={amountError || null} hint="הסכום יומר לאגורות ויירשם כתנועת החזר.">
            {(id) => (
              <div className="relative">
                <Input id={id} inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-10 text-right tabular-nums" invalid={!!amountError} data-autofocus />
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-muted">₪</span>
              </div>
            )}
          </Field>
        </>
      )}
      <Field label={mode === "refund" ? "סיבת ההחזר *" : "הערה *"} hint="נשמר בהערות הנסיעה וביומן הביקורת.">
        {(id) => <textarea id={id} className="input min-h-[96px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={mode === "refund" ? "למשל: הנהג האריך את המסלול שלא לצורך" : "למשל: הנוסע דיווח על אבידה, הועבר לטיפול"} />}
      </Field>
      {error && <div role="alert" className="rounded-2xl bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3.5 py-2.5 text-sm font-semibold text-danger">{error}</div>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="submit" variant={mode === "refund" ? "danger" : "primary"} disabled={!valid} loading={busy} className="sm:min-w-36">
          {mode === "refund" ? "המשך לאישור" : "שמירת הערה"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
