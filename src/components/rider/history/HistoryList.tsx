"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CarTaxiFront } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, formatILS } from "@/lib/format";
import type { RideDTO } from "@/lib/types";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { InlineError } from "../InlineError";
import { describeError, type FriendlyError } from "../lib/errors";
import { StaggerItem, StaggerList } from "../motion";
import { rideTotal } from "../Receipt";
import { RiderPage } from "../RiderPage";
import { RouteSummary } from "../RouteSummary";
import { StatusPill } from "../StatusPill";

const PAGE = 20;
const monthKey = (iso: string) => new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "Asia/Jerusalem" }).format(new Date(iso));

export function HistoryList() {
  const [rides, setRides] = useState<RideDTO[] | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    (offset: number) =>
      api.rides.list({ limit: PAGE, offset }).then(
        (res) => {
          setRides((prev) => (offset === 0 ? res.rides : [...(prev ?? []), ...res.rides]));
          setMore(res.rides.length === PAGE);
          setError(null);
        },
        (err) => setError(describeError(err)),
      ),
    [],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const groups: { month: string; rides: RideDTO[] }[] = [];
  for (const r of rides ?? []) {
    const m = monthKey(r.requestedAt);
    const g = groups[groups.length - 1];
    if (g && g.month === m) g.rides.push(r);
    else groups.push({ month: m, rides: [r] });
  }

  return (
    <RiderPage title="הנסיעות שלי" subtitle={rides ? (rides.length ? `${rides.length}${more ? "+" : ""} נסיעות` : "עדיין בלי נסיעות") : "טוען…"}>
      {error && !rides && <InlineError error={error} action={<Button size="sm" variant="ink" onClick={() => load(0)}>ניסיון חוזר</Button>} />}
      {!rides && !error && (
        <div className="space-y-3" aria-busy="true" aria-label="טוען נסיעות">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card space-y-2 p-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}
      {rides && rides.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<CarTaxiFront size={26} aria-hidden />}
            title="עוד לא נסעתם איתנו"
            description="הנסיעה הראשונה שלכם במרחק שלוש נגיעות. כשתיסעו, כל הקבלות יחכו כאן."
            action={
              <Link href="/ride" className="btn btn-primary">
                להזמין נסיעה <ArrowLeft size={18} aria-hidden />
              </Link>
            }
          />
        </div>
      )}
      {rides && rides.length > 0 && (
        <div data-testid="history-list">
          {groups.map((g) => (
            <section key={g.month} className="mb-5">
              <h2 className="mb-2 px-1 text-xs font-extrabold text-fg-muted">{g.month}</h2>
              <StaggerList className="space-y-2.5">
                {g.rides.map((r) => (
                  <StaggerItem key={r.id}>
                    <HistoryItem ride={r} />
                  </StaggerItem>
                ))}
              </StaggerList>
            </section>
          ))}
          {error && <InlineError error={error} className="mb-3" />}
          {more && (
            <Button
              variant="glass"
              block
              loading={loadingMore}
              onClick={async () => {
                setLoadingMore(true);
                await load(rides.length);
                setLoadingMore(false);
              }}
            >
              טעינת נסיעות קודמות
            </Button>
          )}
        </div>
      )}
    </RiderPage>
  );
}

function HistoryItem({ ride }: { ride: RideDTO }) {
  const cancelled = ride.status === "cancelled";
  return (
    <Link href={`/ride/history/${ride.id}`} className="card group block p-4 transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(17,19,24,.45)]" data-testid="history-item">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-fg-muted tabular-nums">{formatDateTime(ride.requestedAt)}</span>
        <StatusPill status={ride.status} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <RouteSummary compact pickup={{ address: ride.pickup.address }} dropoff={{ address: ride.dropoff.address }} className="-my-1" />
          <div className="mt-1 text-xs text-fg-muted">
            {ride.serviceType.nameHe}
            {ride.driver ? ` · ${ride.driver.name}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <div className={cancelled && ride.cancellationFeeAgorot === 0 ? "text-sm font-bold text-fg-muted" : "text-base font-extrabold"}>
            {cancelled && ride.cancellationFeeAgorot === 0 ? "ללא חיוב" : <span className="ltr-nums">{formatILS(rideTotal(ride))}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
