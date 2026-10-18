"use client";
/** Ride history (driver's own rides), grouped by day, with load-more. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, History } from "lucide-react";
import { api } from "@/lib/api";
import { formatILS, formatTime } from "@/lib/format";
import { RIDE_STATUS_SHORT_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { Button, cn } from "@/components/ui";
import { TonePill } from "./TonePill";
import { DriverPage } from "./DriverPage";
import { NeedleLoader, StaggerItem, StaggerList } from "./motion";
import { Notice } from "./Notice";
import { errorMessage } from "./errors";
import { payoutOf } from "./labels";
import { CHIP, TEXT } from "./tone";

const PAGE = 20;

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));
}
function dayTitle(key: string, todayKey: string, yesterdayKey: string) {
  if (key === todayKey) return "היום";
  if (key === yesterdayKey) return "אתמול";
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" }).format(new Date(`${key}T12:00:00Z`));
}
function short(address: string) {
  return address.split(",")[0]?.trim() || address;
}

export function HistoryList() {
  const [rides, setRides] = useState<RideDTO[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<{ t: string; y: string } | null>(null);

  const fetchPage = useCallback((offset: number) => api.rides.list({ limit: PAGE, offset }), []);

  useEffect(() => {
    let active = true;
    fetchPage(0)
      .then(({ rides: r }) => {
        if (!active) return;
        const now = Date.now();
        setToday({ t: dayKey(new Date(now).toISOString()), y: dayKey(new Date(now - 86_400_000).toISOString()) });
        setRides(r);
        setMore(r.length === PAGE);
      })
      .catch((err: unknown) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [fetchPage]);

  async function loadMore() {
    if (!rides) return;
    setLoadingMore(true);
    try {
      const { rides: r } = await fetchPage(rides.length);
      setRides([...rides, ...r.filter((x) => !rides.some((y) => y.id === x.id))]);
      setMore(r.length === PAGE);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const groups: { key: string; rides: RideDTO[] }[] = [];
  for (const r of rides ?? []) {
    const k = dayKey(r.requestedAt);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.rides.push(r);
    else groups.push({ key: k, rides: [r] });
  }

  return (
    <DriverPage title="היסטוריית נסיעות" subtitle={rides ? `${rides.length}${more ? "+" : ""} נסיעות` : undefined}>
      {error && (
        <Notice tone="danger" live title="לא הצלחנו לטעון את ההיסטוריה" className="mb-4">
          {error}
        </Notice>
      )}
      {!rides && !error ? (
        <div className="grid place-items-center py-16">
          <NeedleLoader size={48} label="טוענים נסיעות" />
        </div>
      ) : rides && rides.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className={cn("mb-4 grid h-16 w-16 place-items-center rounded-3xl", CHIP.brand)}>
            <History size={30} aria-hidden />
          </span>
          <div className="display text-xl">הדרך עוד לפניך</div>
          <p className="mt-1 max-w-xs text-sm text-fg-muted">הנסיעה הראשונה שלך עם HOP תופיע כאן — עם המסלול, ציר הזמן והתשלום המדויק.</p>
          <Link href="/drive" className="btn btn-primary mt-5">
            למסך הנהיגה
          </Link>
        </div>
      ) : (
        <div className="grid gap-5">
          {groups.map((g) => (
            <section key={g.key} className="min-w-0" aria-label={today ? dayTitle(g.key, today.t, today.y) : g.key}>
              <h2 className="mb-2 px-1 text-sm font-extrabold text-fg-muted">{today ? dayTitle(g.key, today.t, today.y) : ""}</h2>
              <StaggerList className="card min-w-0 divide-y divide-line overflow-hidden p-0">
                {g.rides.map((r) => (
                  <StaggerItem key={r.id}>
                    <RideRow ride={r} />
                  </StaggerItem>
                ))}
              </StaggerList>
            </section>
          ))}
          {more && (
            <Button variant="glass" block onClick={() => void loadMore()} loading={loadingMore}>
              טעינת נסיעות נוספות
            </Button>
          )}
        </div>
      )}
    </DriverPage>
  );
}

function RideRow({ ride }: { ride: RideDTO }) {
  const active = ride.status !== "completed" && ride.status !== "cancelled";
  const tone = ride.status === "completed" ? "success" : ride.status === "cancelled" ? "muted" : "brand";
  return (
    <Link href={active ? "/drive" : `/drive/history/${ride.id}`} className="flex min-h-[84px] items-center gap-3 px-4 py-3 transition-colors hover:bg-bg" data-testid="history-row">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-bg ring-1 ring-line">
        <div className="text-[13px] font-extrabold tabular-nums ltr-nums">{formatTime(ride.completedAt ?? ride.cancelledAt ?? ride.requestedAt)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{short(ride.pickup.address)}</div>
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-fg-muted">
          <span aria-hidden className="shrink-0">←</span>
          <span className="sr-only">אל</span>
          <span className="min-w-0 truncate">{short(ride.dropoff.address)}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-fg-muted">
          <TonePill tone={tone} className="h-6 text-[11px]">
            {active ? "פעילה" : RIDE_STATUS_SHORT_HE[ride.status]}
          </TonePill>
          <span className="truncate">{ride.rider?.name ?? ride.serviceType.nameHe}</span>
          {ride.isDemo && <span className={cn("shrink-0 font-semibold", TEXT.warning)}>הדגמה</span>}
        </div>
      </div>
      <div className="shrink-0 text-end">
        {ride.status === "completed" ? <div className="display text-base tabular-nums">{formatILS(payoutOf(ride))}</div> : <div className="text-sm text-fg-muted">—</div>}
      </div>
      <ChevronLeft size={18} className="shrink-0 text-fg-muted" aria-hidden />
    </Link>
  );
}
