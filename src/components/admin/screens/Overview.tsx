"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Car, CheckCircle2, Flag, LifeBuoy, RotateCw, Route, ShieldAlert, Users, XCircle } from "lucide-react";
import { api, type AdminOverview } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { AVAILABILITY_HE, VEHICLE_CLASS_HE } from "@/lib/labels";
import { MapView, type MapMarker } from "@/components/map";
import { Button, EmptyState, cn } from "@/components/ui";
import { useAdminFeed, readAdminDriver, readDriverLocation } from "../realtime";
import { useDebouncedCallback, useLoad } from "../hooks";
import { useReportBusy } from "../brand";
import { Bone, DataTable, ErrorState, Kpi, Page, PageHeader, Panel } from "../ui";
import { AnimatedNumber, NeedleLoader, SPRING, countHe, useGlide } from "../motion";
import { motion } from "motion/react";
import { rideColumns } from "../rides";
import { AvailabilityPill } from "../pills";
import { PAYOUT_COLOR } from "../tokens";

type LiveDriver = AdminOverview["liveDrivers"][number];
const FIT_PADDING = { top: 56, bottom: 76, left: 64, right: 64 };
const TEL_AVIV = { lat: 32.0753, lng: 34.7818 };

export function Overview() {
  const { data, error, loading, refreshing, reload } = useLoad("overview", () => api.admin.overview());
  const [live, setLive] = useState<Record<string, Partial<LiveDriver>>>({});
  const debouncedReload = useDebouncedCallback(reload, 1200);
  useReportBusy("overview", loading || refreshing);

  useAdminFeed((e) => {
    const loc = readDriverLocation(e);
    if (loc) {
      setLive((p) => ({ ...p, [loc.driverId]: { ...p[loc.driverId], lat: loc.lat, lng: loc.lng, heading: loc.heading, at: loc.at } }));
      return;
    }
    const drv = readAdminDriver(e);
    if (drv) {
      if (drv.availability) {
        const availability = drv.availability;
        setLive((p) => ({ ...p, [drv.driverId]: { ...p[drv.driverId], availability } }));
      }
      debouncedReload();
      return;
    }
    if (e.type === "admin.ride" || e.type === "reconnect") debouncedReload();
    if (e.type === "notification") debouncedReload();
  });

  const drivers = useMemo(() => {
    if (!data) return [];
    return data.liveDrivers
      .map((d) => ({ ...d, ...live[d.id] }) as LiveDriver)
      .filter((d) => d.availability !== "offline");
  }, [data, live]);

  const active = data?.activeRides ?? 0;
  const pending = data?.pendingVerifications ?? 0;
  const tickets = data?.openTickets ?? 0;
  const flagged = data?.flaggedRides ?? 0;
  const onlineCount = drivers.filter((d) => d.availability === "online").length;
  const busyCount = drivers.filter((d) => d.availability === "busy").length;

  if (error && !data) {
    return (
      <Page>
        <PageHeader title="סקירה" />
        <div className="card">
          <ErrorState message={error} onRetry={reload} />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="סקירה"
        busy={refreshing}
        description="תמונת מצב של הפלטפורמה. הנתונים מתעדכנים אוטומטית מאירועי זמן אמת."
        actions={
          <Button variant="glass" size="sm" onClick={reload} disabled={refreshing} aria-label="רענון נתונים">
            <RotateCw size={16} className={cn(refreshing && "animate-spin")} aria-hidden />
            רענון
          </Button>
        }
      />

      <section aria-label="מדדים תפעוליים" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Kpi index={0} loading={loading} label="נסיעות פעילות" value={active} icon={<Route size={18} />} hint={active ? "בדרך עכשיו" : "אין נסיעות פעילות כרגע"} href="/admin/rides?status=active" />
        <Kpi index={1} loading={loading} label="הושלמו היום" value={data?.completedToday ?? 0} icon={<CheckCircle2 size={18} />} hint="מאז חצות" href="/admin/rides?status=completed" />
        <Kpi index={2} loading={loading} label="בוטלו היום" value={data?.cancelledToday ?? 0} icon={<XCircle size={18} />} hint={data?.cancelledToday ? "כולל ביטולי מערכת" : "אין ביטולים היום"} href="/admin/rides?status=cancelled" />
        <Kpi index={3} loading={loading} label="נהגים מחוברים" value={data?.onlineDrivers ?? 0} icon={<Car size={18} />} hint={`${onlineCount} זמינים · ${busyCount} בנסיעה`} href="/admin/drivers?status=approved" />
        <Kpi
          index={4}
          loading={loading}
          label="ממתינים לאימות"
          value={pending}
          icon={<ShieldAlert size={18} />}
          attention={pending > 0}
          hint={pending ? `${countHe(pending, "נהג אחד ממתין", "נהגים ממתינים")} לאישור` : "אין נהגים בהמתנה"}
          href="/admin/drivers?status=under_review"
        />
        <Kpi index={5} loading={loading} label="פניות פתוחות" value={tickets} icon={<LifeBuoy size={18} />} attention={tickets > 0} hint={tickets ? `${countHe(tickets, "פנייה אחת מחכה", "פניות מחכות")} למענה` : "הכל שקט — אין פניות פתוחות"} href="/admin/tickets" />
        <Kpi index={6} loading={loading} label="נסיעות מסומנות" value={flagged} icon={<Flag size={18} />} attention={flagged > 0} hint={flagged ? "חריגות שדורשות בדיקה" : "לא זוהו חריגות"} href="/admin/rides?flagged=1" />
        <Kpi index={7} loading={loading} label="סה״כ משתמשים" value={data?.totalUsers ?? 0} icon={<Users size={18} />} hint="נוסעים, נהגים וצוות" href="/admin/users" />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel
          title="מפת נהגים חיה"
          description="מיקומים מתעדכנים בזמן אמת"
          className="lg:col-span-2"
          index={1}
          flush
          actions={
            <div className="flex items-center gap-3 text-xs font-semibold text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                <span className="tabular-nums">{onlineCount}</span> זמינים
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
                <span className="tabular-nums">{busyCount}</span> בנסיעה
              </span>
            </div>
          }
        >
          <LiveMap drivers={drivers} loading={loading} />
        </Panel>
        <MoneyToday data={data} loading={loading} />
      </div>

      <Panel
        className="mt-5"
        index={3}
        title="נסיעות אחרונות"
        flush
        actions={
          <Link href="/admin/rides" className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-bold text-brand hover:bg-brand-50">
            לכל הנסיעות
            <ArrowLeft size={16} aria-hidden />
          </Link>
        }
      >
        <DataTable
          rows={data?.recentRides}
          loading={loading}
          columns={rideColumns({ flags: true })}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/rides/${r.id}`}
          caption="נסיעות אחרונות"
          empty={<EmptyState icon={<Route size={24} />} title="עדיין אין נסיעות" description="נסיעות חדשות יופיעו כאן ברגע שיוזמנו." />}
        />
      </Panel>
    </Page>
  );
}

function LiveMap({ drivers, loading }: { drivers: LiveDriver[]; loading: boolean }) {
  const located = useMemo(() => drivers.filter((d): d is LiveDriver & { lat: number; lng: number } => d.lat != null && d.lng != null), [drivers]);
  const gliding = useGlide(located);
  const markers: MapMarker[] = gliding.map((d) => ({
    id: d.id,
    lat: d.lat,
    lng: d.lng,
    kind: "driver",
    heading: d.heading,
    label: d.availability === "busy" ? `${d.name} · בנסיעה` : d.name,
  }));
  const idsKey = located
    .map((d) => d.id)
    .sort()
    .join(",");
  // Re-fit only when the set of drivers changes, not on every position update.
  const fit = useMemo(() => (idsKey ? located.map((d) => ({ lat: d.lat, lng: d.lng })) : null), [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid xl:grid-cols-[1fr_280px]">
      <div className="relative h-[320px] sm:h-[400px]">
        <MapView center={TEL_AVIV} zoom={12} markers={markers} fit={fit} fitPadding={FIT_PADDING} />
        {!loading && located.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="glass glass-strong glass-md px-4 py-3 text-sm font-semibold">אין נהגים מחוברים כרגע</div>
          </div>
        )}
      </div>
      <div className="max-h-[400px] overflow-y-auto border-t border-line xl:border-s xl:border-t-0">
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm font-semibold text-fg-muted">
            <NeedleLoader size={24} label={null} />
            מאתרים נהגים…
          </div>
        ) : drivers.length === 0 ? (
          <p className="p-4 text-sm text-fg-muted">שקט כרגע — כשנהגים יתחברו הם יופיעו כאן.</p>
        ) : (
          <ul className="divide-y divide-line">
            {drivers.map((d, i) => (
              <motion.li key={d.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING, delay: Math.min(i, 10) * 0.04 }}>
                <Link href={`/admin/drivers/${d.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-50">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", d.availability === "busy" ? "bg-brand-100 text-brand" : "bg-[color-mix(in_oklab,var(--success)_14%,transparent)] text-success")}>
                    <Car size={17} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{d.name}</span>
                    <span className="block truncate text-xs text-fg-muted">
                      {VEHICLE_CLASS_HE[d.vehicleClass as keyof typeof VEHICLE_CLASS_HE] ?? d.vehicleClass} · {d.at ? `עודכן ${formatRelative(d.at)}` : "ללא מיקום"}
                    </span>
                  </span>
                  <AvailabilityPill availability={d.availability} />
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {drivers.length} נהגים מחוברים: {drivers.map((d) => `${d.name} (${AVAILABILITY_HE[d.availability]})`).join(", ")}
      </span>
    </div>
  );
}

function MoneyToday({ data, loading }: { data: AdminOverview | undefined; loading: boolean }) {
  const completed = data?.completedToday ?? 0;
  const gross = data?.grossTodayAgorot ?? 0;
  const commission = data?.commissionTodayAgorot ?? 0;
  const payout = data?.payoutTodayAgorot ?? 0;
  const split = commission + payout;
  const commissionPct = split > 0 ? (commission / split) * 100 : 0;
  return (
    <Panel title="כספים — היום" index={2} description={completed ? `${countHe(completed, "נסיעה אחת הושלמה", "נסיעות הושלמו")} מאז חצות` : "עוד לא הושלמו נסיעות היום"}>
      <dl className="space-y-4">
        <div>
          <dt className="text-[13px] font-semibold text-fg-muted">הכנסה ברוטו (נוסעים שילמו)</dt>
          <dd className="display mt-1 text-[32px] leading-none tabular-nums">{loading ? <Bone className="h-8 w-32" /> : <AnimatedNumber value={gross} kind="ils" />}</dd>
        </div>
        <div aria-hidden className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_7%,transparent)]">
          {split > 0 && (
            <>
              <motion.div className="h-full rounded-s-full bg-brand" initial={{ width: 0 }} animate={{ width: `${commissionPct}%` }} transition={{ type: "spring", stiffness: 120, damping: 22 }} />
              <div className="h-full flex-1 rounded-e-full" style={{ background: PAYOUT_COLOR }} />
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line p-3">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-brand" aria-hidden />
              עמלת HOP
            </dt>
            <dd className="display mt-1 text-lg tabular-nums">{loading ? <Bone className="h-6 w-20" /> : <AnimatedNumber value={commission} kind="ils" />}</dd>
            {split > 0 && <dd className="text-xs text-fg-muted tabular-nums">{commissionPct.toFixed(1)}% מהברוטו</dd>}
          </div>
          <div className="rounded-2xl border border-line p-3">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PAYOUT_COLOR }} aria-hidden />
              תשלומים לנהגים
            </dt>
            <dd className="display mt-1 text-lg tabular-nums">{loading ? <Bone className="h-6 w-20" /> : <AnimatedNumber value={payout} kind="ils" />}</dd>
            {split > 0 && <dd className="text-xs text-fg-muted tabular-nums">{(100 - commissionPct).toFixed(1)}% מהברוטו</dd>}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-[color-mix(in_oklab,var(--fg)_4%,transparent)] px-3.5 py-2.5 text-sm">
          <span className="text-fg-muted">ממוצע לנסיעה</span>
          <span className="font-bold tabular-nums">{completed ? <AnimatedNumber value={Math.round(gross / completed)} kind="ils" /> : "—"}</span>
        </div>
        <p className="text-xs leading-relaxed text-fg-muted">
          הברוטו הוא סך מה שהנוסעים שילמו, והוא מתחלק בין עמלת HOP לבין התשלום לנהגים. אין לחבר את שלושת הסכומים.
        </p>
        <Link href="/admin/reports" className="inline-flex h-9 items-center gap-1 rounded-full text-sm font-bold text-brand hover:underline">
          לדוחות המלאים
          <ArrowLeft size={16} aria-hidden />
        </Link>
      </dl>
    </Panel>
  );
}
